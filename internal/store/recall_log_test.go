package store

import (
	"fmt"
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
	// ONE DATABASE PER KIND; EACH KIND IS DELETED FIRST IN ITS OWN; AND EVERY KIND
	// HAS A SECOND QUOTE STANDING BESIDE THE ONE BEING DELETED.
	//
	// A trigger has three ways to be wrong and each needs its own witness left
	// alive, which is the whole design of this fixture:
	//
	//   NOT FIRING AT ALL — the deleted quote's own rows survive. Any shape of this
	//   test catches that.
	//
	//   FORGETTING `kind` — the commonest, because the trigger is copied: it then
	//   takes rows of OTHER kinds that share the rowid. Two earlier shapes could
	//   not see it. Three separately-allocated ids collide with nothing, so the
	//   greedy trigger deletes exactly what the right one would; and three deletes
	//   in sequence leave whichever kind went LAST with no survivors to be wrongly
	//   taken, so its total reads 0 either way. Reordering only moved which kind
	//   was invisible — the register has that as AR4, twice. So the three kinds
	//   share ONE id (independent `INTEGER PRIMARY KEY` spaces, so one number is a
	//   highlight and a film line and a standalone quote at once — the state
	//   0026's rowid-reuse argument produces) and each case is the first delete in
	//   a database of its own.
	//
	//   FORGETTING `item_id` — it then takes every row of its own kind. INVISIBLE
	//   WITH ONE QUOTE PER KIND, because that quote's rows are all the rows of that
	//   kind and wiping them is what deleting it should do. A rater found exactly
	//   that hole here. So every kind owns a SECOND quote with a different id and
	//   its own answers, which nothing about this delete may touch.
	const (
		doomed    = 7 // the id all three kinds share, and the one being deleted
		bystander = 9 // a second quote of every kind, which must come through untouched
	)
	for _, c := range []struct{ what, noun, kind, table string }{
		{"a highlight", "highlight", "book", "annotations"},
		{"a film line", "film line", "screen", "dialogues"},
		{"a standalone quote", "standalone quote", "utterance", "utterances"},
	} {
		t.Run(c.kind, func(t *testing.T) {
			st := seedSharedIDRecalls(t, doomed, bystander)
			if _, err := st.DB.Exec(`DELETE FROM `+c.table+` WHERE id = ?`, doomed); err != nil {
				t.Fatal(err)
			}
			count := func(kind string, item int64) int {
				t.Helper()
				var n int
				if err := st.DB.QueryRow(
					`SELECT count(*) FROM item_recalls WHERE kind = ? AND item_id = ?`, kind, item).Scan(&n); err != nil {
					t.Fatal(err)
				}
				return n
			}
			// Its own history is gone: nothing can reach those rows, and the next
			// quote handed that rowid inherits them.
			if n := count(c.kind, doomed); n != 0 {
				t.Errorf("deleting %s left %d of its own recall row(s) behind", c.what, n)
			}
			// THE SAME KIND'S OTHER QUOTE IS UNTOUCHED. A trigger that dropped
			// `item_id = OLD.id` takes this, and takes it silently: with one quote
			// per kind there would be nothing here to lose.
			if n := count(c.kind, bystander); n != 2 {
				t.Errorf("deleting %s took the OTHER %s's history as well (%d of 2 rows left) — the trigger is not scoped to the row that was deleted",
					c.what, c.noun, n)
			}
			// AND BOTH OTHER KINDS ARE UNTOUCHED, named individually, at BOTH ids.
			// They share the doomed rowid, so a trigger that forgot its `kind`
			// reaches them — and saying which kind survived is what a total cannot.
			for _, other := range []struct{ what, kind string }{
				{"a highlight", "book"}, {"a film line", "screen"}, {"a standalone quote", "utterance"},
			} {
				if other.kind == c.kind {
					continue
				}
				for _, item := range []int64{doomed, bystander} {
					if n := count(other.kind, item); n != 2 {
						t.Errorf("deleting %s took %s's history too (item %d: %d of 2 rows left) — the trigger is not scoped to its own kind",
							c.what, other.what, item, n)
					}
				}
			}
			var total int
			if err := st.DB.QueryRow(`SELECT count(*) FROM item_recalls`).Scan(&total); err != nil {
				t.Fatal(err)
			}
			if total != 10 {
				t.Errorf("deleting %s left %d rows in the whole log, want 10", c.what, total)
			}
		})
	}
}

// seedSharedIDRecalls builds a library where a highlight, a film line and a
// standalone quote all carry `doomed` as their id, and a second one of each
// carries `bystander`. Every one of the six has two logged answers.
func seedSharedIDRecalls(t *testing.T, doomed, bystander int64) *Store {
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
	must(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'aro', 'x', 1)`)
	must(`INSERT INTO books (id, user_id, title) VALUES (1, 1, 'The Master and Margarita')`)
	must(`INSERT INTO movies (id, user_id, title) VALUES (1, 1, 'V for Vendetta')`)
	for i, id := range []int64{doomed, bystander} {
		must(`INSERT INTO annotations (id, book_id, quote, source, dedupe_hash) VALUES (?, 1, 'a highlight', 'manual', ?)`,
			id, fmt.Sprintf("h-a%d", i))
		must(`INSERT INTO dialogues (id, movie_id, quote, source, dedupe_hash) VALUES (?, 1, 'a line', 'manual', ?)`,
			id, fmt.Sprintf("h-d%d", i))
		must(`INSERT INTO utterances (id, user_id, quote, source, dedupe_hash) VALUES (?, 1, 'a speech', 'manual', ?)`,
			id, fmt.Sprintf("h-u%d", i))
		for _, kind := range []string{"book", "screen", "utterance"} {
			// Two answers each: one proves a trigger fires, two prove it does not
			// stop at the first.
			for _, r := range []string{"got", "forgot"} {
				must(`INSERT INTO item_recalls (user_id, kind, item_id, result, stability, elapsed_days, answered_at)
				      VALUES (1, ?, ?, ?, 7.0, 3.5, datetime('now'))`, kind, id, r)
			}
		}
	}
	var n int
	if err := st.DB.QueryRow(`SELECT count(*) FROM item_recalls`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 12 {
		t.Fatalf("the seed is wrong: %d rows, want 12", n)
	}
	return st
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
