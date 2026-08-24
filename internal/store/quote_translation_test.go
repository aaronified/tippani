package store

import (
	"path/filepath"
	"testing"
)

// Migration 0051 puts `translation` on the two kinds that did not have it, and
// puts it in their two search indexes.
//
// THE FAILING-FIRST TEST IS THE FIRST ONE BELOW, and like 0047's it is a test for
// a live loss rather than for a new feature. This app's own Markdown export has
// been an importer's source since the beginning, and quote_markdown.go has read a
// `translation:` binding since 0035 — on the quote side only. A reader who wrote
// one on a book highlight got a successful import, matching counts, and no
// translation, which is the exact failure 0034 supplied the proof for.

// openAt50 returns a store at the pre-0051 schema: translation on utterances
// only.
func openAt50(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 50)
	return s
}

func TestBeforeTheMigrationOnlyOneKindCouldBeTranslated(t *testing.T) {
	s := openAt50(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'reader', 'x')`)
	exec(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Gitanjali')`)

	// The column the whole migration is about. If this INSERT succeeds at 50 then
	// something else already added it and this test is measuring the wrong thing.
	if err := tryExec(t, s,
		`INSERT INTO annotations (id, book_id, quote, source, dedupe_hash, translation)
		 VALUES (1, 1, 'আমার এ গান', 'manual', 'h1', 'This song of mine')`); err == nil {
		t.Fatal("annotations.translation exists at the 0050 schema — this migration is not the one that adds it")
	}
	// And the third kind's, which has had it since 0035 — the asymmetry being closed.
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, dedupe_hash, translation)
	            VALUES (1, 1, 'যে সয় সে রয়', 'h2', 'who endures, remains')`)
}

// migrated returns a store at HEAD with one user, one book and one film.
func migrated(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	exec(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'reader', 'x')`)
	exec(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Gitanjali')`)
	exec(t, s, `INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'Pather Panchali')`)
	return s
}

// The default has to be the ZERO value, which is 0045's rule for every column
// added to an existing table: an upgraded row must read exactly like a fresh one,
// so no scanner anywhere needs a pointer to tell "never set" from "set to empty".
func TestATranslationOnAnOldRowReadsAsEmptyRatherThanNull(t *testing.T) {
	s := migrated(t)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, source, dedupe_hash)
	            VALUES (1, 1, 'no translation here', 'manual', 'h1')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, dedupe_hash)
	            VALUES (1, 1, 'nor here', 'h2')`)

	for _, tc := range []struct{ what, query string }{
		{"annotation", `SELECT translation IS NULL, translation FROM annotations WHERE id = 1`},
		{"dialogue", `SELECT translation IS NULL, translation FROM dialogues WHERE id = 1`},
	} {
		var isNull bool
		var got string
		if err := s.DB.QueryRow(tc.query).Scan(&isNull, &got); err != nil {
			t.Fatalf("%s: %v", tc.what, err)
		}
		if isNull {
			t.Errorf("%s.translation is NULL — the column has to default to the empty string, not to nothing", tc.what)
		}
		if got != "" {
			t.Errorf("%s.translation defaulted to %q, want empty", tc.what, got)
		}
	}
}

// The index is the point of the migration's second half: a translation exists so
// the half of the line the reader can actually type is written down, and an index
// that does not hold it means typing that half finds nothing.
func TestBothIndexesFindAQuoteByItsTranslation(t *testing.T) {
	s := migrated(t)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, source, dedupe_hash, translation)
	            VALUES (1, 1, 'আমার এ গান ছেড়েছে তার সকল অলংকার', 'manual', 'h1',
	                    'This song of mine has put away its adornments')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, dedupe_hash, translation)
	            VALUES (1, 1, 'দুর্গা, ওঠ', 'h2', 'Durga, get up')`)

	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"adornments"`); n != 1 {
		t.Errorf("annotations_fts did not index the translation: got %d", n)
	}
	if n := count(`SELECT count(*) FROM dialogues_fts WHERE dialogues_fts MATCH ?`, `"get up"`); n != 1 {
		t.Errorf("dialogues_fts did not index the translation: got %d", n)
	}
	// Column-scoped, which is what search_handler.go's ftsCols actually sends — a
	// translation indexed under the wrong column name would still pass the
	// cross-column match above.
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `translation : "adornments"`); n != 1 {
		t.Errorf("annotations_fts has the translation under the wrong column: got %d", n)
	}
	if n := count(`SELECT count(*) FROM dialogues_fts WHERE dialogues_fts MATCH ?`, `translation : "get up"`); n != 1 {
		t.Errorf("dialogues_fts has the translation under the wrong column: got %d", n)
	}

	// The three sync triggers, which are the half of an FTS rebuild that is easy to
	// get wrong: a recreated virtual table with a stale trigger list indexes the
	// row it was rebuilt from and nothing afterwards.
	exec(t, s, `UPDATE annotations SET translation = 'this song has shed its ornaments' WHERE id = 1`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"adornments"`); n != 0 {
		t.Errorf("the update trigger left the old translation in the index: got %d", n)
	}
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"ornaments"`); n != 1 {
		t.Errorf("the update trigger did not index the new translation: got %d", n)
	}
	exec(t, s, `DELETE FROM dialogues WHERE id = 1`)
	if n := count(`SELECT count(*) FROM dialogues_fts WHERE dialogues_fts MATCH ?`, `"get up"`); n != 0 {
		t.Errorf("the delete trigger left a deleted line's translation in the index: got %d", n)
	}
}

// The rebuild has to leave the OTHER columns of both indexes exactly where they
// were. `translation` is appended rather than slotted in beside `note` precisely
// so that nothing already indexed moves, and a column-scoped MATCH is the only
// thing that can tell.
func TestTheRebuiltIndexesKeepEveryColumnTheyHad(t *testing.T) {
	s := migrated(t)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, note, character, source, dedupe_hash)
	            VALUES (1, 1, 'quotewordone', 'notewordone', 'Charulata', 'manual', 'h1')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, note, character, actor, dedupe_hash)
	            VALUES (1, 1, 'quotewordtwo', 'notewordtwo', 'Apu', 'Subir Banerjee', 'h2')`)

	for _, tc := range []struct {
		table, col, term string
	}{
		{"annotations_fts", "quote", "quotewordone"},
		{"annotations_fts", "note", "notewordone"},
		{"annotations_fts", "character", "Charulata"},
		{"dialogues_fts", "quote", "quotewordtwo"},
		{"dialogues_fts", "note", "notewordtwo"},
		{"dialogues_fts", "character", "Apu"},
		{"dialogues_fts", "actor", "Banerjee"},
	} {
		var n int
		q := `SELECT count(*) FROM ` + tc.table + ` WHERE ` + tc.table + ` MATCH ?`
		if err := s.DB.QueryRow(q, tc.col+` : "`+tc.term+`"`).Scan(&n); err != nil {
			t.Fatalf("%s.%s: %v", tc.table, tc.col, err)
		}
		if n != 1 {
			t.Errorf("%s lost its %s column in the rebuild: matching %q got %d", tc.table, tc.col, tc.term, n)
		}
	}
}

// fts5vocab resolves its target by name, so the shadows survive the target being
// dropped and recreated under them (0035 says so; this is the test that means it).
// The corrector reads these, and a broken one degrades typo tolerance silently.
func TestTheVocabShadowsStillWorkAfterTheRebuild(t *testing.T) {
	s := migrated(t)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, source, dedupe_hash, translation)
	            VALUES (1, 1, 'quoteword', 'manual', 'h1', 'translationword')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, dedupe_hash, translation)
	            VALUES (1, 1, 'lineword', 'h2', 'meaningword')`)

	for _, tc := range []struct{ vocab, term string }{
		{"annotations_fts_vocab", "translationword"},
		{"dialogues_fts_vocab", "meaningword"},
	} {
		var n int
		if err := s.DB.QueryRow(`SELECT count(*) FROM `+tc.vocab+` WHERE term = ?`, tc.term).Scan(&n); err != nil {
			t.Fatalf("%s: %v", tc.vocab, err)
		}
		if n != 1 {
			t.Errorf("%s does not know the term %q from the rebuilt index: got %d", tc.vocab, tc.term, n)
		}
	}
}

// The other triggers on these two tables are NOT the FTS ones and must not have
// been dropped with them: item_reviews_book_del and item_reviews_screen_del
// (0015/0018) take a quote's review schedule with it, and a migration that
// rebuilt the base tables — or dropped triggers by a loose name match — would
// leave orphan schedule rows pointing at ids that no longer exist.
func TestTheReviewCleanupTriggersSurvivedTheRebuild(t *testing.T) {
	s := migrated(t)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, source, dedupe_hash) VALUES (1, 1, 'a', 'manual', 'h1')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, dedupe_hash) VALUES (1, 1, 'd', 'h2')`)
	// No user_id on this table: it is keyed (kind, item_id) and reaches the owner
	// through the quote, which is why the two triggers below are the only thing
	// keeping it from accumulating rows for ids that no longer exist.
	exec(t, s, `INSERT INTO item_reviews (kind, item_id, last_touched_at) VALUES ('book', 1, datetime('now'))`)
	exec(t, s, `INSERT INTO item_reviews (kind, item_id, last_touched_at) VALUES ('screen', 1, datetime('now'))`)

	exec(t, s, `DELETE FROM annotations WHERE id = 1`)
	exec(t, s, `DELETE FROM dialogues WHERE id = 1`)

	var n int
	if err := s.DB.QueryRow(`SELECT count(*) FROM item_reviews`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("%d review row(s) outlived the quote they schedule — a trigger was dropped with the index", n)
	}
}
