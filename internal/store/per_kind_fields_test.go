package store

import (
	"path/filepath"
	"testing"
)

// Migration 0047 gives each of the nine types the columns it actually needs, and
// takes the CHECK off boards.kind so the kind vocabulary can grow.
//
// THE FAILING-FIRST TEST IS THE FIRST ONE BELOW, and it is a test for a bug that
// is live rather than for a feature that is new. Go has defined and accepted
// boardKindSpeech = "speech" since 1.15.0, the Quotes page POSTs it from the
// Speeches starter, and 0037's CHECK refuses it — so pressing that starter today
// is an insert that fails the constraint and answers 500. Nothing tested it,
// which is how a Go validator and a schema managed to disagree for a release.

// openAt46 returns a store at the pre-0047 schema: two board kinds, no per-kind
// fields.
func openAt46(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 46)
	return s
}

// exec is the "this must work" form used throughout this file; tryExec is for the
// statements whose failure is the assertion.
func exec(t *testing.T, s *Store, q string, args ...any) {
	t.Helper()
	if _, err := s.DB.Exec(q, args...); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
}

func tryExec(t *testing.T, s *Store, q string, args ...any) error {
	t.Helper()
	_, err := s.DB.Exec(q, args...)
	return err
}

// ---------------------------------------------------------------------------
// boards.kind
// ---------------------------------------------------------------------------

func TestABoardCanHoldSpeechesLettersAndEssays(t *testing.T) {
	s := openAt46(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`)

	// At 46 the CHECK is (plain, proverb), so the value the API has been sending
	// for a release cannot be stored. This is the 500.
	if err := tryExec(t, s,
		`INSERT INTO boards (id, user_id, name, kind) VALUES (1, 1, 'Speeches', 'speech')`); err == nil {
		t.Fatal("a speech board inserted at the 0046 schema — the CHECK this migration exists to drop is already gone")
	}

	migrateThrough(t, s, 47)

	for i, kind := range []string{"plain", "proverb", "speech", "letter", "essay"} {
		if err := tryExec(t, s,
			`INSERT INTO boards (id, user_id, name, kind) VALUES (?, 1, ?, ?)`,
			10+i, "board-"+kind, kind); err != nil {
			t.Errorf("kind %q: %v", kind, err)
		}
	}

	// And the vocabulary is open, which is the point of dropping the CHECK rather
	// than widening it: Poem, Lyrics and Article are expected, and none of them
	// should cost a migration. The database accepts anything; Go is what refuses
	// a value the app does not know.
	if err := tryExec(t, s,
		`INSERT INTO boards (id, user_id, name, kind) VALUES (99, 1, 'Poems', 'poem')`); err != nil {
		t.Fatalf("the kind column is still constrained by the schema, so the next kind is another migration: %v", err)
	}
}

// The CHECK cannot be dropped in place, so 0047 parks every board's kind, drops
// the column and adds it back. That is a data move, and this is the test that it
// moved everything — including the facts a naive re-add would flatten (a hidden
// board, a non-contiguous pos, a proverb board's language list) and the RESTRICT
// foreign key that makes the 0029 rebuild idiom impossible here in the first
// place.
func TestABoardKeepsEverythingThroughTheCheckDrop(t *testing.T) {
	s := openAt46(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (2, 'other', 'x', 0)`)
	exec(t, s, `INSERT INTO boards (id, user_id, name, description, color, kind, languages, hidden, pos)
	            VALUES (1, 1, 'Grandmother', 'hers', 'green', 'proverb', '["Bengali","Hindi"]', 0, 3)`)
	exec(t, s, `INSERT INTO boards (id, user_id, name, kind, hidden, pos)
	            VALUES (2, 1, 'Retired', 'plain', 1, 9)`)
	// Same name, different reader — the UNIQUE is per user and has to stay so.
	exec(t, s, `INSERT INTO boards (id, user_id, name, kind, pos)
	            VALUES (3, 2, 'Grandmother', 'proverb', 0)`)
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, board_id, dedupe_hash)
	            VALUES (11, 1, 'Least said, soonest mended', 1, 'h-11')`)

	migrateThrough(t, s, 47)

	type board struct {
		name, desc, color, kind, langs string
		hidden, pos                    int
	}
	get := func(id int) board {
		t.Helper()
		var b board
		if err := s.DB.QueryRow(
			`SELECT name, description, color, kind, languages, hidden, pos FROM boards WHERE id = ?`, id,
		).Scan(&b.name, &b.desc, &b.color, &b.kind, &b.langs, &b.hidden, &b.pos); err != nil {
			t.Fatalf("board %d: %v", id, err)
		}
		return b
	}
	if got := get(1); got != (board{"Grandmother", "hers", "green", "proverb", `["Bengali","Hindi"]`, 0, 3}) {
		t.Errorf("the proverb board came back as %+v", got)
	}
	// hidden and pos are the two a re-add with a default would silently flatten,
	// and neither has a screen that would show the reader it had happened.
	if got := get(2); got.kind != "plain" || got.hidden != 1 || got.pos != 9 {
		t.Errorf("the hidden board came back kind=%q hidden=%d pos=%d", got.kind, got.hidden, got.pos)
	}
	if got := get(3); got.kind != "proverb" {
		t.Errorf("the second reader's board came back kind=%q", got.kind)
	}

	// The index is a CREATE INDEX, which a rebuild has to recreate by hand.
	// Nothing fails without it — the boards list just quietly starts scanning.
	var idx int
	if err := s.DB.QueryRow(
		`SELECT count(*) FROM sqlite_master WHERE type='index' AND name='idx_boards_user'`).Scan(&idx); err != nil {
		t.Fatal(err)
	}
	if idx != 1 {
		t.Error("idx_boards_user is gone; listing a reader's boards now scans")
	}

	// The UNIQUE (user_id, name) rides along with the CREATE TABLE, so it is the
	// constraint a rebuild loses most quietly: the 409 on a duplicate board name
	// would just stop happening.
	if err := tryExec(t, s,
		`INSERT INTO boards (id, user_id, name) VALUES (4, 1, 'Grandmother')`); err == nil {
		t.Error("a second board with the same name for the same reader was accepted; UNIQUE (user_id, name) is gone")
	}

	// The quote still points at its board...
	var name string
	if err := s.DB.QueryRow(
		`SELECT b.name FROM utterances u JOIN boards b ON b.id = u.board_id WHERE u.id = 11`).Scan(&name); err != nil {
		t.Fatalf("the quote lost its board: %v", err)
	}
	if name != "Grandmother" {
		t.Errorf("the quote came back on board %q", name)
	}
	// ...and the RESTRICT that makes deleting a populated board an error rather
	// than a silent cascade is still there. This is the FK that rules out 0029's
	// rebuild dance, so losing it here would be losing the reason for the shape
	// of the migration.
	if err := tryExec(t, s, `DELETE FROM boards WHERE id = 1`); err == nil {
		t.Error("a board with a quote on it was deleted; the ON DELETE RESTRICT is gone")
	}
}

// ---------------------------------------------------------------------------
// the two rebuilt full-text indexes
// ---------------------------------------------------------------------------

// dialogues_fts has carried `character` since 0003 and the search page already
// builds a Characters section out of it — for films, shows and games. A book
// character that is storable and not findable would be the same asymmetry read
// from the other end.
func TestABookCharacterIsFoundByTheFullTextIndex(t *testing.T) {
	s := openHead(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'r', 'x', 1)`)
	exec(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Moby-Dick')`)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, character, source, dedupe_hash)
	            VALUES (1, 1, 'Towards thee I roll', 'Ahab', 'manual', 'h-1')`)

	match := func(term string) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(
			`SELECT count(*) FROM annotations_fts WHERE annotations_fts MATCH ?`, term).Scan(&n); err != nil {
			t.Fatalf("MATCH %s: %v", term, err)
		}
		return n
	}
	if match(`"ahab"`) != 1 {
		t.Fatal("a book character is not in the full-text index; the _ai trigger did not carry it")
	}
	// The three triggers were re-cut by hand, so the two that are easiest to get
	// wrong are worth exercising: an UPDATE has to delete the old row before
	// inserting the new one, and a DELETE has to write the 'delete' row.
	exec(t, s, `UPDATE annotations SET character = 'Starbuck' WHERE id = 1`)
	if match(`"ahab"`) != 0 {
		t.Error("the renamed character is still findable under its old name; the _au trigger is not deleting")
	}
	if match(`"starbuck"`) != 1 {
		t.Error("the renamed character is not findable under its new name; the _au trigger is not inserting")
	}
	exec(t, s, `DELETE FROM annotations WHERE id = 1`)
	if match(`"starbuck"`) != 0 {
		t.Error("a deleted highlight's character is still in the index; the _ad trigger is not firing")
	}
	// The four columns the index already had must still work — this index was
	// dropped and recreated, and 'rebuild' running before the triggers existed
	// would leave it plausibly populated and permanently stale.
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, note, source, dedupe_hash)
	            VALUES (2, 1, 'Call me Ishmael', 'the doubloon', 'manual', 'h-2')`)
	if match(`"ishmael"`) != 1 || match(`"doubloon"`) != 1 {
		t.Error("quote or note stopped matching after the rebuild")
	}
}

// "Every letter to Nehru" and "everything in that essay" are the same query shape
// as "everything Bose said", which is already a section of the results.
func TestALetterRecipientAndAnEssayTitleAreFound(t *testing.T) {
	s := openHead(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'r', 'x', 1)`)
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, speaker, recipient, dedupe_hash)
	            VALUES (1, 1, 'I write to you from prison', 'Gandhi', 'Nehru', 'h-1')`)
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, work_title, locator, dedupe_hash)
	            VALUES (2, 1, 'The past is a foreign country', 'The Discovery of India', 'p. 44', 'h-2')`)

	match := func(term string) int {
		t.Helper()
		var n int
		if err := s.DB.QueryRow(
			`SELECT count(*) FROM utterances_fts WHERE utterances_fts MATCH ?`, term).Scan(&n); err != nil {
			t.Fatalf("MATCH %s: %v", term, err)
		}
		return n
	}
	if match(`"nehru"`) != 1 {
		t.Error("a letter's recipient is not in the full-text index")
	}
	if match(`"discovery"`) != 1 {
		t.Error("an essay's title is not in the full-text index")
	}
	// The locator is deliberately NOT indexed — no locator in this schema is —
	// so this is an assertion about a decision, not an oversight.
	if match(`"p. 44"`) != 0 {
		t.Error("the locator reached the index; locators are not searchable by design")
	}
	exec(t, s, `UPDATE utterances SET recipient = 'Patel' WHERE id = 1`)
	if match(`"nehru"`) != 0 || match(`"patel"`) != 1 {
		t.Error("the _au trigger did not follow a changed recipient")
	}
	exec(t, s, `DELETE FROM utterances WHERE id = 2`)
	if match(`"discovery"`) != 0 {
		t.Error("a deleted quote's work title is still in the index; the _ad trigger is not firing")
	}
	// And the five columns 0035 left behind still match.
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, note, speaker, occasion, translation, dedupe_hash)
	            VALUES (3, 1, 'Jai Hind', 'shouted', 'Bose', 'a rally', 'Victory to India', 'h-3')`)
	for _, term := range []string{`"jai"`, `"shouted"`, `"bose"`, `"rally"`, `"victory"`} {
		if match(term) != 1 {
			t.Errorf("%s stopped matching after the rebuild", term)
		}
	}
}

// ---------------------------------------------------------------------------
// every new column, written and read back
// ---------------------------------------------------------------------------

// A column that cannot be written is worse than one that is absent, and a column
// whose default is wrong is invisible until somebody reads a row nobody wrote to.
// So: every one of the twenty-one new columns, on both halves — the value it
// takes, and the value it has when nothing sets it.
func TestEveryNewFieldIsWrittenAndReadBack(t *testing.T) {
	s := openHead(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'r', 'x', 1)`)
	exec(t, s, `INSERT INTO books (id, user_id, title, language, orig_language)
	            VALUES (1, 1, 'Pather Panchali', 'English', 'Bengali')`)
	exec(t, s, `INSERT INTO books (id, user_id, title) VALUES (2, 1, 'Untitled')`)
	exec(t, s, `INSERT INTO movies (id, user_id, title, media_type) VALUES (1, 1, 'Disco Elysium', 'game')`)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, character, source, dedupe_hash)
	            VALUES (1, 1, 'a passage', 'Apu', 'manual', 'a-1')`)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, source, dedupe_hash)
	            VALUES (2, 1, 'another passage', 'manual', 'a-2')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, act, quest, episode_name, dedupe_hash)
	            VALUES (1, 1, 'a bark', 'Act 2', 'The Well', 'Pilot', 'd-1')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, dedupe_hash) VALUES (2, 1, 'a plain line', 'd-2')`)
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, region, recipient, work_title, locator, occasion_circa, dedupe_hash)
	            VALUES (1, 1, 'a quote', 'Sylhet', 'Nehru', 'An Essay', 'para. 3', 1, 'u-1')`)
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, dedupe_hash) VALUES (2, 1, 'a bare quote', 'u-2')`)

	// The staging mirror, so a field that survives the export and the parse is
	// not dropped at the last step. staged_quotes.character predates 0047 and is
	// checked alongside the eight, because the annotation half of stageQuotes is
	// the site that hardwires it.
	exec(t, s, `INSERT INTO import_batches (id, user_id, source) VALUES (1, 1, 'md')`)
	exec(t, s, `INSERT INTO staged_works (id, batch_id, kind, title, language, orig_language)
	            VALUES (1, 1, 'book', 'Pather Panchali', 'English', 'Bengali')`)
	exec(t, s, `INSERT INTO staged_works (id, batch_id, kind, title) VALUES (2, 1, 'book', 'Untitled')`)
	exec(t, s, `INSERT INTO staged_quotes
	              (id, staged_work_id, quote, character, act, quest, episode_name,
	               region, recipient, work_title, locator, occasion_circa, dedupe_hash)
	            VALUES (1, 1, 'a staged quote', 'Apu', 'Act 2', 'The Well', 'Pilot',
	                    'Sylhet', 'Nehru', 'An Essay', 'para. 3', 1, 's-1')`)
	exec(t, s, `INSERT INTO staged_quotes (id, staged_work_id, quote, dedupe_hash)
	            VALUES (2, 2, 'a bare staged quote', 's-2')`)

	text := func(query string) string {
		t.Helper()
		var v string
		if err := s.DB.QueryRow(query).Scan(&v); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return v
	}
	num := func(query string) int {
		t.Helper()
		var v int
		if err := s.DB.QueryRow(query).Scan(&v); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return v
	}

	for _, tc := range []struct{ what, query, want string }{
		{"books.language", `SELECT language FROM books WHERE id = 1`, "English"},
		{"books.orig_language", `SELECT orig_language FROM books WHERE id = 1`, "Bengali"},
		{"annotations.character", `SELECT character FROM annotations WHERE id = 1`, "Apu"},
		{"dialogues.act", `SELECT act FROM dialogues WHERE id = 1`, "Act 2"},
		{"dialogues.quest", `SELECT quest FROM dialogues WHERE id = 1`, "The Well"},
		{"dialogues.episode_name", `SELECT episode_name FROM dialogues WHERE id = 1`, "Pilot"},
		{"utterances.region", `SELECT region FROM utterances WHERE id = 1`, "Sylhet"},
		{"utterances.recipient", `SELECT recipient FROM utterances WHERE id = 1`, "Nehru"},
		{"utterances.work_title", `SELECT work_title FROM utterances WHERE id = 1`, "An Essay"},
		{"utterances.locator", `SELECT locator FROM utterances WHERE id = 1`, "para. 3"},
		{"staged_works.language", `SELECT language FROM staged_works WHERE id = 1`, "English"},
		{"staged_works.orig_language", `SELECT orig_language FROM staged_works WHERE id = 1`, "Bengali"},
		{"staged_quotes.character", `SELECT character FROM staged_quotes WHERE id = 1`, "Apu"},
		{"staged_quotes.act", `SELECT act FROM staged_quotes WHERE id = 1`, "Act 2"},
		{"staged_quotes.quest", `SELECT quest FROM staged_quotes WHERE id = 1`, "The Well"},
		{"staged_quotes.episode_name", `SELECT episode_name FROM staged_quotes WHERE id = 1`, "Pilot"},
		{"staged_quotes.region", `SELECT region FROM staged_quotes WHERE id = 1`, "Sylhet"},
		{"staged_quotes.recipient", `SELECT recipient FROM staged_quotes WHERE id = 1`, "Nehru"},
		{"staged_quotes.work_title", `SELECT work_title FROM staged_quotes WHERE id = 1`, "An Essay"},
		{"staged_quotes.locator", `SELECT locator FROM staged_quotes WHERE id = 1`, "para. 3"},
	} {
		if got := text(tc.query); got != tc.want {
			t.Errorf("%s = %q, want %q", tc.what, got, tc.want)
		}
	}
	for _, tc := range []struct {
		what, query string
		want        int
	}{
		{"utterances.occasion_circa", `SELECT occasion_circa FROM utterances WHERE id = 1`, 1},
		{"staged_quotes.occasion_circa", `SELECT occasion_circa FROM staged_quotes WHERE id = 1`, 1},
	} {
		if got := num(tc.query); got != tc.want {
			t.Errorf("%s = %d, want %d", tc.what, got, tc.want)
		}
	}

	// The zero value, on every row nobody set. This is 0045's rule, and the
	// reason it is asserted rather than assumed is that a NULL here would reach
	// Go as an error on a plain string scan — which is a 500 on a row that was
	// written perfectly correctly.
	for _, tc := range []struct{ what, query string }{
		{"books.language", `SELECT language FROM books WHERE id = 2`},
		{"books.orig_language", `SELECT orig_language FROM books WHERE id = 2`},
		{"annotations.character", `SELECT character FROM annotations WHERE id = 2`},
		{"dialogues.act", `SELECT act FROM dialogues WHERE id = 2`},
		{"dialogues.quest", `SELECT quest FROM dialogues WHERE id = 2`},
		{"dialogues.episode_name", `SELECT episode_name FROM dialogues WHERE id = 2`},
		{"utterances.region", `SELECT region FROM utterances WHERE id = 2`},
		{"utterances.recipient", `SELECT recipient FROM utterances WHERE id = 2`},
		{"utterances.work_title", `SELECT work_title FROM utterances WHERE id = 2`},
		{"utterances.locator", `SELECT locator FROM utterances WHERE id = 2`},
		{"staged_works.language", `SELECT language FROM staged_works WHERE id = 2`},
		{"staged_works.orig_language", `SELECT orig_language FROM staged_works WHERE id = 2`},
		{"staged_quotes.act", `SELECT act FROM staged_quotes WHERE id = 2`},
		{"staged_quotes.quest", `SELECT quest FROM staged_quotes WHERE id = 2`},
		{"staged_quotes.episode_name", `SELECT episode_name FROM staged_quotes WHERE id = 2`},
		{"staged_quotes.region", `SELECT region FROM staged_quotes WHERE id = 2`},
		{"staged_quotes.recipient", `SELECT recipient FROM staged_quotes WHERE id = 2`},
		{"staged_quotes.work_title", `SELECT work_title FROM staged_quotes WHERE id = 2`},
		{"staged_quotes.locator", `SELECT locator FROM staged_quotes WHERE id = 2`},
	} {
		if got := text(tc.query); got != "" {
			t.Errorf("%s defaulted to %q, want the empty string", tc.what, got)
		}
	}
	if got := num(`SELECT occasion_circa FROM utterances WHERE id = 2`); got != 0 {
		t.Errorf("utterances.occasion_circa defaulted to %d, want 0", got)
	}
	if got := num(`SELECT occasion_circa FROM staged_quotes WHERE id = 2`); got != 0 {
		t.Errorf("staged_quotes.occasion_circa defaulted to %d, want 0", got)
	}

	// NOT NULL, not merely defaulted. A writer that passes Go's nil for an
	// unset string — nullable("") is nil, which is the trap on every one of
	// these columns — has to fail loudly here rather than store a NULL that the
	// next reader turns into a 500.
	if err := tryExec(t, s,
		`INSERT INTO dialogues (id, movie_id, quote, act, dedupe_hash) VALUES (3, 1, 'x', NULL, 'd-3')`); err == nil {
		t.Error("a NULL act was accepted; the column is not NOT NULL")
	}
	if err := tryExec(t, s,
		`INSERT INTO annotations (id, book_id, quote, character, source, dedupe_hash)
		 VALUES (3, 1, 'x', NULL, 'manual', 'a-3')`); err == nil {
		t.Error("a NULL character was accepted; the column is not NOT NULL")
	}
}

// An upgraded database has to read exactly like a fresh one, which for these
// columns means the rows that were already there come back with the zero value
// rather than with NULL. Migrating a populated 0046 database is the only way to
// see that; openHead never has a row that predates the ALTER.
func TestARowThatPredatesTheColumnsReadsAsEmpty(t *testing.T) {
	s := openAt46(t)
	exec(t, s, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'r', 'x', 1)`)
	exec(t, s, `INSERT INTO books (id, user_id, title) VALUES (1, 1, 'Old Book')`)
	exec(t, s, `INSERT INTO movies (id, user_id, title, media_type) VALUES (1, 1, 'Old Show', 'show')`)
	exec(t, s, `INSERT INTO annotations (id, book_id, quote, source, dedupe_hash)
	            VALUES (1, 1, 'an old highlight', 'manual', 'a-1')`)
	exec(t, s, `INSERT INTO dialogues (id, movie_id, quote, season, episode, dedupe_hash)
	            VALUES (1, 1, 'an old line', 1, 2, 'd-1')`)
	exec(t, s, `INSERT INTO utterances (id, user_id, quote, dedupe_hash) VALUES (1, 1, 'an old quote', 'u-1')`)

	migrateThrough(t, s, 47)

	for _, q := range []string{
		`SELECT language || orig_language FROM books WHERE id = 1`,
		`SELECT character FROM annotations WHERE id = 1`,
		`SELECT act || quest || episode_name FROM dialogues WHERE id = 1`,
		`SELECT region || recipient || work_title || locator FROM utterances WHERE id = 1`,
	} {
		var v string
		if err := s.DB.QueryRow(q).Scan(&v); err != nil {
			t.Fatalf("%s: %v — a pre-existing row came back NULL, so the ALTER defaulted wrongly", q, err)
		}
		if v != "" {
			t.Errorf("%s = %q, want empty", q, v)
		}
	}
	// And the old row's hash was not touched, because act and quest are empty and
	// DialogueDedupeHash falls back to what it produced before. This is the whole
	// reason nothing needs rehashing on upgrade.
	var hash string
	if err := s.DB.QueryRow(`SELECT dedupe_hash FROM dialogues WHERE id = 1`).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if hash != "d-1" {
		t.Errorf("the migration rewrote an existing dedupe_hash to %q", hash)
	}
}
