package store

import (
	"path/filepath"
	"testing"
)

// Migration 0037 gives a board a KIND, and its backfill has to work out which of
// the boards 0036 made hold proverbs.
//
// IT ANSWERS THAT FROM `category`, NOT FROM THE NAME, and that is the assertion
// worth having. Matching on the name would pass every obvious test — 0036 names
// the board it seeds "Proverbs" — and would be wrong for the reader who renamed
// it, which is precisely the reader 0036 wrote three paragraphs promising not to
// break. This is also the last use of `category`, and what it was kept for.

// openAt36 returns a store at the pre-0037 schema: boards, no kinds.
func openAt36(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 36)
	return s
}

func kindOfBoard(t *testing.T, s *Store, name string) (string, string) {
	t.Helper()
	var kind, langs string
	if err := s.DB.QueryRow(`SELECT kind, languages FROM boards WHERE name = ?`, name).Scan(&kind, &langs); err != nil {
		t.Fatalf("board %q: %v", name, err)
	}
	return kind, langs
}

func TestTheBoardHoldingProverbsBecomesAProverbBoard(t *testing.T) {
	s := openAt36(t)
	ex := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	ex(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`)
	// RENAMED, which is the case a name match gets wrong. 0036 promises a seeded
	// board is then ordinary, and renaming is the first thing that promise buys.
	ex(`INSERT INTO boards (id, user_id, name) VALUES (1, 1, 'Grandmother')`)
	ex(`INSERT INTO boards (id, user_id, name) VALUES (2, 1, 'Speeches')`)
	// And a board CALLED Proverbs holding no proverbs, which is the case a name
	// match gets wrong in the other direction.
	ex(`INSERT INTO boards (id, user_id, name) VALUES (3, 1, 'Proverbs')`)
	utt := func(id int, board int, cat, lang, text string) {
		ex(`INSERT INTO utterances (id, user_id, quote, category, language, board_id, dedupe_hash)
		    VALUES (?, 1, ?, ?, ?, ?, ?)`, id, text, cat, lang, board, "h-"+text[:4])
	}
	utt(11, 1, "proverb", "Bengali", "aaaa one")
	utt(12, 1, "proverb", "Hindi", "bbbb two")
	utt(13, 1, "proverb", "Bengali", "cccc three")
	utt(14, 2, "speech", "", "dddd four")
	utt(15, 3, "other", "", "eeee five")

	migrateThrough(t, s, 37)

	if kind, _ := kindOfBoard(t, s, "Grandmother"); kind != "proverb" {
		t.Fatalf("the renamed board holding proverbs came out %q, want proverb — the backfill matched on the name", kind)
	}
	if kind, _ := kindOfBoard(t, s, "Speeches"); kind != "plain" {
		t.Fatalf("a board of speeches came out %q, want plain", kind)
	}
	if kind, _ := kindOfBoard(t, s, "Proverbs"); kind != "plain" {
		t.Fatal("a board holding no proverbs was made a proverb board because of what it is CALLED")
	}
}

// The languages come from the quotes actually on the board, so a reader who
// already had two languages opens 1.14.2 with both listed rather than with an
// empty picker on a board that plainly has two languages in it.
func TestAProverbBoardKeepsTheLanguagesItAlreadyHeld(t *testing.T) {
	s := openAt36(t)
	ex := func(q string, args ...any) {
		t.Helper()
		if _, err := s.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	ex(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'reader', 'x', 1)`)
	ex(`INSERT INTO boards (id, user_id, name) VALUES (1, 1, 'Proverbs')`)
	ex(`INSERT INTO utterances (id, user_id, quote, category, language, board_id, dedupe_hash)
	    VALUES (11, 1, 'aaaa', 'proverb', 'Bengali', 1, 'h1')`)
	ex(`INSERT INTO utterances (id, user_id, quote, category, language, board_id, dedupe_hash)
	    VALUES (12, 1, 'bbbb', 'proverb', 'Hindi', 1, 'h2')`)
	// Duplicated, and one with no language at all — neither should reach the list.
	ex(`INSERT INTO utterances (id, user_id, quote, category, language, board_id, dedupe_hash)
	    VALUES (13, 1, 'cccc', 'proverb', 'Bengali', 1, 'h3')`)
	ex(`INSERT INTO utterances (id, user_id, quote, category, language, board_id, dedupe_hash)
	    VALUES (14, 1, 'dddd', 'proverb', '', 1, 'h4')`)

	migrateThrough(t, s, 37)

	kind, langs := kindOfBoard(t, s, "Proverbs")
	if kind != "proverb" {
		t.Fatalf("kind = %q", kind)
	}
	if langs != `["Bengali","Hindi"]` {
		t.Fatalf("languages = %q, want the two on the board, deduplicated and with no blank", langs)
	}
}

// A board with nothing on it stays plain and stays empty-handed. The migration
// must not invent a language list for a board it knows nothing about.
func TestABoardWithNoQuotesIsLeftAlone(t *testing.T) {
	s := openAt36(t)
	if _, err := s.DB.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'r', 'x', 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`INSERT INTO boards (id, user_id, name) VALUES (1, 1, 'Empty')`); err != nil {
		t.Fatal(err)
	}
	migrateThrough(t, s, 37)
	kind, langs := kindOfBoard(t, s, "Empty")
	if kind != "plain" || langs != "" {
		t.Fatalf("an empty board came out kind=%q languages=%q", kind, langs)
	}
}
