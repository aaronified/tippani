package store

import (
	"path/filepath"
	"testing"
)

// TestMigrateAndFTS exercises the schema end to end: migrations apply, the
// FTS5 external-content triggers track INSERT/UPDATE/DELETE, per-user schema
// constraints hold.
func TestMigrateAndFTS(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	if err := st.Migrate(); err != nil { // idempotent
		t.Fatal(err)
	}

	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}

	mustExec(`INSERT INTO users (username, password_hash) VALUES ('alice', 'x')`)
	mustExec(`INSERT INTO books (user_id, title, author, genre_text) VALUES (1, 'The Brontë Reader', 'Charlotte Brontë', 'gothic fiction')`)
	mustExec(`INSERT INTO annotations (book_id, quote, note, source, dedupe_hash) VALUES (1, 'Reader, I married him.', 'famous line', 'manual', 'h1')`)

	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := st.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}

	// Search hits via triggers; remove_diacritics matches "Bronte" -> "Brontë".
	if n := count(`SELECT count(*) FROM books_fts WHERE books_fts MATCH ?`, `"bronte"`); n != 1 {
		t.Fatalf("books_fts bronte: got %d", n)
	}
	if n := count(`SELECT count(*) FROM books_fts WHERE books_fts MATCH ?`, `"gothic"`); n != 1 {
		t.Fatalf("books_fts genre: got %d", n)
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"married"`); n != 1 {
		t.Fatalf("annotations_fts: got %d", n)
	}

	// UPDATE trigger re-indexes.
	mustExec(`UPDATE annotations SET quote = 'Call me Ishmael.' WHERE id = 1`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"married"`); n != 0 {
		t.Fatalf("stale FTS row after update: got %d", n)
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"ishmael"`); n != 1 {
		t.Fatalf("annotations_fts after update: got %d", n)
	}

	// DELETE trigger removes the index row.
	mustExec(`DELETE FROM annotations WHERE id = 1`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"ishmael"`); n != 0 {
		t.Fatalf("stale FTS row after delete: got %d", n)
	}

	// CHECK: quote and note cannot both be NULL.
	if _, err := st.DB.Exec(
		`INSERT INTO annotations (book_id, source, dedupe_hash) VALUES (1, 'manual', 'h2')`,
	); err == nil {
		t.Fatal("expected CHECK violation for all-NULL annotation")
	}

	// Dedupe: same (book_id, dedupe_hash) rejected.
	mustExec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'q', 'md', 'h3')`)
	if _, err := st.DB.Exec(
		`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'q', 'md', 'h3')`,
	); err == nil {
		t.Fatal("expected UNIQUE violation for duplicate dedupe_hash")
	}
}
