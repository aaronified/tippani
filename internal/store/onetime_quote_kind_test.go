package store

import (
	"path/filepath"
	"testing"
)

// The 2.2.3 pass that reads a quote's old free-text `medium` across into 0053's
// fixed `kind`.
//
// WHAT IS ACTUALLY AT RISK is not an error. This pass rewrites a column on every
// standalone quote in somebody's library, once, with no interface anywhere that
// says what it did — so the two failures worth testing are the two that would go
// unnoticed: a value it should have folded and did not (the reader's shelf looks
// unfiled), and a value it folded that it should have left alone (their library
// has been reclassified by a guess).

// upgradeQuotesFrom52 is upgradeFrom48's sibling for this pass: it stops one
// migration short of 0053, seeds rows carrying the OLD columns, and then finishes.
// Stopping at 52 is what makes it an upgrade — a from-scratch migration test is
// always a fresh install, and a fresh install is the one case this pass declines.
func upgradeQuotesFrom52(t *testing.T, seed string) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "quotes.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	migrateThrough(t, s, 52)
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(seed); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return s
}

func quoteKindsByQuote(t *testing.T, s *Store) map[string]string {
	t.Helper()
	rows, err := s.DB.Query(`SELECT quote, COALESCE(kind, '') FROM utterances`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var q, k string
		if err := rows.Scan(&q, &k); err != nil {
			t.Fatal(err)
		}
		out[q] = k
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestQuoteKindIsReadOffTheOldColumns(t *testing.T) {
	s := upgradeQuotesFrom52(t, `
		INSERT INTO utterances (user_id, quote, color, medium, category, dedupe_hash) VALUES
		  (1, 'exact',      'yellow', 'speech',  'other',   'h1'),
		  (1, 'cased',      'yellow', 'Letter',  'other',   'h2'),
		  (1, 'padded',     'yellow', '  essay ','other',   'h3'),
		  (1, 'unreadable', 'yellow', 'radio',   'other',   'h4'),
		  (1, 'blank',      'yellow', '',        'other',   'h5'),
		  (1, 'byproverb',  'yellow', '',        'proverb', 'h6'),
		  (1, 'byspeech',   'yellow', '',        'speech',  'h7')`)

	got := quoteKindsByQuote(t, s)
	want := map[string]string{
		"exact":  "speech",
		"cased":  "letter", // a case fold, so "Letter" is the same answer as "letter"
		"padded": "essay",  // and a trim
		// THE VALUE IT MUST NOT GUESS AT. "radio" is not one of the five words, and
		// mapping it onto `speech` because that is usually what somebody meant would
		// be a reclassification of a library on upgrade, silently, with no record of
		// what moved.
		"unreadable": "",
		"blank":      "",
		// The fallback: category's two real answers.
		"byproverb": "proverb",
		"byspeech":  "speech",
	}
	for q, k := range want {
		if got[q] != k {
			t.Errorf("%q folded to %q, want %q", q, got[q], k)
		}
	}
}

// THE VALUE IT LEAVES BEHIND IS STILL THERE. "Drop anything that doesn't match" is
// the instruction; dropping it from the new field is not the same as deleting it,
// and the card goes on showing the old text until somebody files it.
func TestQuoteKindLeavesTheOldTextAlone(t *testing.T) {
	s := upgradeQuotesFrom52(t, `
		INSERT INTO utterances (user_id, quote, color, medium, category, dedupe_hash)
		VALUES (1, 'q', 'yellow', 'radio', 'other', 'h1')`)
	var medium string
	if err := s.DB.QueryRow(`SELECT medium FROM utterances WHERE quote = 'q'`).Scan(&medium); err != nil {
		t.Fatal(err)
	}
	if medium != "radio" {
		t.Errorf("medium is now %q; the pass destroyed a value it could not read", medium)
	}
}

// 'other' IN `category` IS NOT AN ANSWER. 0035 defaulted every existing row to it
// precisely so that nothing was reclassified, so reading it as a deliberate
// "other" would invent one decision per row in the library.
func TestQuoteKindDoesNotReadCategoryOther(t *testing.T) {
	s := upgradeQuotesFrom52(t, `
		INSERT INTO utterances (user_id, quote, color, medium, category, dedupe_hash)
		VALUES (1, 'q', 'yellow', '', 'other', 'h1')`)
	if got := quoteKindsByQuote(t, s)["q"]; got != "" {
		t.Errorf("kind came out as %q from category 'other', want unset", got)
	}
}

// Medium beats category when both say something: category has three values and was
// the board's filing, medium is what the reader typed about this line.
func TestQuoteKindPrefersMediumOverCategory(t *testing.T) {
	s := upgradeQuotesFrom52(t, `
		INSERT INTO utterances (user_id, quote, color, medium, category, dedupe_hash)
		VALUES (1, 'q', 'yellow', 'letter', 'proverb', 'h1')`)
	if got := quoteKindsByQuote(t, s)["q"]; got != "letter" {
		t.Errorf("kind = %q, want letter", got)
	}
}

// A pass that runs twice is a pass that can undo a correction. The second Migrate
// must not touch a row the reader has since re-filed by hand.
func TestQuoteKindRunsOnlyOnce(t *testing.T) {
	s := upgradeQuotesFrom52(t, `
		INSERT INTO utterances (user_id, quote, color, medium, category, dedupe_hash)
		VALUES (1, 'q', 'yellow', 'speech', 'other', 'h1')`)
	if !passApplied(t, s, "2.2.3-quote-kind-from-medium") {
		t.Fatal("the pass did not record itself, so it will run again")
	}
	// The reader disagrees with what it chose.
	if _, err := s.DB.Exec(`UPDATE utterances SET kind = 'essay' WHERE quote = 'q'`); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if got := quoteKindsByQuote(t, s)["q"]; got != "essay" {
		t.Errorf("a second boot rewrote a corrected row back to %q", got)
	}
}

// A fresh install has no `medium` to read, so the pass has nothing true to do —
// and records itself anyway, so it is never asked again on a database that by then
// is no longer fresh.
func TestQuoteKindSkipsAFreshInstall(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if !passApplied(t, s, "2.2.3-quote-kind-from-medium") {
		t.Error("the pass did not record itself on a fresh install")
	}
}

// The CHECK is the thing that makes the vocabulary a vocabulary rather than a
// convention, so it is asserted directly: the five words and the empty one, and
// nothing else.
func TestQuoteKindColumnRefusesAnythingElse(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "check.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')`); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"", "speech", "letter", "essay", "proverb", "other"} {
		if _, err := s.DB.Exec(
			`INSERT INTO utterances (user_id, quote, color, kind, dedupe_hash) VALUES (1, ?, 'yellow', ?, ?)`,
			"ok-"+k, k, "h-"+k); err != nil {
			t.Errorf("the column refused %q, which is one of its own values: %v", k, err)
		}
	}
	if _, err := s.DB.Exec(
		`INSERT INTO utterances (user_id, quote, color, kind, dedupe_hash) VALUES (1, 'bad', 'yellow', 'radio', 'hb')`,
	); err == nil {
		t.Error("the column accepted 'radio'; the CHECK is not doing anything")
	}
}
