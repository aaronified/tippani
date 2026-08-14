package store

import (
	"os"
	"path/filepath"
	"testing"
)

// TestRecover reproduces the owner's exact failure — structural page corruption
// of the annotations_fts_data b-tree, so that MATCH and even DROP TABLE raise
// "database disk image is malformed" — then proves Recover rebuilds the database
// from the intact base tables with every row preserved and search working again.
func TestRecover(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "t.db")
	st, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExec := func(q string, a ...any) {
		t.Helper()
		if _, e := st.DB.Exec(q, a...); e != nil {
			t.Fatalf("%s: %v", q, e)
		}
	}
	mustExec(`INSERT INTO users (username, password_hash) VALUES ('a','x')`)
	mustExec(`INSERT INTO books (user_id, title) VALUES (1,'Moby Dick')`)
	const N = 300
	for i := 0; i < N; i++ {
		mustExec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, ?, 'manual', ?)`,
			"whaleword keyword passage number this and that here", i)
	}
	// Non-fts base data that must survive the recovery untouched.
	mustExec(`INSERT INTO movies (user_id, title) VALUES (1,'Heat')`)
	mustExec(`INSERT INTO dialogues (movie_id, quote, dedupe_hash) VALUES (1,'boom','d1')`)
	mustExec(`INSERT INTO settings (key, value) VALUES ('tmdb_key','secret')`)

	// Flush WAL into the main file, then find the shadow index b-tree's root page.
	mustExec(`PRAGMA wal_checkpoint(TRUNCATE)`)
	var rootpage, pageSize int
	if err := st.DB.QueryRow(`SELECT rootpage FROM sqlite_master WHERE name='annotations_fts_data'`).Scan(&rootpage); err != nil {
		t.Fatal(err)
	}
	if err := st.DB.QueryRow(`PRAGMA page_size`).Scan(&pageSize); err != nil {
		t.Fatal(err)
	}
	st.Close()

	// Overwrite the shadow table's root page with garbage → structural corruption.
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	garbage := make([]byte, pageSize)
	for i := range garbage {
		garbage[i] = 0xA5
	}
	if _, err := f.WriteAt(garbage, int64((rootpage-1)*pageSize)); err != nil {
		t.Fatal(err)
	}
	f.Close()

	// Reopen: the app still starts, base data still reads, but the index is dead.
	st, err = Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer st.Close()
	var baseN int
	if err := st.DB.QueryRow(`SELECT count(*) FROM annotations`).Scan(&baseN); err != nil {
		t.Fatalf("base annotations unreadable — corruption spread too far: %v", err)
	}
	if baseN != N {
		t.Fatalf("base annotations = %d, want %d", baseN, N)
	}
	var x int
	matchErr := st.DB.QueryRow(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH 'keyword'`).Scan(&x)
	t.Logf("MATCH after corruption: err=%v", matchErr)
	_, dropErr := st.DB.Exec(`DROP TABLE annotations_fts`)
	t.Logf("DROP after corruption: err=%v", dropErr)
	// The point of Recover is exactly the case dropErr != nil; log it either way.

	if err := st.Recover(); err != nil {
		t.Fatalf("Recover failed: %v", err)
	}

	// Search works again and every base row survived.
	if err := st.DB.QueryRow(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH 'keyword'`).Scan(&x); err != nil {
		t.Fatalf("search still failing after recover: %v", err)
	}
	if x != N {
		t.Fatalf("search hits %d, want %d", x, N)
	}
	check := func(q string, want int) {
		t.Helper()
		var n int
		if err := st.DB.QueryRow(q).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		if n != want {
			t.Fatalf("%s = %d, want %d", q, n, want)
		}
	}
	check(`SELECT count(*) FROM annotations`, N)
	check(`SELECT count(*) FROM users`, 1)
	check(`SELECT count(*) FROM books`, 1)
	check(`SELECT count(*) FROM movies`, 1)
	check(`SELECT count(*) FROM dialogues`, 1)
	var secret string
	if err := st.DB.QueryRow(`SELECT value FROM settings WHERE key='tmdb_key'`).Scan(&secret); err != nil || secret != "secret" {
		t.Fatalf("settings not preserved: %q %v", secret, err)
	}
	if !st.CheckIntegrity() {
		t.Fatal("database still corrupt after recover")
	}
	// Triggers work post-recover.
	mustExec = func(q string, a ...any) {
		t.Helper()
		if _, e := st.DB.Exec(q, a...); e != nil {
			t.Fatalf("%s: %v", q, e)
		}
	}
	mustExec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1,'freshwordxyz','manual','post')`)
	if err := st.DB.QueryRow(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH 'freshwordxyz'`).Scan(&x); err != nil || x != 1 {
		t.Fatalf("triggers not working post-recover: %d %v", x, err)
	}
}

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

// TestRepairIndex covers the runtime self-heal primitive the live search path
// uses (Server.ftsQuery → Store.RepairIndex): a single named index reconstructed
// in place from content while the server is running. Same DROP+recreate+rebuild
// mechanism as ReindexFTS but scoped to one table. Plants a stray entry, repairs,
// and proves the index is re-derived from content and the sync triggers survive.
func TestRepairIndex(t *testing.T) {
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

	// Stray index entry with no backing content row — must vanish on repair.
	exec(`INSERT INTO annotations_fts(rowid, quote, note) VALUES (999, 'phantom ghost', '')`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"phantom"`); n != 1 {
		t.Fatalf("stray entry not present before repair: got %d", n)
	}

	if err := st.RepairIndex("annotations_fts"); err != nil {
		t.Fatalf("RepairIndex: %v", err)
	}

	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"ishmael"`); n != 1 {
		t.Fatalf("real row missing after repair: got %d", n)
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"phantom"`); n != 0 {
		t.Fatalf("stray entry survived repair: got %d", n)
	}
	// Triggers restored by the repair: a fresh insert indexes.
	exec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'the doubloon', 'manual', 'h2')`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"doubloon"`); n != 1 {
		t.Fatalf("insert trigger not restored after repair: got %d", n)
	}
}

// TestCheckpoint proves the graceful-shutdown WAL checkpoint (Store.Checkpoint)
// runs without error on a healthy database with a populated WAL.
func TestCheckpoint(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	if _, err := st.DB.Exec(`INSERT INTO users (username, password_hash) VALUES ('a','x')`); err != nil {
		t.Fatal(err)
	}
	if err := st.Checkpoint(); err != nil {
		t.Fatalf("Checkpoint: %v", err)
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

// EVERY FTS INDEX IN THE SCHEMA MUST BE IN ftsTables, and this is the only thing
// that makes that true.
//
// utterances_fts was missing from the list from 0026 until 1.13.1. Nothing failed:
// the repair path existed and worked, it was simply never pointed at that index, so
// a corrupt standalone-quote index survived every restart while search over quotes
// returned wrong or missing rows with nothing in the log to explain it. An unchecked
// index is indistinguishable from a healthy one right up until it isn't.
//
// The list is the shape that rots — adding an index is two edits and only one of
// them used to be enforced — so the schema itself is the source of truth here.
func TestEveryFTSIndexIsIntegrityChecked(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	rows, err := st.DB.Query(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%\_fts' ESCAPE '\' ORDER BY name`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var inSchema []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatal(err)
		}
		inSchema = append(inSchema, n)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	// A guard on the guard: if the pattern stops matching, this test would pass by
	// finding nothing and the rot it exists to prevent would be back.
	if len(inSchema) < 4 {
		t.Fatalf("only %d FTS tables found (%v) — the query is wrong, not the schema", len(inSchema), inSchema)
	}

	listed := map[string]bool{}
	for _, n := range ftsTables {
		listed[n] = true
	}
	for _, n := range inSchema {
		if !listed[n] {
			t.Errorf("%s is an FTS index in the schema and is NOT in ftsTables, so it is never "+
				"integrity-checked or rebuilt — corruption in it would survive every restart", n)
		}
	}
	// And the other direction: a name in the list that no longer exists means the
	// repair sweep is checking a table that is gone, which logs an error every boot.
	have := map[string]bool{}
	for _, n := range inSchema {
		have[n] = true
	}
	for _, n := range ftsTables {
		if !have[n] {
			t.Errorf("ftsTables names %q, which is not in the schema", n)
		}
	}
}
