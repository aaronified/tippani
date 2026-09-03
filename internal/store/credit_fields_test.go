package store

import (
	"path/filepath"
	"testing"
)

// 0063: the columns the character screens need, and the index rule that changed.
//
// THE FAILING-FIRST TEST IS THE SECOND ONE, and it is for a live refusal rather
// than a new feature. The design pack's film screen holds two credits on one
// character with nobody named on either — a flashback nobody has cast and a
// Bengali dub nobody has named — and idx_work_cast_pair treated both as the same
// row, because an unnamed credit's actor_key is '' and the index was unique on
// the pair. So the second one answered a constraint error on a screen whose
// stated position is that a credit with nobody named is a legitimate state.

func openMigrated(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return s
}

func columnsOf(t *testing.T, s *Store, table string) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	rows, err := s.DB.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatal(err)
		}
		out[n] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

// EACH COLUMN NAMED RATHER THAN COUNTED. A migration that adds five of six
// columns leaves a screen with one silently empty field, which reads to the
// reader as "nobody has filled this in" — the failure a column that looks usable
// produces, and the one this repo's own invariant is written against.
func TestTheCreditAndCharacterColumnsExist(t *testing.T) {
	s := openMigrated(t)
	for table, want := range map[string][]string{
		"work_cast":       {"credit_note", "credit_lang", "part", "first_appears", "age_here", "aliases"},
		"characters":      {"born"},
		"movies":          {"cast_role"},
		"character_alias": {"seq"},
		"person_alias":    {"seq"},
	} {
		got := columnsOf(t, s, table)
		for _, c := range want {
			if !got[c] {
				t.Errorf("%s has no %q", table, c)
			}
		}
	}
	// AND BOOKS DELIBERATELY HAVE NO cast_role. A book performs nobody, and a
	// column offering to say otherwise is a column somebody will one day set.
	if columnsOf(t, s, "books")["cast_role"] {
		t.Error("books grew a cast_role — a book performs nobody")
	}
}

// SEVERAL CREDITS MAY BE WAITING FOR A NAME, which is what the index now allows.
func TestAWorkMayHoldSeveralUnnamedCreditsOnOneCharacter(t *testing.T) {
	s := openMigrated(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash, is_admin)
	                VALUES (1, 'alice', 'x', 1)`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Part 2')`)

	add := func(character, actor string) error {
		_, err := s.DB.Exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key)
		                     VALUES (1, 'movie', 1, ?, ?, ?, ?)`,
			character, CastKey(character), actor, CastKey(actor))
		return err
	}
	// The performer, then the flashback nobody has cast, then a dub nobody has
	// named. Three rows, one character, one film.
	if err := add("Harry", "Daniel Radcliffe"); err != nil {
		t.Fatalf("the named performer: %v", err)
	}
	if err := add("Harry", ""); err != nil {
		t.Fatalf("the first unnamed credit: %v", err)
	}
	if err := add("Harry", ""); err != nil {
		t.Fatalf("a second unnamed credit was refused: %v", err)
	}

	// AND A NAMED DUPLICATE IS STILL REFUSED, which is the case the index was
	// written for: a refetch must not bill one performer twice for one character.
	if err := add("Harry", "Daniel Radcliffe"); err == nil {
		t.Fatal("a duplicate named credit was accepted — the refetch merge relies on it not being")
	}

	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = 1`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Fatalf("the film holds %d credits, want 3", n)
	}
}

// A TOMBSTONE IS STILL OUTSIDE THE RULE. `origin <> 'removed'` was already in the
// index and stays: unlinking a performer and re-adding them must not collide with
// the row that records the unlink.
func TestARemovedCreditDoesNotBlockItsOwnReplacement(t *testing.T) {
	s := openMigrated(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash, is_admin)
	                VALUES (1, 'alice', 'x', 1)`)
	mustExecT(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Part 2')`)
	mustExecT(t, s, `INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key, origin)
	                VALUES (1, 'movie', 1, 'Harry', 'harry', 'Daniel Radcliffe', 'danielradcliffe', 'removed')`)
	if _, err := s.DB.Exec(`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key)
	                        VALUES (1, 'movie', 1, 'Harry', 'harry', 'Daniel Radcliffe', 'danielradcliffe')`); err != nil {
		t.Fatalf("re-adding a removed credit: %v", err)
	}
}
