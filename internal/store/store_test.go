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

	// 0004 dropped the source CHECK (importer list keeps growing) and the
	// rebuild must keep FTS triggers + annotation_tags joins working.
	mustExec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'hardcover keeps the page', 'hardcover_html', 'h4')`)
	if n := count(`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, `"hardcover"`); n != 1 {
		t.Fatalf("annotations_fts after 0004 rebuild: got %d", n)
	}
	mustExec(`INSERT INTO tags (user_id, name) VALUES (1, 'epic')`)
	mustExec(`INSERT INTO annotation_tags (annotation_id, tag_id)
	          SELECT a.id, t.id FROM annotations a, tags t WHERE a.dedupe_hash = 'h4' AND t.name = 'epic'`)
	if n := count(`SELECT count(*) FROM annotation_tags`); n != 1 {
		t.Fatalf("annotation_tags join after rebuild: got %d", n)
	}

	// Dedupe: same (book_id, dedupe_hash) rejected.
	mustExec(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'q', 'md', 'h3')`)
	if _, err := st.DB.Exec(
		`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (1, 'q', 'md', 'h3')`,
	); err == nil {
		t.Fatal("expected UNIQUE violation for duplicate dedupe_hash")
	}

	// Movies + dialogues (migration 0003) mirror the same FTS behaviour.
	mustExec(`INSERT INTO movies (user_id, title, director, genre_text) VALUES (1, 'Casablanca', 'Michael Curtiz', 'drama romance')`)
	mustExec(`INSERT INTO dialogues (movie_id, quote, character, actor, timestamp, dedupe_hash)
	          VALUES (1, 'Here''s looking at you, kid.', 'Rick Blaine', 'Humphrey Bogart', '01:16:05', 'd1')`)
	if n := count(`SELECT count(*) FROM movies_fts WHERE movies_fts MATCH ?`, `"curtiz"`); n != 1 {
		t.Fatalf("movies_fts director: got %d", n)
	}
	// Dialogue search matches quote, character, and actor columns.
	for _, q := range []string{`"looking"`, `"blaine"`, `"bogart"`} {
		if n := count(`SELECT count(*) FROM dialogues_fts WHERE dialogues_fts MATCH ?`, q); n != 1 {
			t.Fatalf("dialogues_fts %s: got %d", q, n)
		}
	}
	mustExec(`UPDATE dialogues SET quote = 'Round up the usual suspects.', character = 'Louis Renault', actor = 'Claude Rains' WHERE id = 1`)
	if n := count(`SELECT count(*) FROM dialogues_fts WHERE dialogues_fts MATCH ?`, `"bogart"`); n != 0 {
		t.Fatalf("stale dialogues_fts row after update: got %d", n)
	}
	mustExec(`DELETE FROM movies WHERE id = 1`) // cascades to dialogues
	if n := count(`SELECT count(*) FROM dialogues_fts WHERE dialogues_fts MATCH ?`, `"suspects"`); n != 0 {
		t.Fatalf("stale dialogues_fts row after cascade delete: got %d", n)
	}

	// Dialogue dedupe: same (movie_id, dedupe_hash) rejected.
	mustExec(`INSERT INTO movies (user_id, title) VALUES (1, 'Heat')`)
	mustExec(`INSERT INTO dialogues (movie_id, quote, dedupe_hash)
	          SELECT id, 'q', 'd2' FROM movies WHERE title = 'Heat'`)
	if _, err := st.DB.Exec(
		`INSERT INTO dialogues (movie_id, quote, dedupe_hash)
		 SELECT id, 'q', 'd2' FROM movies WHERE title = 'Heat'`,
	); err == nil {
		t.Fatal("expected UNIQUE violation for duplicate dialogue dedupe_hash")
	}

	// 0005: users carry a preferences blob, tags carry colour/style (with
	// CHECKed enums), and the settings table exists.
	var prefs string
	if err := st.DB.QueryRow(`SELECT preferences FROM users WHERE id = 1`).Scan(&prefs); err != nil || prefs != "{}" {
		t.Fatalf("preferences default: %q, %v", prefs, err)
	}
	mustExec(`INSERT INTO tags (user_id, name, color, style) VALUES (1, 'styled', 'pink', 'banner')`)
	var color, style string
	if err := st.DB.QueryRow(`SELECT color, style FROM tags WHERE name = 'epic'`).Scan(&color, &style); err != nil ||
		color != "yellow" || style != "sticker" {
		t.Fatalf("tag defaults: %q/%q, %v", color, style, err)
	}
	if _, err := st.DB.Exec(`INSERT INTO tags (user_id, name, color) VALUES (1, 'bad', 'chartreuse')`); err == nil {
		t.Fatal("expected CHECK violation for bad tag color")
	}
	if _, err := st.DB.Exec(`INSERT INTO tags (user_id, name, style) VALUES (1, 'bad', 'hologram')`); err == nil {
		t.Fatal("expected CHECK violation for bad tag style")
	}
	mustExec(`INSERT INTO settings (key, value) VALUES ('k', 'v')`)

	// 0006: books + movies gain favorite/rating (like 0004) + series metadata;
	// movies also gain media_type ('movie'|'show') and a tvdb_id with a per-user
	// partial unique index mirroring tmdb_id.
	var bfav, brating int
	if err := st.DB.QueryRow(`SELECT favorite, rating FROM books WHERE id = 1`).Scan(&bfav, &brating); err != nil || bfav != 0 || brating != 0 {
		t.Fatalf("book favorite/rating defaults: %d/%d, %v", bfav, brating, err)
	}
	if _, err := st.DB.Exec(`INSERT INTO books (user_id, title, rating) VALUES (1, 'over-rated', 9)`); err == nil {
		t.Fatal("expected CHECK violation for book rating > 5")
	}
	mustExec(`UPDATE books SET favorite = 1, rating = 5, series = 'Discworld', series_index = 2 WHERE id = 1`)
	// media_type defaults to 'movie'; a show + tvdb_id round-trips.
	mustExec(`INSERT INTO movies (user_id, title, media_type, tvdb_id, series, series_index) VALUES (1, 'Andor', 'show', 12345, 'Star Wars', 1)`)
	var mt string
	if err := st.DB.QueryRow(`SELECT media_type FROM movies WHERE title = 'Andor'`).Scan(&mt); err != nil || mt != "show" {
		t.Fatalf("movie media_type: %q, %v", mt, err)
	}
	if err := st.DB.QueryRow(`SELECT media_type FROM movies WHERE title = 'Heat'`).Scan(&mt); err != nil || mt != "movie" {
		t.Fatalf("movie media_type default: %q, %v", mt, err)
	}
	if _, err := st.DB.Exec(`INSERT INTO movies (user_id, title, tvdb_id) VALUES (1, 'dup-tvdb', 12345)`); err == nil {
		t.Fatal("expected UNIQUE violation for duplicate (user_id, tvdb_id)")
	}
}

// TestSettings exercises the settings-table helpers: missing key reads "",
// SetSetting upserts, and "" clears the row (migration 0005).
func TestSettings(t *testing.T) {
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	get := func(want string) {
		t.Helper()
		if v, err := st.GetSetting("tmdb_key"); err != nil || v != want {
			t.Fatalf("GetSetting = %q, %v; want %q", v, err, want)
		}
	}
	get("")
	if err := st.SetSetting("tmdb_key", "abc"); err != nil {
		t.Fatal(err)
	}
	get("abc")
	if err := st.SetSetting("tmdb_key", "def"); err != nil { // upsert
		t.Fatal(err)
	}
	get("def")
	if err := st.SetSetting("tmdb_key", ""); err != nil { // "" clears
		t.Fatal(err)
	}
	get("")
	var n int
	if err := st.DB.QueryRow(`SELECT count(*) FROM settings`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("cleared key should delete the row: %d, %v", n, err)
	}
}

// TestDedupeHash pins the normalization rule: casefold + whitespace collapse +
// typographic folding, so the same passage synced from different sources (with
// different quote/dash styles) hashes identically.
func TestDedupeHash(t *testing.T) {
	a := DedupeHash("Reader,  I married\nhim.")
	b := DedupeHash("reader, i married him.")
	if a != b {
		t.Fatalf("normalization mismatch: %s vs %s", a, b)
	}
	if a == DedupeHash("something else") {
		t.Fatal("distinct texts must not collide")
	}
	// Bookcision-style smart punctuation vs plain-ASCII markdown export.
	curly := DedupeHash("it’s easier – “to get used to it”…")
	plain := DedupeHash(`it's easier - "to get used to it"...`)
	if curly != plain {
		t.Fatalf("typographic fold mismatch: %s vs %s", curly, plain)
	}
}
