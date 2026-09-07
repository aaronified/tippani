package store

import (
	"os"
	"path/filepath"
	"testing"
)

// THE RECALL LOG'S DELETE TRIGGERS, ASKED WHETHER THEY FIRE.
//
// 0064 gave `item_recalls` two of them and 0065 the third, and until this file
// the only thing checking any of them was a NAME in `schema_test.go`'s golden
// shape. A name in a list proves the trigger was created; it says nothing about
// what it does. This repo has been bitten by that shape of guard repeatedly, so
// the rule under test is stated as behaviour: delete the quote and the log goes
// with it.
//
// WHY IT MATTERS RATHER THAN BEING TIDY. SQLite cannot reference two tables from
// one column, so `(kind, item_id)` carries no foreign key and nothing cascades on
// its own. Left behind, a deleted quote's history is unreachable rows in a table
// that grows one row per answer and ships in every backup — and for the two kinds
// whose rowids CAN be reused, the next quote to be given that id inherits somebody
// else's memory of it.
//
// THREE KINDS, because the review deck has three sources: `utteranceSource()`
// returns `kind: kindUtterance`, and `reviewJoin` builds the schedule join from
// that same string. A pair of triggers copied from `item_reviews` covered two of
// them, which is how 0065 came to exist.
func TestRecallLogLeavesWithItsQuote(t *testing.T) {
	dir := t.TempDir()
	st, err := Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}

	must := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	count := func(q string, args ...any) int {
		t.Helper()
		var n int
		if err := st.DB.QueryRow(q, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	id := func(q string, args ...any) int64 {
		t.Helper()
		var v int64
		if err := st.DB.QueryRow(q, args...).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	must(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'aro', 'x', 1)`)
	must(`INSERT INTO books (user_id, title) VALUES (1, 'The Master and Margarita')`)
	must(`INSERT INTO movies (user_id, title) VALUES (1, 'V for Vendetta')`)
	bid := id(`SELECT id FROM books WHERE title = 'The Master and Margarita'`)
	mid := id(`SELECT id FROM movies WHERE title = 'V for Vendetta'`)

	must(`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (?, 'a highlight', 'manual', 'h-1')`, bid)
	must(`INSERT INTO dialogues (movie_id, quote, source, dedupe_hash) VALUES (?, 'a line', 'manual', 'h-2')`, mid)
	must(`INSERT INTO utterances (user_id, quote, source, dedupe_hash) VALUES (1, 'a speech', 'manual', 'h-3')`)
	ann := id(`SELECT id FROM annotations WHERE dedupe_hash = 'h-1'`)
	dlg := id(`SELECT id FROM dialogues WHERE dedupe_hash = 'h-2'`)
	utt := id(`SELECT id FROM utterances WHERE dedupe_hash = 'h-3'`)

	// Two answers each, because a log is a log: one row proves a trigger fires and
	// two prove it does not stop at the first.
	for _, c := range []struct {
		kind string
		id   int64
	}{{"book", ann}, {"screen", dlg}, {"utterance", utt}} {
		for _, r := range []string{"got", "forgot"} {
			must(`INSERT INTO item_recalls (user_id, kind, item_id, result, stability, elapsed_days, answered_at)
			      VALUES (1, ?, ?, ?, 7.0, 3.5, datetime('now'))`, c.kind, c.id, r)
		}
	}
	if n := count(`SELECT count(*) FROM item_recalls`); n != 6 {
		t.Fatalf("the seed is wrong: %d rows, want 6", n)
	}

	// EACH KIND ON ITS OWN, and the others checked after every delete: a trigger
	// with the wrong `kind` in its WHERE would take the whole table with it, and a
	// test that deleted all three at once could not tell that from three correct
	// triggers.
	//
	// THE UTTERANCE GOES FIRST, and the order is the assertion rather than a
	// preference. It ran LAST while its rows were the only ones left, so "did this
	// trigger take more than its own kind" had nothing to be true of: a rater
	// dropped `kind = 'utterance'` from 0065 and the test stayed green, because a
	// trigger that deletes the whole table and a trigger that deletes its own
	// three rows are the same trigger when three rows are all there is. Deleting
	// the newest kind first leaves four rows of other kinds standing behind it,
	// which is what the second assertion needs to be a claim.
	for _, c := range []struct {
		what, kind, table string
		id                int64
		left              int
	}{
		{"a standalone quote", "utterance", "utterances", utt, 4},
		{"a highlight", "book", "annotations", ann, 2},
		{"a film line", "screen", "dialogues", dlg, 0},
	} {
		must(`DELETE FROM `+c.table+` WHERE id = ?`, c.id)
		if n := count(`SELECT count(*) FROM item_recalls WHERE kind = ? AND item_id = ?`, c.kind, c.id); n != 0 {
			t.Errorf("deleting %s left %d recall row(s) behind — nothing can reach them and the next quote given that rowid inherits them", c.what, n)
		}
		if n := count(`SELECT count(*) FROM item_recalls`); n != c.left {
			t.Errorf("deleting %s left %d rows in the whole log, want %d — a trigger took more than its own kind", c.what, n, c.left)
		}
	}
}

// AND THE LOG IS IN THE ACCOUNT SNAPSHOT, which is a different question from the
// triggers and the one that decides whether a restore keeps the reader's history.
// `internal/httpapi` has the guard that every user-owned table is listed; this
// checks the column that makes it one, because a log with no `user_id` would pass
// that guard by being invisible to it.
func TestRecallLogBelongsToAReader(t *testing.T) {
	dir, err := os.MkdirTemp("", "recall")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	st, err := Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := st.DB.QueryRow(
		`SELECT count(*) FROM pragma_table_info('item_recalls') WHERE name = 'user_id'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("item_recalls has no user_id, so nothing about the row says whose history it is — and the account-snapshot guard cannot see it")
	}
	// AND IT IS A REAL FOREIGN KEY, so deleting the account takes the log rather
	// than leaving somebody's answers behind a user row that no longer exists.
	if err := st.DB.QueryRow(
		`SELECT count(*) FROM pragma_foreign_key_list('item_recalls') WHERE "table" = 'users'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("item_recalls.user_id references nothing, so deleting an account leaves its recall history behind")
	}
}
