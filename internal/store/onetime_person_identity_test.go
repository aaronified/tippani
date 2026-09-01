package store

import (
	"database/sql"
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

// The 3.1.0 quote-person pass, on the only kind of database it exists for.
//
// IT IS SKIPPED ON A FRESH INSTALL, which is right — a database created after
// 0059 has never held an unlinked quote — and which means every other test in
// this package runs past it without exercising a line. So this one seeds the
// shape a real upgraded library has: film lines and standalone quotes carrying
// names, and nothing pointing at anybody.
func TestQuotePersonBackfillLinksAnExistingLibrary(t *testing.T) {
	s := openForBackfill(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	// An author who also acts: the pass runs AFTER 3.1.0-person-identity (they
	// sort by name), so this must resolve to the record that pass created rather
	// than making a second Ursula K. Le Guin.
	mustExecT(t, s, `INSERT INTO books (id, user_id, title, author)
	                 VALUES (1, 1, 'A Wizard of Earthsea', 'Ursula K. Le Guin')`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Jurassic Park')`)
	mustExecT(t, s, `INSERT INTO dialogues (id, movie_id, quote, character, actor, dedupe_hash)
	                 VALUES (1, 1, 'Clever girl', 'Muldoon', 'Bob Peck', 'h1')`)
	// A line the cast autofill credited to two performers. It has no single
	// speaker, so the pass must leave it unlinked rather than file it under
	// whichever name came first.
	mustExecT(t, s, `INSERT INTO dialogues (id, movie_id, quote, character, actor, dedupe_hash)
	                 VALUES (2, 1, 'Hold on to your butts', 'Arnold, Muldoon', 'Samuel L. Jackson, Bob Peck', 'h2')`)
	mustExecT(t, s, `INSERT INTO utterances (id, user_id, quote, speaker, dedupe_hash)
	                 VALUES (1, 1, 'The unread story is not a story', 'Ursula K. Le Guin', 'h3')`)
	// Narration: a real answer, and it must not acquire a record.
	mustExecT(t, s, `INSERT INTO utterances (id, user_id, quote, speaker, dedupe_hash)
	                 VALUES (2, 1, 'A borrowed line', '', 'h4')`)

	migrateThroughAndUpgrade(t, s)

	linked := func(q string, args ...any) int64 {
		t.Helper()
		var id sql.NullInt64
		if err := s.DB.QueryRow(q, args...).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id.Int64
	}
	peck := linked(`SELECT actor_id FROM dialogues WHERE id = 1`)
	if peck == 0 {
		t.Fatalf("the upgrade left a named line pointing at nobody")
	}
	var name string
	if err := s.DB.QueryRow(`SELECT name FROM people WHERE id = ?`, peck).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Bob Peck" {
		t.Fatalf("the line was linked to %q", name)
	}
	if id := linked(`SELECT actor_id FROM dialogues WHERE id = 2`); id != 0 {
		t.Errorf("a two-hander was attributed to one performer (%d)", id)
	}
	if id := linked(`SELECT speaker_id FROM utterances WHERE id = 2`); id != 0 {
		t.Errorf("an unattributed quote acquired a speaker (%d)", id)
	}

	// ONE RECORD FOR THE AUTHOR WHO IS ALSO A SPEAKER. This is what the pass
	// ordering buys: the credit pass created her, and this one resolved into that
	// record by name rather than creating a second of her.
	var n int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM people WHERE user_id = 1 AND name = 'Ursula K. Le Guin'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("one person became %d across the two passes", n)
	}
	speaker := linked(`SELECT speaker_id FROM utterances WHERE id = 1`)
	var credited int64
	if err := s.DB.QueryRow(
		`SELECT person_id FROM work_person WHERE user_id = 1 AND kind = 'book' AND work_id = 1 AND role = 'author'`).
		Scan(&credited); err != nil {
		t.Fatal(err)
	}
	if speaker != credited {
		t.Fatalf("her quote points at %d and her book at %d", speaker, credited)
	}

	// And the library agrees with itself afterwards, which is the invariant the
	// pass exists to establish.
	if d, err := QuoteLinksAgree(s.DB, 1, metadata.DefaultCreditSeps); err != nil || len(d) != 0 {
		t.Fatalf("after the upgrade the library disagrees with itself: %+v %v", d, err)
	}
}

// A FRESH INSTALL RECORDS THE PASS AND DOES NOTHING, which is the other half of
// the contract: it must not be asked again, and it must not do work on a
// database that cannot have any.
func TestQuotePersonBackfillIsANoOpOnAFreshInstall(t *testing.T) {
	s := openIdentity(t) // s.Migrate(), i.e. a database created at head
	var done int
	if err := s.DB.QueryRow(
		`SELECT COUNT(*) FROM one_time_passes WHERE name = '3.1.0-quote-person'`).Scan(&done); err != nil {
		t.Fatal(err)
	}
	if done != 1 {
		t.Fatalf("the pass recorded itself %d times on a fresh install", done)
	}
}
