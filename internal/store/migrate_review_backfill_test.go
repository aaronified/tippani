package store

import (
	"path/filepath"
	"testing"
)

// The skip that never reached the quotes it was supposed to skip.
//
// 0033 made the deck read two flags — the quote's own and its work's — so
// excluding a book took its highlights out of the quiz without writing anything
// on them. 1.15.0 dropped the second term for a good reason and made excluding a
// work a WRITE across its quotes instead, and every live write path does that
// correctly. What nothing did was look backwards: the children of works that were
// already excluded had never needed the flag, and nobody went and gave it to them.
//
// So a book skipped in 1.14 keeps its own flag, keeps drawing its skip mark, reads
// as skipped on every screen — and its highlights are back in the deck the moment
// the reader upgrades. That is the reported bug, and it arrives without a single
// thing on screen changing, which is what makes it worth a migration rather than a
// note in the release: nobody would look.
//
// The state below is not synthesised for the test's convenience. It is exactly
// what a 1.14 database holds after "skip this book" plus one hand-skipped
// highlight, which is the library the bug was reported from.
func TestMigration0046BackfillsExcludedWorksChildren(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	// Stop one short of the backfill, so the seed below is written into the schema
	// the reader's database was actually in.
	migrateThrough(t, s, 45)

	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`)

	// A skipped book with three highlights: one the reader skipped by hand, two
	// that were only ever covered by the book's flag.
	exec(`INSERT INTO books (id, user_id, title, review_excluded) VALUES (1, 1, 'Homo Deus', 1)`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash, review_excluded)
	      VALUES (1, 1, 'The hand-skipped one', 'yellow', 'manual', 'h1', 1)`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash, review_excluded)
	      VALUES (2, 1, 'Covered by the book alone', 'yellow', 'manual', 'h2', 0)`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash, review_excluded)
	      VALUES (3, 1, 'Also covered by the book alone', 'yellow', 'manual', 'h3', 0)`)

	// A book that is NOT skipped, holding one highlight that is. The reader skipped
	// one line on its own account; nothing may undo that.
	exec(`INSERT INTO books (id, user_id, title, review_excluded) VALUES (2, 1, 'Sapiens', 0)`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash, review_excluded)
	      VALUES (4, 2, 'Skipped on its own account', 'yellow', 'manual', 'h4', 1)`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash, review_excluded)
	      VALUES (5, 2, 'In the deck, and staying there', 'yellow', 'manual', 'h5', 0)`)

	// The same shape for a film, because the deck draws from three kinds and the
	// second pair is the one that gets forgotten.
	exec(`INSERT INTO movies (id, user_id, title, review_excluded) VALUES (1, 1, 'Stalker', 1)`)
	exec(`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash, review_excluded)
	      VALUES (1, 1, 'Let everything that has been planned come true.', 'd1', 0)`)
	exec(`INSERT INTO movies (id, user_id, title, review_excluded) VALUES (2, 1, 'Solaris', 0)`)
	exec(`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash, review_excluded)
	      VALUES (2, 2, 'We do not want to conquer space at all.', 'd2', 0)`)

	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	excluded := func(table string, id int64) int {
		t.Helper()
		var v int
		if err := s.DB.QueryRow(`SELECT review_excluded FROM `+table+` WHERE id = ?`, id).Scan(&v); err != nil {
			t.Fatalf("read %s %d: %v", table, id, err)
		}
		return v
	}

	for _, id := range []int64{1, 2, 3} {
		if excluded("annotations", id) != 1 {
			t.Errorf("annotation %d is still in the deck: its book is skipped and the deck reads the "+
				"highlight's own flag, so this card gets asked about anyway", id)
		}
	}
	if excluded("dialogues", 1) != 1 {
		t.Error("dialogue 1 is still in the deck: its film is skipped")
	}

	// One direction only. An included work clears nothing, or the migration would
	// be overruling a decision the reader made by hand on one line.
	if excluded("annotations", 4) != 1 {
		t.Error("annotation 4 was put back in the deck: it was skipped on its own account, " +
			"inside a book that is not skipped")
	}
	// And nothing else moves.
	if excluded("annotations", 5) != 0 {
		t.Error("annotation 5 left the deck: neither it nor its book was ever skipped")
	}
	if excluded("dialogues", 2) != 0 {
		t.Error("dialogue 2 left the deck: neither it nor its film was ever skipped")
	}

	// The work's own flag survives. It has a narrower job since 1.15.0 — the
	// default for quotes added later — and dropping it would break the seeding at
	// insert and the wording of the mark.
	if excluded("books", 1) != 1 {
		t.Error("the book's own flag was cleared: it still seeds the highlights added tomorrow")
	}
	if excluded("movies", 1) != 1 {
		t.Error("the film's own flag was cleared")
	}

	// Re-running finds nothing to do. Migrate() is called on every boot.
	if err := s.Migrate(); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	if excluded("annotations", 4) != 1 || excluded("annotations", 5) != 0 {
		t.Error("a second Migrate() moved rows the first one had settled")
	}
}
