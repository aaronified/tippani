package store

import (
	"database/sql"
	"path/filepath"
	"testing"
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
