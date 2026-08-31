package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

// The 3.1.0 dial pass: a withdrawn position becomes the nearest one that still
// exists, and nothing else is touched.
//
// WHAT MAKES THIS WORTH A TEST rather than a reading of the SQL: the failure mode
// is silent and it is a reader's interface halving in size. clampFactor sends an
// unknown factor to 100, so a 200 left in the document does not error, does not
// log, and does not look wrong in the database — it just renders at the designed
// size the next time somebody opens the app.
func TestTheDialPassMovesTwoHundredToOneSevenFive(t *testing.T) {
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
	// One reader at the top of the old dial on every role, one who set only the
	// interface, one at a position that still exists, one who never chose — and
	// one whose document does not parse, which must not take the others down
	// with it.
	exec(`INSERT INTO users (id, username, password_hash, is_admin, preferences) VALUES
	      (1, 'alice', 'x', 1, '{"sizeDisplay":200,"sizeUi":200,"sizeMono":200,"sizeHand":200}'),
	      (2, 'bob',   'x', 0, '{"sizeUi":200,"sizeMono":125}'),
	      (3, 'carol', 'x', 0, '{"sizeUi":150}'),
	      (4, 'dave',  'x', 0, '{}'),
	      (5, 'erin',  'x', 0, 'not json at all')`)

	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := moveTypeDialOffTwoHundred(tx, OneTimeEnv{FreshInstall: false}); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	dial := func(uid int64, key string) any {
		t.Helper()
		var v sql.NullInt64
		if err := s.DB.QueryRow(
			`SELECT json_extract(preferences, '$.'||?) FROM users WHERE id = ?`, key, uid).Scan(&v); err != nil {
			t.Fatalf("read %s for %d: %v", key, uid, err)
		}
		if !v.Valid {
			return nil
		}
		return int(v.Int64)
	}

	for _, key := range typeDialKeys {
		if got := dial(1, key); got != 175 {
			t.Fatalf("alice's %s is %v, want 175", key, got)
		}
	}
	if got := dial(2, "sizeUi"); got != 175 {
		t.Fatalf("bob's sizeUi is %v, want 175", got)
	}
	// A DIAL THE READER SET TO SOMETHING ELSE IS NOT THIS PASS'S BUSINESS.
	if got := dial(2, "sizeMono"); got != 125 {
		t.Fatalf("bob's sizeMono moved to %v; only 200 should have been touched", got)
	}
	if got := dial(3, "sizeUi"); got != 150 {
		t.Fatalf("carol's sizeUi moved to %v", got)
	}
	// AND A ROLE NOBODY CHOSE STAYS ABSENT, rather than being written as 175 —
	// an unset dial means "follow the designed size", which is not 175.
	if got := dial(2, "sizeHand"); got != nil {
		t.Fatalf("bob's unset sizeHand was written as %v", got)
	}
	if got := dial(4, "sizeUi"); got != nil {
		t.Fatalf("dave chose nothing, yet sizeUi read back as %v", got)
	}
	// AND THE UNREADABLE DOCUMENT IS STILL THERE, untouched and unexploded: the
	// pass skipped it rather than failing for everybody because of it.
	var raw string
	if err := s.DB.QueryRow(`SELECT preferences FROM users WHERE id = 5`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	if raw != "not json at all" {
		t.Fatalf("the unparseable document became %q", raw)
	}
}

// A FRESH DATABASE HAS NOTHING TO MOVE, and saying so is the field every pass
// that reasons about history has to check. It still records itself, so it is
// never asked again.
func TestTheDialPassLeavesAFreshInstallAlone(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash, is_admin, preferences)
		 VALUES (1, 'alice', 'x', 1, '{"sizeUi":200}')`); err != nil {
		t.Fatal(err)
	}
	tx, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if err := moveTypeDialOffTwoHundred(tx, OneTimeEnv{FreshInstall: true}); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	var v int
	if err := s.DB.QueryRow(`SELECT json_extract(preferences, '$.sizeUi') FROM users WHERE id = 1`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	if v != 200 {
		t.Fatalf("a fresh install's document was rewritten to %d", v)
	}
}
