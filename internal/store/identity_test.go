package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	"tippani/internal/metadata"
)

// The identity layer: aliases, and the two directions of the cast.
//
// WHAT THESE ARE REALLY GUARDING. 0056 gave a person and a character an id and
// somewhere to point; identity.go is where a reader's deliberate act — filing
// another spelling, saying who played a role — becomes a row. Every one of those
// acts is a claim about who somebody IS, so the failure mode is not an error, it
// is a library that has quietly decided two people are one.

func openIdentity(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`)
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (2, 'bob', 'x', 0)`)
	return s
}

func mustTx(t *testing.T, s *Store, fn func(tx *sql.Tx) error) {
	t.Helper()
	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		t.Fatalf("tx: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

// ---- aliases ---------------------------------------------------------------

// AN ALIAS IS HOW A CREDIT STRING FINDS A RECORD, which is why this test asserts
// through ResolvePerson rather than by reading person_alias back: the row existing
// is not the feature, the resolution is.
func TestAnAliasResolvesToTheRecordItWasFiledUnder(t *testing.T) {
	s := openIdentity(t)
	var id int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		id, err = ResolvePerson(tx, 1, "Mikhail Bulgakov")
		if err != nil {
			return err
		}
		return AddPersonAlias(tx, 1, id, "M. Bulgakov")
	})
	mustTx(t, s, func(tx *sql.Tx) error {
		got, err := ResolvePerson(tx, 1, "M. Bulgakov")
		if err != nil {
			return err
		}
		if got != id {
			t.Fatalf("the alias made a second person: %d, want %d", got, id)
		}
		// And the fold is Go's, not SQLite's: lower() is ASCII-only, so a Cyrillic
		// alias would resolve only by accident if the key were computed in SQL.
		return nil
	})
}

func TestAnAliasFoldsBeyondASCII(t *testing.T) {
	s := openIdentity(t)
	var id int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		id, err = ResolvePerson(tx, 1, "Mikhail Bulgakov")
		if err != nil {
			return err
		}
		return AddPersonAlias(tx, 1, id, "Михаил Булгаков")
	})
	mustTx(t, s, func(tx *sql.Tx) error {
		// SHOUTED. SQLite's lower() leaves Cyrillic capitals alone, so this is the
		// case that separates CastKey from a query that folds in SQL.
		got, err := ResolvePerson(tx, 1, "МИХАИЛ БУЛГАКОВ")
		if err != nil {
			return err
		}
		if got != id {
			t.Fatalf("the shouted Cyrillic alias missed: %d, want %d", got, id)
		}
		return nil
	})
}

// A NAME SOMEBODY HOLDS OUTRIGHT IS NOT AVAILABLE AS AN ALIAS. Allowing it would
// let the alias table contradict the people table, and ResolvePerson's "name
// first, then alias" rule would then quietly settle something the reader thought
// they had decided.
func TestAnAliasCannotClaimANameSomebodyElseHolds(t *testing.T) {
	s := openIdentity(t)
	mustTx(t, s, func(tx *sql.Tx) error {
		raw := tx
		woolf, err := ResolvePerson(raw, 1, "Virginia Woolf")
		if err != nil {
			return err
		}
		if _, err := ResolvePerson(raw, 1, "Leonard Woolf"); err != nil {
			return err
		}
		if err := AddPersonAlias(raw, 1, woolf, "Leonard Woolf"); err == nil {
			t.Fatal("an alias took a name another person holds")
		}
		// Their own name is refused too, and with a different sentence — a reader
		// typing it has made a different mistake.
		if err := AddPersonAlias(raw, 1, woolf, "virginia woolf"); err == nil {
			t.Fatal("a person became an alias of themselves")
		}
		return nil
	})
}

func TestAnAliasIsScopedToTheAccount(t *testing.T) {
	s := openIdentity(t)
	mustTx(t, s, func(tx *sql.Tx) error {
		raw := tx
		mine, err := ResolvePerson(raw, 1, "Mikhail Bulgakov")
		if err != nil {
			return err
		}
		if err := AddPersonAlias(raw, 1, mine, "M. Bulgakov"); err != nil {
			return err
		}
		// Bob may file the same spelling against his own record — the alias table's
		// PRIMARY KEY is (user_id, alias_key), so one account's decision about who
		// "M. Bulgakov" is cannot reach another's.
		theirs, err := ResolvePerson(raw, 2, "Mikhail Bulgakov")
		if err != nil {
			return err
		}
		if err := AddPersonAlias(raw, 2, theirs, "M. Bulgakov"); err != nil {
			t.Fatalf("bob could not use a spelling alice had taken: %v", err)
		}
		got, err := ResolvePerson(raw, 2, "M. Bulgakov")
		if err != nil {
			return err
		}
		if got != theirs {
			t.Fatalf("bob's alias resolved to %d, want his own %d", got, theirs)
		}
		return nil
	})
}

func TestRemovingAnAliasStopsItResolving(t *testing.T) {
	s := openIdentity(t)
	var id int64
	mustTx(t, s, func(tx *sql.Tx) error {
		raw := tx
		var err error
		id, err = ResolvePerson(raw, 1, "Mikhail Bulgakov")
		if err != nil {
			return err
		}
		return AddPersonAlias(raw, 1, id, "M. Bulgakov")
	})
	mustTx(t, s, func(tx *sql.Tx) error {
		return RemovePersonAlias(tx, 1, id, "m. bulgakov") // folded, so case is irrelevant
	})
	mustTx(t, s, func(tx *sql.Tx) error {
		got, err := ResolvePerson(tx, 1, "M. Bulgakov")
		if err != nil {
			return err
		}
		if got == id {
			t.Fatal("the removed alias still resolves")
		}
		return nil
	})
	// It made a NEW person rather than resolving, which is the correct outcome and
	// worth stating: unfiling a spelling means the app no longer knows who it is.
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM people WHERE user_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("people after unfiling: %d, want 2", n)
	}
}

// ---- the cast, both directions ---------------------------------------------

// A BOOK HAS A CAST TOO, and this is the test that would have failed on the first
// draft: both reads joined `movies` alone, so every book character was invisible
// to the character page while looking exactly like a character in no works.
func TestACharacterIsFoundInBooksAndFilmsAlike(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO books (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'The Master and Margarita (2005)')`)

	var charID, actorID int64
	mustTx(t, s, func(tx *sql.Tx) error {
		raw := tx
		var err error
		if charID, err = ResolveCharacter(raw, 1, "Woland"); err != nil {
			return err
		}
		actorID, err = ResolvePerson(raw, 1, "Oleg Basilashvili")
		return err
	})
	exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, character_id)
	      VALUES (1, 'book', 1, 'Woland', ?, ?)`, CastKey("Woland"), charID)
	exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, character_id, actor_id)
	      VALUES (1, 'movie', 1, 'Woland', ?, ?, ?)`, CastKey("Woland"), charID, actorID)

	got, err := CharacterAppearances(s.DB, 1, charID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("Woland appears in %d works, want 2 (a book and a film)", len(got))
	}
	kinds := map[string]bool{}
	for _, c := range got {
		kinds[c.Kind] = true
	}
	if !kinds["book"] || !kinds["movie"] {
		t.Fatalf("both kinds should be there: %+v", got)
	}
}

// THE OTHER DIRECTION: an actor's page lists every character they have played.
// One record, two roles, and the pairing is what work_cast holds.
func TestAnActorListsEveryCharacterTheyHavePlayed(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Ran'), (2, 1, 'Kagemusha')`)
	var actor, a, b int64
	mustTx(t, s, func(tx *sql.Tx) error {
		raw := tx
		var err error
		if actor, err = ResolvePerson(raw, 1, "Tatsuya Nakadai"); err != nil {
			return err
		}
		if a, err = ResolveCharacter(raw, 1, "Hidetora Ichimonji"); err != nil {
			return err
		}
		b, err = ResolveCharacter(raw, 1, "Shingen Takeda")
		return err
	})
	exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, character_id, actor_id)
	      VALUES (1, 'movie', 1, 'Hidetora', ?, ?, ?)`, CastKey("Hidetora"), a, actor)
	exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, character_id, actor_id)
	      VALUES (1, 'movie', 2, 'Shingen', ?, ?, ?)`, CastKey("Shingen"), b, actor)

	roles, err := PersonRoles(s.DB, 1, actor)
	if err != nil {
		t.Fatal(err)
	}
	if len(roles) != 2 {
		t.Fatalf("roles: %+v", roles)
	}
	// The performer's own name comes off the RECORD, not off the cast row's string,
	// so a corrected spelling on the record shows everywhere it is credited.
	for _, r := range roles {
		if r.Actor != "Tatsuya Nakadai" {
			t.Fatalf("role names the actor %q", r.Actor)
		}
	}
}

// LINKING IS NEVER AUTOMATIC — it is a deliberate act — so the one thing this has
// to guarantee is that the act cannot reach across accounts.
func TestLinkingAPerformerStaysInsideTheAccount(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Ran')`)
	exec(`INSERT INTO work_cast (id, user_id, kind, work_id, character, character_key)
	      VALUES (1, 1, 'movie', 1, 'Hidetora', ?)`, CastKey("Hidetora"))
	var theirs int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		theirs, err = ResolvePerson(tx, 2, "Somebody Else")
		return err
	})

	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	// Bob's person, alice's cast row: refused because the person does not exist in
	// alice's account, which is the same shape every other read here takes.
	if err := LinkCastActor(tx, 1, 1, theirs); err == nil {
		t.Fatal("linked another account's person to this cast row")
	}
	// And alice's cast row is not reachable from bob's account at all.
	if err := LinkCastActor(tx, 2, 1, theirs); err == nil {
		t.Fatal("bob linked a performer onto alice's cast row")
	}
}

// ---- merge -----------------------------------------------------------------

// seedTwoSpellings gives one library two records for one human being, each on its
// own book, which is the state a name-keyed library always ends in.
func seedTwoSpellings(t *testing.T, s *Store) (keep, drop int64, bookA, bookB int64) {
	t.Helper()
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'The Master and Margarita', 'Mikhail Bulgakov')`)
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (2, 1, 'The White Guard', 'M. Bulgakov')`)
	mustTx(t, s, func(tx *sql.Tx) error {
		if err := SyncCreditsFromColumns(tx, 1, "book", 1, metadata.DefaultCreditSeps); err != nil {
			return err
		}
		return SyncCreditsFromColumns(tx, 1, "book", 2, metadata.DefaultCreditSeps)
	})
	return personIDByName(t, s, "Mikhail Bulgakov"), personIDByName(t, s, "M. Bulgakov"), 1, 2
}

func personIDByName(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	var id int64
	if err := s.DB.QueryRow(`SELECT id FROM people WHERE user_id = 1 AND name = ?`, name).Scan(&id); err != nil {
		t.Fatalf("no person %q: %v", name, err)
	}
	return id
}

func authorOf(t *testing.T, s *Store, bookID int64) string {
	t.Helper()
	var a string
	if err := s.DB.QueryRow(`SELECT author FROM books WHERE id = ?`, bookID).Scan(&a); err != nil {
		t.Fatal(err)
	}
	return a
}

// THE RULE THAT MAKES MERGE SAFE TO OFFER AT ALL: merging two records must not
// change what any cover prints. Without it the reader tidies two spellings into
// one person and their shelf silently rewrites itself — the second book would
// start claiming a name that is not on it.
func TestMergingTwoSpellingsLeavesEveryCoverSayingWhatItSaid(t *testing.T) {
	s := openIdentity(t)
	keep, drop, a, b := seedTwoSpellings(t, s)

	mustTx(t, s, func(tx *sql.Tx) error {
		_, err := MergePeople(tx, 1, keep, drop, metadata.DefaultCreditSeps)
		return err
	})

	if got := authorOf(t, s, a); got != "Mikhail Bulgakov" {
		t.Errorf("the first book prints %q", got)
	}
	if got := authorOf(t, s, b); got != "M. Bulgakov" {
		t.Errorf("the second book prints %q — the merge rewrote a cover", got)
	}
	// One record, two books.
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM work_person WHERE user_id = 1 AND person_id = ?`, keep).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("the survivor holds %d credits, want 2", n)
	}
	if err := s.DB.QueryRow(`SELECT count(*) FROM people WHERE user_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("%d people after a merge, want 1", n)
	}
}

// THE DROPPED NAME BECOMES AN ALIAS, which is what stops the next import undoing
// the merge by re-creating the record it just folded in.
func TestAMergeSurvivesTheNextImportOfTheOldSpelling(t *testing.T) {
	s := openIdentity(t)
	keep, drop, _, _ := seedTwoSpellings(t, s)
	mustTx(t, s, func(tx *sql.Tx) error {
		_, err := MergePeople(tx, 1, keep, drop, metadata.DefaultCreditSeps)
		return err
	})
	mustTx(t, s, func(tx *sql.Tx) error {
		got, err := ResolvePerson(tx, 1, "M. Bulgakov")
		if err != nil {
			return err
		}
		if got != keep {
			t.Fatalf("the old spelling made a new record (%d), want the survivor (%d)", got, keep)
		}
		return nil
	})
}

// UNDO PUTS IT ALL BACK — the record with its id, the links, the printed
// spellings, the alias that was invented, and the survivor's blanks.
func TestUndoingAMergeRestoresBothRecordsExactly(t *testing.T) {
	s := openIdentity(t)
	keep, drop, a, b := seedTwoSpellings(t, s)
	// Give the dropped record something the survivor lacks, so the fill and its
	// reversal are both exercised.
	if _, err := s.DB.Exec(`UPDATE people SET born = '1891' WHERE id = ?`, drop); err != nil {
		t.Fatal(err)
	}

	var undo *MergeUndo
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		undo, err = MergePeople(tx, 1, keep, drop, metadata.DefaultCreditSeps)
		return err
	})
	var born string
	if err := s.DB.QueryRow(`SELECT born FROM people WHERE id = ?`, keep).Scan(&born); err != nil {
		t.Fatal(err)
	}
	if born != "1891" {
		t.Fatalf("the merge did not borrow the blank field: %q", born)
	}

	mustTx(t, s, func(tx *sql.Tx) error {
		return UndoPersonMerge(tx, 1, undo, metadata.DefaultCreditSeps)
	})

	// Both records are back, with their ids.
	for _, id := range []int64{keep, drop} {
		var n int
		if err := s.DB.QueryRow(`SELECT count(*) FROM people WHERE id = ? AND user_id = 1`, id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Fatalf("record %d did not come back", id)
		}
	}
	// Each book is credited to the record it was credited to, printing what it
	// printed — and the survivor's borrowed field is blank again.
	if err := s.DB.QueryRow(`SELECT born FROM people WHERE id = ?`, keep).Scan(&born); err != nil {
		t.Fatal(err)
	}
	if born != "" {
		t.Fatalf("undo left the borrowed value behind: %q", born)
	}
	var who int64
	if err := s.DB.QueryRow(`SELECT person_id FROM work_person WHERE work_id = ? AND kind='book'`, b).Scan(&who); err != nil {
		t.Fatal(err)
	}
	if who != drop {
		t.Fatalf("the second book points at %d, want the restored record %d", who, drop)
	}
	if got := authorOf(t, s, a); got != "Mikhail Bulgakov" {
		t.Errorf("first book after undo: %q", got)
	}
	if got := authorOf(t, s, b); got != "M. Bulgakov" {
		t.Errorf("second book after undo: %q", got)
	}
	// The invented alias is gone, so the two spellings are two records again.
	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM person_alias WHERE user_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("undo left %d aliases behind", n)
	}
}

// A WORK CREDITING BOTH RECORDS ENDS UP CREDITING ONE PERSON TWICE, and the shelf
// would print the name twice. The duplicate is collapsed — and comes back on undo,
// which is the half that is easy to forget.
func TestMergingCollapsesAWorkThatCreditedBothAndUndoBringsItBack(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Good Omens', 'X Alpha, X. Alpha')`)
	mustTx(t, s, func(tx *sql.Tx) error {
		return SyncCreditsFromColumns(tx, 1, "book", 1, metadata.DefaultCreditSeps)
	})
	keep := personIDByName(t, s, "X Alpha")
	drop := personIDByName(t, s, "X. Alpha")

	var undo *MergeUndo
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		undo, err = MergePeople(tx, 1, keep, drop, metadata.DefaultCreditSeps)
		return err
	})
	if got := authorOf(t, s, 1); got != "X Alpha" {
		t.Fatalf("the book prints %q — a collapsed credit should leave one name", got)
	}
	if len(undo.Collapsed) != 1 {
		t.Fatalf("collapsed %d rows, want 1", len(undo.Collapsed))
	}

	mustTx(t, s, func(tx *sql.Tx) error {
		return UndoPersonMerge(tx, 1, undo, metadata.DefaultCreditSeps)
	})
	if got := authorOf(t, s, 1); got != "X Alpha, X. Alpha" {
		t.Fatalf("after undo the book prints %q, want both names back", got)
	}
}

func TestAMergeNeverCrossesAccounts(t *testing.T) {
	s := openIdentity(t)
	keep, _, _, _ := seedTwoSpellings(t, s)
	var theirs int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		theirs, err = ResolvePerson(tx, 2, "Somebody Else")
		return err
	})
	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := MergePeople(tx, 1, keep, theirs, metadata.DefaultCreditSeps); err == nil {
		t.Fatal("merged another account's record into this one")
	}
	if _, err := MergePeople(tx, 1, keep, keep, metadata.DefaultCreditSeps); err == nil {
		t.Fatal("a record merged into itself")
	}
}

// ---- split out --------------------------------------------------------------

// SPLIT HANDS BACK A NAME, NOT THE WORKS, and the test says so plainly because
// that is the pack's own caveat: nothing in the schema remembers which book was
// credited to the record that got folded in.
func TestSplittingAnAliasGivesBackARecordButNotTheWorks(t *testing.T) {
	s := openIdentity(t)
	keep, drop, _, b := seedTwoSpellings(t, s)
	mustTx(t, s, func(tx *sql.Tx) error {
		_, err := MergePeople(tx, 1, keep, drop, metadata.DefaultCreditSeps)
		return err
	})

	var made int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		made, err = SplitPersonAlias(tx, 1, keep, "M. Bulgakov")
		return err
	})
	if made == 0 {
		t.Fatal("split made no record")
	}
	var name string
	if err := s.DB.QueryRow(`SELECT name FROM people WHERE id = ?`, made).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "M. Bulgakov" {
		t.Fatalf("the split record is called %q", name)
	}
	// The works stayed with the survivor. This is the documented limit, asserted so
	// nobody later reads the split as a full undo.
	var who int64
	if err := s.DB.QueryRow(`SELECT person_id FROM work_person WHERE work_id = ? AND kind='book'`, b).Scan(&who); err != nil {
		t.Fatal(err)
	}
	if who != keep {
		t.Fatalf("the book moved to %d; split does not move works", who)
	}
	// And the spelling resolves to the new record now rather than through an alias.
	mustTx(t, s, func(tx *sql.Tx) error {
		got, err := ResolvePerson(tx, 1, "M. Bulgakov")
		if err != nil {
			return err
		}
		if got != made {
			t.Fatalf("the spelling resolves to %d, want the split record %d", got, made)
		}
		return nil
	})
}

func TestSplittingRefusesASpellingThatIsNotThisRecordsAlias(t *testing.T) {
	s := openIdentity(t)
	keep, drop, _, _ := seedTwoSpellings(t, s)
	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := SplitPersonAlias(tx, 1, keep, "Nobody At All"); err == nil {
		t.Fatal("split a spelling nobody holds")
	}
	// The other record's own name is not an alias of anybody, so it is refused too
	// — a split is about a spelling this record has claimed, not about any string.
	if _, err := SplitPersonAlias(tx, 1, drop, "Mikhail Bulgakov"); err == nil {
		t.Fatal("split a name that is not an alias")
	}
}

// ---- a new cast row gets its records ----------------------------------------

// THE HOLE THIS CLOSES. 0056's backfill gave every existing cast row a character
// and a performer; nothing in the running app did. So a library upgraded on
// Tuesday had a character list, and every role typed on Wednesday was invisible
// to it — the model would have been something only the upgrade ever populated.
func TestANewCastRowIsGivenItsRecords(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Ran')`)
	exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key)
	      VALUES (1, 'movie', 1, 'Hidetora Ichimonji', ?, 'Tatsuya Nakadai', ?)`,
		CastKey("Hidetora Ichimonji"), CastKey("Tatsuya Nakadai"))

	mustTx(t, s, func(tx *sql.Tx) error { return LinkCastRow(tx, 1, 1) })

	var charID, actorID int64
	if err := s.DB.QueryRow(
		`SELECT COALESCE(character_id, 0), COALESCE(actor_id, 0) FROM work_cast WHERE id = 1`).
		Scan(&charID, &actorID); err != nil {
		t.Fatal(err)
	}
	if charID == 0 || actorID == 0 {
		t.Fatalf("row linked to character %d and actor %d; both should be records", charID, actorID)
	}
	// Through the reads the panels use, not by looking at the columns: the row
	// carrying an id is not the feature, the character list showing it is.
	got, err := CharacterAppearances(s.DB, 1, charID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Actor != "Tatsuya Nakadai" {
		t.Fatalf("appearances: %+v", got)
	}
}

// PER WORK, NOT PER LIBRARY. The rule the backfill argued for, now enforced where
// rows are actually written: two works naming a Narrator are two Narrators, which
// a reader can see and merge; one Narrator across both would hide a person and
// nothing on any screen would say so.
func TestOneNameOnTwoWorksIsTwoCharacters(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO books (id, user_id, title) VALUES (1, 1, 'The Third Man'), (2, 1, 'Rebecca')`)
	exec(`INSERT INTO work_cast (id, user_id, kind, work_id, character, character_key)
	      VALUES (1, 1, 'book', 1, 'Narrator', ?), (2, 1, 'book', 2, 'Narrator', ?)`,
		CastKey("Narrator"), CastKey("Narrator"))
	mustTx(t, s, func(tx *sql.Tx) error {
		if err := LinkCastRow(tx, 1, 1); err != nil {
			return err
		}
		return LinkCastRow(tx, 1, 2)
	})

	var a, b int64
	if err := s.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = 1`).Scan(&a); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = 2`).Scan(&b); err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatalf("two works' Narrators welded into one record (%d)", a)
	}
}

// WITHIN ONE WORK IT DOES COLLAPSE — child and adult casting are two cast rows
// about one character, which is what actor_id being per row is for.
func TestOneNameTwiceOnOneWorkIsOneCharacter(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'The Godfather Part II')`)
	exec(`INSERT INTO work_cast (id, user_id, kind, work_id, character, character_key, actor, actor_key)
	      VALUES (1, 1, 'movie', 1, 'Vito Corleone', ?, 'Robert De Niro', ?),
	             (2, 1, 'movie', 1, 'vito corleone', ?, 'Marlon Brando', ?)`,
		CastKey("Vito Corleone"), CastKey("Robert De Niro"),
		CastKey("vito corleone"), CastKey("Marlon Brando"))
	mustTx(t, s, func(tx *sql.Tx) error {
		if err := LinkCastRow(tx, 1, 1); err != nil {
			return err
		}
		return LinkCastRow(tx, 1, 2)
	})

	var a, b int64
	if err := s.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = 1`).Scan(&a); err != nil {
		t.Fatal(err)
	}
	if err := s.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = 2`).Scan(&b); err != nil {
		t.Fatal(err)
	}
	if a != b {
		t.Fatalf("one work's two Vitos are two records (%d, %d)", a, b)
	}
	got, err := CharacterAppearances(s.DB, 1, a)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("one character, two castings: %+v", got)
	}
}

// A LINK ALREADY ON THE ROW IS SOMEBODY'S DECISION. Correcting the spelling this
// work prints must not re-aim the record — that would turn a typo fix into a
// silent identity change on every other work the record appears on.
func TestLinkingLeavesADeliberatePickAlone(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Solaris')`)
	var picked int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		picked, err = ResolveCharacter(tx, 1, "Kris Kelvin")
		return err
	})
	exec(`INSERT INTO work_cast (id, user_id, kind, work_id, character, character_key, character_id)
	      VALUES (1, 1, 'movie', 1, 'Chris Kelvin', ?, ?)`, CastKey("Chris Kelvin"), picked)

	mustTx(t, s, func(tx *sql.Tx) error { return LinkCastRow(tx, 1, 1) })

	var got int64
	if err := s.DB.QueryRow(`SELECT character_id FROM work_cast WHERE id = 1`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != picked {
		t.Fatalf("the pick was re-aimed from %d to %d", picked, got)
	}
	var chars int
	if err := s.DB.QueryRow(`SELECT count(*) FROM characters WHERE user_id = 1`).Scan(&chars); err != nil {
		t.Fatal(err)
	}
	if chars != 1 {
		t.Fatalf("a second record was made for a row that already had one (%d)", chars)
	}
}

// THE ACTOR RESOLVES BY NAME, unlike the character, and that asymmetry is worth
// a test rather than a comment: an actor who is already in the library as an
// author is ONE human being, and the credit and the role belong on one record.
func TestAnActorOnACastRowJoinsTheRecordTheLibraryAlreadyHas(t *testing.T) {
	s := openIdentity(t)
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Wise Blood', 'Orson Welles')`)
	exec(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Citizen Kane')`)
	seps := metadata.DefaultCreditSeps
	var author int64
	mustTx(t, s, func(tx *sql.Tx) error {
		if err := SetCredits(tx, 1, "book", 1, RoleAuthor, []string{"Orson Welles"}, seps); err != nil {
			return err
		}
		var err error
		author, err = ResolvePerson(tx, 1, "Orson Welles")
		return err
	})
	exec(`INSERT INTO work_cast (id, user_id, kind, work_id, character, character_key, actor, actor_key)
	      VALUES (1, 1, 'movie', 1, 'Charles Foster Kane', ?, 'Orson Welles', ?)`,
		CastKey("Charles Foster Kane"), CastKey("Orson Welles"))
	mustTx(t, s, func(tx *sql.Tx) error { return LinkCastRow(tx, 1, 1) })

	var got int64
	if err := s.DB.QueryRow(`SELECT actor_id FROM work_cast WHERE id = 1`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != author {
		t.Fatalf("the performer is record %d, the author is record %d — one person, two records", got, author)
	}
}

// A MERGE MAY TAKE A SPELLING SOMEBODY ELSE HOLDS, AND UNDO MUST GIVE IT BACK.
// Filing the dropped record's name as an alias is an UPSERT, so it can land on a
// key a third record already owns. The reversal used to answer that with a plain
// DELETE — which put the two merged records back and destroyed an alias the merge
// never made, on a record nobody touched.
func TestUndoingAMergeGivesBackAnAliasItOverwrote(t *testing.T) {
	s := openIdentity(t)
	seps := metadata.DefaultCreditSeps
	var keep, drop, third int64
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		if keep, err = ResolvePerson(tx, 1, "Mikhail Bulgakov"); err != nil {
			return err
		}
		if drop, err = ResolvePerson(tx, 1, "Bulgakov the second"); err != nil {
			return err
		}
		if third, err = ResolvePerson(tx, 1, "Elena Bulgakova"); err != nil {
			return err
		}
		// The third record answers to a spelling of its own...
		return AddPersonAlias(tx, 1, third, "M. Bulgakov")
	})
	// ...and only then is the record about to be dropped renamed onto it. A rename
	// writes the name column and asks the alias table nothing, which is how a
	// person and somebody else's spelling come to be the same string.
	if _, err := s.DB.Exec(`UPDATE people SET name = 'M. Bulgakov' WHERE id = ?`, drop); err != nil {
		t.Fatal(err)
	}

	var undo *MergeUndo
	mustTx(t, s, func(tx *sql.Tx) error {
		var err error
		undo, err = MergePeople(tx, 1, keep, drop, seps)
		return err
	})
	mustTx(t, s, func(tx *sql.Tx) error { return UndoPersonMerge(tx, 1, undo, seps) })

	var got int64
	if err := s.DB.QueryRow(
		`SELECT person_id FROM person_alias WHERE user_id = 1 AND alias_key = ?`,
		CastKey("M. Bulgakov")).Scan(&got); err != nil {
		t.Fatalf("the spelling stopped existing after an undo: %v", err)
	}
	// It went back to the record that held it, not to either of the merged pair.
	if got != third {
		t.Fatalf("the spelling now finds record %d; it belonged to %d", got, third)
	}
}
