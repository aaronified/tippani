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
	// ONE DATABASE PER KIND, AND EACH KIND IS DELETED FIRST IN ITS OWN.
	//
	// THE MUTATION THIS HAS TO CATCH keeps `item_id = OLD.id` and drops only the
	// `kind` — that is what a copied trigger gets wrong — so it takes rows of
	// OTHER kinds that share the rowid. Two earlier shapes of this test could not
	// see it:
	//
	//   THREE SEPARATELY-ALLOCATED IDS. Nothing collides, so the greedy trigger
	//   deletes exactly the rows the correct one would.
	//
	//   THREE DELETES IN SEQUENCE, whatever the order. Whichever kind goes LAST
	//   has no survivors left to be wrongly taken, so its total is 0 either way.
	//   Reordering only moved which kind was invisible, which is what the second
	//   version did — the register has it as AR4, twice.
	//
	// So the three kinds get one id BETWEEN them (independent `INTEGER PRIMARY
	// KEY` spaces, so one number is a highlight and a film line and a standalone
	// quote at once — the state 0026's rowid-reuse argument produces), and each
	// case deletes ONE of them in a database of its own. Every kind is then the
	// first delete, with the other two standing behind it as the witnesses.
	for _, c := range []struct{ what, kind, table string }{
		{"a highlight", "book", "annotations"},
		{"a film line", "screen", "dialogues"},
		{"a standalone quote", "utterance", "utterances"},
	} {
		t.Run(c.kind, func(t *testing.T) {
			st, id := seedSharedIDRecalls(t)
			if _, err := st.DB.Exec(`DELETE FROM `+c.table+` WHERE id = ?`, id); err != nil {
				t.Fatal(err)
			}
			count := func(q string, args ...any) int {
				t.Helper()
				var n int
				if err := st.DB.QueryRow(q, args...).Scan(&n); err != nil {
					t.Fatal(err)
				}
				return n
			}
			// Its own history is gone: nothing can reach those rows, and the next
			// quote handed that rowid inherits them.
			if n := count(`SELECT count(*) FROM item_recalls WHERE kind = ?`, c.kind); n != 0 {
				t.Errorf("deleting %s left %d of its own recall row(s) behind", c.what, n)
			}
			// AND BOTH OTHER KINDS ARE UNTOUCHED, named individually. They share the
			// rowid, so a trigger that forgot its `kind` reaches them — and saying
			// which kind survived is what a total cannot say once only one is left.
			for _, other := range []struct{ what, kind string }{
				{"a highlight", "book"}, {"a film line", "screen"}, {"a standalone quote", "utterance"},
			} {
				if other.kind == c.kind {
					continue
				}
				if n := count(`SELECT count(*) FROM item_recalls WHERE kind = ?`, other.kind); n != 2 {
					t.Errorf("deleting %s took %s's history too (%d of 2 rows left) — the trigger is not scoped to its own kind",
						c.what, other.what, n)
				}
			}
			if n := count(`SELECT count(*) FROM item_recalls`); n != 4 {
				t.Errorf("deleting %s left %d rows in the whole log, want 4", c.what, n)
			}
		})
	}
}

// seedSharedIDRecalls builds a library where a highlight, a film line and a
// standalone quote all carry the SAME id, each with two logged answers, and
// returns the store and that id.
func seedSharedIDRecalls(t *testing.T) (*Store, int64) {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	must := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	const shared = 7
	must(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'aro', 'x', 1)`)
	must(`INSERT INTO books (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	must(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'V for Vendetta')`)
	must(`INSERT INTO annotations (id, book_id, quote, source, dedupe_hash) VALUES (?, 1, 'a highlight', 'manual', 'h-1')`, shared)
	must(`INSERT INTO dialogues (id, movie_id, quote, source, dedupe_hash) VALUES (?, 1, 'a line', 'manual', 'h-2')`, shared)
	must(`INSERT INTO utterances (id, user_id, quote, source, dedupe_hash) VALUES (?, 1, 'a speech', 'manual', 'h-3')`, shared)
	for _, kind := range []string{"book", "screen", "utterance"} {
		// Two answers each: one proves a trigger fires, two prove it does not stop
		// at the first.
		for _, r := range []string{"got", "forgot"} {
			must(`INSERT INTO item_recalls (user_id, kind, item_id, result, stability, elapsed_days, answered_at)
			      VALUES (1, ?, ?, ?, 7.0, 3.5, datetime('now'))`, kind, shared, r)
		}
	}
	var n int
	if err := st.DB.QueryRow(`SELECT count(*) FROM item_recalls`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 6 {
		t.Fatalf("the seed is wrong: %d rows, want 6", n)
	}
	return st, shared
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
