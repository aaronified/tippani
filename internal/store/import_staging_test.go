package store

import (
	"path/filepath"
	"testing"
)

// openAt22 returns a store migrated to the pre-0023 schema and seeded with one
// user, book, movie, annotation and dialogue — the pattern openAt19 established,
// moved forward one release. A from-scratch migration test cannot see what an
// upgrade does to a box that already holds years of highlights.
func openAt22(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 22)

	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1)`)
	exec(`INSERT INTO books (id, user_id, title, author) VALUES (1, 1, 'Invisible Cities', 'Italo Calvino')`)
	exec(`INSERT INTO movies (id, user_id, title, director) VALUES (1, 1, 'Stalker', 'Andrei Tarkovsky')`)
	exec(`INSERT INTO annotations (id, book_id, quote, color, source, dedupe_hash)
	      VALUES (1, 1, 'Cities, like dreams, are made of desires and fears.', 'yellow', 'manual', 'h1')`)
	exec(`INSERT INTO dialogues (id, movie_id, quote, dedupe_hash)
	      VALUES (1, 1, 'Let everything that has been planned come true.', 'h2')`)
	return s
}

func TestMigration0023OnPopulatedDB(t *testing.T) {
	s := openAt22(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}

	for _, tc := range []struct{ table, want string }{
		{"books", "Invisible Cities"},
		{"movies", "Stalker"},
	} {
		var title string
		if err := s.DB.QueryRow(`SELECT title FROM ` + tc.table + ` WHERE id = 1`).Scan(&title); err != nil {
			t.Fatalf("%s row lost: %v", tc.table, err)
		}
		if title != tc.want {
			t.Fatalf("%s title: got %q want %q", tc.table, title, tc.want)
		}
	}
	for _, table := range []string{"annotations", "dialogues"} {
		var n int
		if err := s.DB.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Fatalf("%s: got %d rows want 1", table, n)
		}
	}
	// The staging tables start empty on an upgraded box, not absent.
	for _, table := range []string{"import_batches", "staged_works", "staged_quotes"} {
		var n int
		if err := s.DB.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil {
			t.Fatalf("%s missing after upgrade: %v", table, err)
		}
		if n != 0 {
			t.Fatalf("%s: got %d rows want 0", table, n)
		}
	}
}

// TestMigration0023StagingSchema pins the shape the staging handlers depend on:
// defaults, the colour CHECK, the per-work dedupe UNIQUE, and the two-hop
// cascade that is the only thing scoping staged rows to a user.
func TestMigration0023StagingSchema(t *testing.T) {
	s := openAt22(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}

	mustExec(`INSERT INTO import_batches (id, user_id, source) VALUES (1, 1, 'md')`)
	mustExec(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (1, 1, 'book', 'Dune')`)
	mustExec(`INSERT INTO staged_quotes (id, staged_work_id, quote, dedupe_hash)
	          VALUES (1, 1, 'The spice must flow.', 'sh1')`)

	// Defaults: filename/extra empty strings, colour yellow, not favourite,
	// tags empty, created_at stamped.
	var filename, extra, createdAt, color, tags string
	var favorite int
	if err := s.DB.QueryRow(`SELECT filename, extra, created_at FROM import_batches WHERE id = 1`).
		Scan(&filename, &extra, &createdAt); err != nil {
		t.Fatal(err)
	}
	if filename != "" || extra != "" || createdAt == "" {
		t.Fatalf("batch defaults: filename=%q extra=%q created_at=%q", filename, extra, createdAt)
	}
	if err := s.DB.QueryRow(`SELECT color, favorite, tags FROM staged_quotes WHERE id = 1`).
		Scan(&color, &favorite, &tags); err != nil {
		t.Fatal(err)
	}
	if color != "yellow" || favorite != 0 || tags != "" {
		t.Fatalf("quote defaults: color=%q favorite=%d tags=%q", color, favorite, tags)
	}

	// A staged quote carries BOTH locator sets, so retargeting across kinds
	// cannot destroy the values it arrived with.
	mustExec(`UPDATE staged_quotes SET chapter = 'I', location = 'p.12', location_orig = 'p.12',
	          character = 'Paul', actor = 'Timothée Chalamet', timestamp = '00:12:30',
	          timestamp_orig = '00:12:30' WHERE id = 1`)

	// Colour is one of the four.
	if _, err := s.DB.Exec(`UPDATE staged_quotes SET color = 'chartreuse' WHERE id = 1`); err == nil {
		t.Fatal("expected CHECK violation on an unknown staged colour")
	}

	// Same hash under the same work collapses; under another work it does not.
	if _, err := s.DB.Exec(`INSERT INTO staged_quotes (staged_work_id, quote, dedupe_hash)
	                        VALUES (1, 'The spice must flow.', 'sh1')`); err == nil {
		t.Fatal("expected UNIQUE violation on (staged_work_id, dedupe_hash)")
	}
	mustExec(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (2, 1, 'show', 'Andor')`)
	mustExec(`INSERT INTO staged_quotes (staged_work_id, quote, dedupe_hash)
	          VALUES (2, 'The spice must flow.', 'sh1')`)

	// Deleting the batch takes its works and their quotes; deleting the user
	// takes the batch. That two-hop cascade is the whole ownership story.
	mustExec(`DELETE FROM import_batches WHERE id = 1`)
	if n := count(`SELECT count(*) FROM staged_works`); n != 0 {
		t.Fatalf("staged_works should cascade from the batch, %d left", n)
	}
	if n := count(`SELECT count(*) FROM staged_quotes`); n != 0 {
		t.Fatalf("staged_quotes should cascade from the work, %d left", n)
	}
	mustExec(`INSERT INTO import_batches (id, user_id, source) VALUES (2, 1, 'imdb')`)
	mustExec(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (3, 2, 'movie', 'V for Vendetta')`)
	mustExec(`INSERT INTO staged_quotes (staged_work_id, quote, dedupe_hash) VALUES (3, 'Ideas are bulletproof.', 'sh2')`)
	mustExec(`DELETE FROM users WHERE id = 1`)
	if n := count(`SELECT count(*) FROM import_batches`); n != 0 {
		t.Fatalf("import_batches should cascade on user delete, %d left", n)
	}
	if n := count(`SELECT count(*) FROM staged_quotes`); n != 0 {
		t.Fatalf("staged_quotes should cascade on user delete, %d left", n)
	}
}

// TestStagedTextIsNotSearchable is the property the separate-tables design
// exists for: an unapproved quote must be invisible to full-text search and to
// the review deck. Assert it at the schema level — no FTS table, no triggers, and
// nothing reaching the live indexes — because no handler query names these
// tables, so a leak could only come from schema drift.
func TestStagedTextIsNotSearchable(t *testing.T) {
	s := openAt22(t)
	if err := s.Migrate(); err != nil {
		t.Fatalf("migrate to head: %v", err)
	}
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}

	mustExec(`INSERT INTO import_batches (id, user_id, source) VALUES (1, 1, 'md')`)
	mustExec(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (1, 1, 'book', 'Sandworm Studies')`)
	mustExec(`INSERT INTO staged_quotes (staged_work_id, quote, dedupe_hash)
	          VALUES (1, 'Arrakis teaches the attitude of the knife.', 'sh1')`)
	mustExec(`INSERT INTO staged_works (id, batch_id, kind, title) VALUES (2, 1, 'movie', 'Unapproved Film')`)
	mustExec(`INSERT INTO staged_quotes (staged_work_id, quote, dedupe_hash)
	          VALUES (2, 'Every staged line stays out of the deck.', 'sh2')`)

	// Nothing staged reached any live index.
	for _, tc := range []struct{ table, term string }{
		{"annotations_fts", `"arrakis"`},
		{"books_fts", `"sandworm"`},
		{"dialogues_fts", `"staged"`},
		{"movies_fts", `"unapproved"`},
	} {
		if n := count(`SELECT count(*) FROM `+tc.table+` WHERE `+tc.table+` MATCH ?`, tc.term); n != 0 {
			t.Fatalf("%s matched staged text (%s): %d hits", tc.table, tc.term, n)
		}
	}
	// No base rows were created either — staging writes only its own tables.
	if n := count(`SELECT count(*) FROM annotations`); n != 1 {
		t.Fatalf("annotations: got %d want the 1 seeded row", n)
	}
	if n := count(`SELECT count(*) FROM dialogues`); n != 1 {
		t.Fatalf("dialogues: got %d want the 1 seeded row", n)
	}
	// Repetition state begins at approval.
	if n := count(`SELECT count(*) FROM item_reviews`); n != 0 {
		t.Fatalf("item_reviews: staged quotes must not enter the deck, %d rows", n)
	}

	// No FTS table and no trigger of any kind on the staging tables.
	if n := count(`SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'staged%\_fts%' ESCAPE '\'`); n != 0 {
		t.Fatalf("staging tables must carry no FTS index, found %d", n)
	}
	if n := count(`SELECT count(*) FROM sqlite_master WHERE type = 'trigger'
	               AND tbl_name IN ('import_batches', 'staged_works', 'staged_quotes')`); n != 0 {
		t.Fatalf("staging tables must carry no triggers, found %d", n)
	}
}
