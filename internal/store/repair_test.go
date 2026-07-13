package store

import (
	"path/filepath"
	"testing"
)

// TestFTSRepair drives the reconstruction mechanism both paths use (ReindexFTS /
// RepairFTS → rebuildFTSTable): it plants a stray index entry that isn't backed
// by any content row, then proves a rebuild re-derives the index purely from
// content — the real rows come back, the stray entry is gone, and the sync
// triggers still fire afterwards. (The user's real failure is page-level
// SQLITE_CORRUPT, which the MATCH query and integrity-check both raise; that
// can't be forged deterministically in a test, but it drives this same rebuild.)
func TestFTSRepair(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := st.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}

	exec(`INSERT INTO users (username, password_hash) VALUES ('a', 'x')`)
	exec(`INSERT INTO books (user_id, title) VALUES (1, 'Moby Dick')`)
	exec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'Call me Ishmael', 'manual', 'h1')`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"ishmael"`); n != 1 {
		t.Fatalf("baseline search: got %d", n)
	}

	// Plant a stray index entry for a rowid with no content row, so we can prove
	// a rebuild re-derives the index from content alone (this entry must vanish).
	exec(`INSERT INTO annotations_fts(rowid, quote, note) VALUES (999, 'phantom ghost', '')`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"phantom"`); n != 1 {
		t.Fatalf("stray index entry not present before rebuild: got %d", n)
	}

	// Reconstruct every index (DROP + recreate + rebuild + trigger restore).
	if failed := st.ReindexFTS(); len(failed) != 0 {
		t.Fatalf("ReindexFTS reported failures: %v", failed)
	}

	// The index now matches content: the real row is findable and the stray
	// entry is gone.
	if _, err := st.DB.Exec(`INSERT INTO annotations_fts(annotations_fts) VALUES('integrity-check')`); err != nil {
		t.Fatalf("integrity-check failing after rebuild: %v", err)
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"ishmael"`); n != 1 {
		t.Fatalf("real row missing after rebuild: got %d", n)
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"phantom"`); n != 0 {
		t.Fatalf("stray entry survived rebuild: got %d", n)
	}
	// The sync triggers were captured + restored: insert indexes, update
	// re-indexes, delete removes.
	exec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'the whiteness of the whale', 'manual', 'h2')`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"whiteness"`); n != 1 {
		t.Fatalf("insert trigger not restored: got %d", n)
	}
	exec(`UPDATE annotations SET quote = 'the doubloon' WHERE dedupe_hash = 'h2'`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"doubloon"`); n != 1 {
		t.Fatalf("update trigger not restored: got %d", n)
	}
	exec(`DELETE FROM annotations WHERE dedupe_hash = 'h2'`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"doubloon"`); n != 0 {
		t.Fatalf("delete trigger not restored: got %d", n)
	}

	// RepairFTS on a healthy DB is a no-op (integrity-check passes, nothing
	// reconstructed) and must not error or panic.
	st.RepairFTS()
	// CheckIntegrity passes on a healthy db.
	if !st.CheckIntegrity() {
		t.Fatal("CheckIntegrity reported corruption on a healthy db")
	}
}

// TestReset proves the factory reset wipes the database file and re-initialises
// an empty, usable schema (back to zero users → onboarding).
func TestReset(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	if _, err := st.DB.Exec(`INSERT INTO users (username, password_hash) VALUES ('a', 'x')`); err != nil {
		t.Fatal(err)
	}

	if err := st.Reset(); err != nil {
		t.Fatalf("reset: %v", err)
	}

	var n int
	if err := st.DB.QueryRow(`SELECT count(*) FROM users`).Scan(&n); err != nil {
		t.Fatalf("query after reset (schema should exist): %v", err)
	}
	if n != 0 {
		t.Fatalf("users after reset: %d, want 0 (fresh db)", n)
	}
	// The fresh database is writable.
	if _, err := st.DB.Exec(`INSERT INTO users (username, password_hash) VALUES ('b', 'y')`); err != nil {
		t.Fatalf("insert into fresh db: %v", err)
	}
}
