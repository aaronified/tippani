package store

import (
	"path/filepath"
	"testing"

	"tippani/internal/metadata"
)

// The 3.1.0 backfill, and the invariant it leaves behind.
//
// THE PASS IS THE ONLY THING THAT EVER SEES A PRE-0056 LIBRARY, so it is the one
// piece of this change that cannot be exercised by using the app. Everything
// here seeds the shape a real upgraded database has — credit strings on works,
// name strings on cast rows — and asserts what the reader gets back.

func openForBackfill(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	// 55 is the last migration before 0056, so the seed below writes the schema
	// as it stood when these columns were the only record of a person.
	migrateThrough(t, s, 55)
	return s
}

// migrateThroughAndUpgrade takes a seeded pre-0056 database all the way to head
// the way a real boot does — the SQL migrations AND the one-time passes.
// migrateThrough alone applies only the .sql files, so a pass under test would
// silently never run and every assertion below would be about an empty table.
func migrateThroughAndUpgrade(t *testing.T, s *Store) {
	t.Helper()
	var before int
	if err := s.DB.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_version`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	migrateThrough(t, s, 9999)
	// FreshInstall is false on purpose: these databases were seeded at 55, which
	// is exactly the upgrader this pass exists for.
	if err := s.runOneTimePasses(OneTimeEnv{FreshInstall: false, SchemaVersionBefore: before}); err != nil {
		t.Fatalf("one-time passes: %v", err)
	}
}

func TestPersonIdentityBackfillSplitsAMultiAuthorCredit(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title, author, translator)
	                 VALUES (1, 1, 'The Master and Margarita', 'Mikhail Bulgakov', 'Richard Pevear, Larissa Volokhonsky')`)
	migrateThroughAndUpgrade(t, s)

	// Two translators, in the order the book prints them — not whatever order
	// SQLite happened to return.
	rows, err := s.DB.Query(
		`SELECT p.name FROM work_person wp JOIN people p ON p.id = wp.person_id
		  WHERE wp.user_id = 1 AND wp.kind = 'book' AND wp.work_id = 1 AND wp.role = 'translator'
		  ORDER BY wp.ordering`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatal(err)
		}
		got = append(got, n)
	}
	want := []string{"Richard Pevear", "Larissa Volokhonsky"}
	if len(got) != len(want) {
		t.Fatalf("translators: got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("translator %d: got %q, want %q", i, got[i], want[i])
		}
	}

	// And the column still reads exactly as it did, because the recomposition of
	// a comma-separated credit is the string it came from.
	var col string
	if err := s.DB.QueryRow(`SELECT translator FROM books WHERE id = 1`).Scan(&col); err != nil {
		t.Fatal(err)
	}
	if col != "Richard Pevear, Larissa Volokhonsky" {
		t.Fatalf("the cached column changed under the reader: %q", col)
	}
}

// The case the whole model exists for: one human being credited two ways is one
// record once the reader merges them — and stays one on the next write, which is
// what the alias arm of ResolvePerson buys.
func TestResolvePersonPrefersANameThenAnAlias(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	migrateThroughAndUpgrade(t, s)

	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	full, err := ResolvePerson(tx, 1, "Mikhail Bulgakov")
	if err != nil {
		t.Fatal(err)
	}
	// The merge that would have folded a second spelling in.
	if _, err := tx.Exec(
		`INSERT INTO person_alias (user_id, person_id, alias, alias_key) VALUES (1, ?, ?, ?)`,
		full, "M. Bulgakov", CastKey("M. Bulgakov")); err != nil {
		t.Fatal(err)
	}

	short, err := ResolvePerson(tx, 1, "M. Bulgakov")
	if err != nil {
		t.Fatal(err)
	}
	if short != full {
		t.Fatalf("the short form made a second person: %d vs %d — a merge does not survive a write", short, full)
	}

	// A NAME BEATS AN ALIAS. Somebody actually called "M. Bulgakov" owns that
	// spelling outright; an alias is a way of finding a record, not a claim on a
	// name another record holds.
	res, err := tx.Exec(`INSERT INTO people (user_id, name) VALUES (1, 'M. Bulgakov')`)
	if err != nil {
		t.Fatal(err)
	}
	own, _ := res.LastInsertId()
	again, err := ResolvePerson(tx, 1, "M. Bulgakov")
	if err != nil {
		t.Fatal(err)
	}
	if again != own {
		t.Fatalf("the alias beat a real name: got %d, want %d", again, own)
	}
}

// The invariant the derived column rests on, asserted the way the app will
// assert it: walk the library and compare.
func TestCreditsAgreeAfterTheBackfill(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Good Omens', 'Neil Gaiman & Terry Pratchett')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title, author) VALUES (2, 1, 'Solaris', 'Stanisław Lem')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title, director) VALUES (1, 1, 'Ran', 'Akira Kurosawa')`)
	migrateThroughAndUpgrade(t, s)

	bad, err := CreditsAgree(s.DB, 1, metadata.DefaultCreditSeps)
	if err != nil {
		t.Fatal(err)
	}
	if len(bad) != 0 {
		t.Fatalf("the cache disagrees with the links after a clean backfill: %+v", bad)
	}

	// AND IT CATCHES A WRITE THAT BYPASSED SetCredits, which is the only failure
	// mode that matters. A test that only ever passes on data it produced itself
	// proves the checker runs, not that it works.
	mustExecT(t, s, `UPDATE books SET author = 'Somebody Else' WHERE id = 2`)
	bad, err = CreditsAgree(s.DB, 1, metadata.DefaultCreditSeps)
	if err != nil {
		t.Fatal(err)
	}
	if len(bad) != 1 {
		t.Fatalf("a bypassed write went unnoticed: %+v", bad)
	}
	if bad[0].WorkID != 2 || bad[0].Column != "Somebody Else" || bad[0].Links != "Stanisław Lem" {
		t.Fatalf("wrong disagreement reported: %+v", bad[0])
	}
}

// A cast row gets a character; a book's cast row gets no actor, because a novel
// has characters and no performers.
func TestPersonIdentityBackfillLinksTheCast(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	mustExecT(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	mustExecT(t, s, `INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key)
	                 VALUES (1, 'movie', 1, 'Woland', ?, 'Oleg Basilashvili', ?)`,
		CastKey("Woland"), CastKey("Oleg Basilashvili"))
	mustExecT(t, s, `INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key)
	                 VALUES (1, 'book', 1, 'Woland', ?, '', '')`, CastKey("Woland"))
	migrateThroughAndUpgrade(t, s)

	var filmChar, filmActor, bookChar, bookActor any
	if err := s.DB.QueryRow(
		`SELECT character_id, actor_id FROM work_cast WHERE kind = 'movie'`).Scan(&filmChar, &filmActor); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(
		`SELECT character_id, actor_id FROM work_cast WHERE kind = 'book'`).Scan(&bookChar, &bookActor); err != nil {
		t.Fatal(err)
	}
	if filmChar == nil || filmActor == nil {
		t.Fatalf("the film's cast row was not linked: character=%v actor=%v", filmChar, filmActor)
	}
	if bookChar == nil {
		t.Fatal("the book's character was not linked")
	}
	if bookActor != nil {
		t.Fatalf("a book character was given a performer: %v", bookActor)
	}

	// TWO WORKS, TWO WOLANDS, deliberately. "Narrator" and "Mother" recur across
	// unrelated works and are not one character, so the pass never welds by name
	// — that is the reader's own act in the picker.
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM characters WHERE user_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("expected one character per work, got %d", n)
	}
}
