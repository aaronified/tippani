package store

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
)

// TestFTSVocab covers the fts5vocab views added in migration 0016 (typo-tolerant
// search): they exist after migrate, reflect trigger-synced content via doc
// counts, survive a base-index rebuild (fts5vocab resolves its target index by
// name at query time — the §1 "inferred" fact), and come back after a
// whole-database Recover().
func TestFTSVocab(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	mustExec := func(q string, a ...any) {
		t.Helper()
		if _, e := st.DB.Exec(q, a...); e != nil {
			t.Fatalf("%s: %v", q, e)
		}
	}

	// doc returns the fts5vocab 'doc' count for a term (documents containing it),
	// and whether the term is present at all.
	doc := func(table, term string) (int, bool) {
		t.Helper()
		var n int
		err := st.DB.QueryRow(`SELECT doc FROM `+table+` WHERE term = ?`, term).Scan(&n)
		if errors.Is(err, sql.ErrNoRows) {
			return 0, false
		}
		if err != nil {
			t.Fatalf("%s vocab read for %q: %v", table, term, err)
		}
		return n, true
	}

	mustExec(`INSERT INTO users (username, password_hash) VALUES ('alice','x')`)
	mustExec(`INSERT INTO books (user_id, title, author) VALUES (1, 'The Shawshank Redemption', 'Stephen King')`)

	// Terms land in the vocab, folded the same way the index folds them.
	if _, ok := doc("books_fts_vocab", "shawshank"); !ok {
		t.Fatal("books_fts_vocab missing 'shawshank' after insert")
	}
	// A second book by the same author bumps 'king' to two documents; a delete
	// drops it back — proving the vocab tracks the trigger-synced index live.
	mustExec(`INSERT INTO books (user_id, title, author) VALUES (1, 'It', 'Stephen King')`)
	if n, _ := doc("books_fts_vocab", "king"); n != 2 {
		t.Fatalf("vocab doc for 'king' after 2 books = %d, want 2", n)
	}
	mustExec(`DELETE FROM books WHERE title = 'It'`)
	if n, _ := doc("books_fts_vocab", "king"); n != 1 {
		t.Fatalf("vocab doc for 'king' after delete = %d, want 1", n)
	}

	// §1 inferred fact #1: rebuildFTSTable DROPs + recreates books_fts while
	// books_fts_vocab still references it by name. The vocab must keep working.
	if err := st.rebuildFTSTable("books_fts"); err != nil {
		t.Fatalf("rebuildFTSTable with vocab present: %v", err)
	}
	if _, ok := doc("books_fts_vocab", "shawshank"); !ok {
		t.Fatal("books_fts_vocab broken after a base-index rebuild")
	}

	// §1 inferred fact #2: Recover() copies base tables into a fresh file (vocab
	// tables excluded by the %_fts_% name pattern) and re-migrates. All four vocab
	// views must be queryable afterward and still reflect content.
	if err := st.Recover(); err != nil {
		t.Fatalf("Recover with vocab present: %v", err)
	}
	if _, ok := doc("books_fts_vocab", "shawshank"); !ok {
		t.Fatal("books_fts_vocab broken after Recover")
	}
	for _, tbl := range []string{"books_fts_vocab", "annotations_fts_vocab", "movies_fts_vocab", "dialogues_fts_vocab"} {
		if _, err := st.DB.Exec(`SELECT count(*) FROM ` + tbl); err != nil {
			t.Fatalf("%s not queryable after Recover: %v", tbl, err)
		}
	}
}
