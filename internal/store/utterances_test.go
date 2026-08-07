package store

import (
	"strings"
	"testing"
)

// 0026 adds `utterances` — quotes belonging to no book and no film (ROADMAP
// §24). It is the first quote table in this schema with no parent, which makes
// several of its properties load-bearing in ways the other two do not share.
// These tests pin the ones that fail silently.

func TestUtterancesShape(t *testing.T) {
	st := openHead(t)
	ts := captureShape(t, st.DB, "utterances")

	// OWNERSHIP. annotations and dialogues have no user_id: their parent join IS
	// the access check, so a query cannot select from them without also scoping
	// by owner. This table has no parent, so the column has to exist and has to
	// cascade — otherwise deleting an account leaves its quotes behind, attached
	// to a user row that no longer exists.
	uid, ok := ts.column("user_id")
	if !ok {
		t.Fatal("utterances has no user_id: with no parent to join, there is no other ownership path")
	}
	if !uid.NotNull {
		t.Error("user_id must be NOT NULL — a quote with no owner is unreachable and unscopable")
	}
	fk, ok := ts.fkFrom("user_id")
	if !ok {
		t.Fatal("user_id has no foreign key to users")
	}
	if !strings.EqualFold(fk.Table, "users") || !strings.EqualFold(fk.OnDelete, "CASCADE") {
		t.Errorf("user_id must cascade from users, got %s on delete %s", fk.Table, fk.OnDelete)
	}

	// A quote with no words is not a quote. annotations allows a bare note
	// (a remark about a page); this deliberately does not.
	q, ok := ts.column("quote")
	if !ok || !q.NotNull {
		t.Error("quote must be NOT NULL on utterances")
	}

	// The occasion, and the partial date in particular. Empty string rather than
	// NULL, matching work_reads (0024), because the three date shapes are
	// compared lexically and a NULL would poison those comparisons.
	for _, col := range []string{"speaker", "occasion", "occasion_date", "place", "medium"} {
		c, ok := ts.column(col)
		if !ok {
			t.Errorf("utterances has no %s column: the occasion IS this kind's locator", col)
			continue
		}
		if !c.NotNull {
			t.Errorf("%s must be NOT NULL DEFAULT '' — the occasion is compared as text", col)
		}
	}

	// The colour vocabulary must match the other two kinds exactly, or the same
	// four-colour filter means different things on different screens.
	checks := ts.checkMentioning("color")
	if len(checks) == 0 {
		t.Fatal("utterances has no colour CHECK")
	}
	for _, want := range []string{"yellow", "blue", "pink", "orange"} {
		found := false
		for _, c := range checks {
			if strings.Contains(c, want) {
				found = true
			}
		}
		if !found {
			t.Errorf("colour CHECK does not admit %q; it must match annotations and dialogues", want)
		}
	}
}

// The dedupe rule INVERTS for this kind, and the constraint has to be scoped by
// user or two accounts cannot each keep the same famous line.
func TestUtterancesDedupeIsScopedByUser(t *testing.T) {
	st := openHead(t)
	ts := captureShape(t, st.DB, "utterances")
	if _, ok := ts.indexOn("user_id", "dedupe_hash"); !ok {
		t.Fatalf("utterances needs UNIQUE(user_id, dedupe_hash).\n"+
			"Global uniqueness would stop a second account keeping a line the first one already has.\nshape:\n%s", ts)
	}
}

func TestUtterancesDedupeAllowsTheSameLineInTwoAccounts(t *testing.T) {
	st := openHead(t)
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x'), (2, 'bob', 'y')`)

	// The same words, the same hash, two owners: both must land.
	mustExec(`INSERT INTO utterances (user_id, quote, dedupe_hash) VALUES (1, 'Give me blood', 'h1')`)
	mustExec(`INSERT INTO utterances (user_id, quote, dedupe_hash) VALUES (2, 'Give me blood', 'h1')`)

	// The same words twice for ONE owner is the case the constraint exists for.
	if _, err := st.DB.Exec(
		`INSERT INTO utterances (user_id, quote, dedupe_hash) VALUES (1, 'Give me blood', 'h1')`); err == nil {
		t.Fatal("expected UNIQUE(user_id, dedupe_hash) to reject a repeat for the same owner")
	}
}

// A polymorphic schedule table cannot hold a foreign key to three parents, so
// cascade is emulated per parent. Missing the third trigger is not cosmetic:
// SQLite reuses rowids, so an orphaned schedule row is inherited by the next
// quote created, which arrives carrying a stranger's review history.
func TestDeletingAnUtteranceClearsItsReviewRow(t *testing.T) {
	st := openHead(t)
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExec(`INSERT INTO utterances (id, user_id, quote, dedupe_hash) VALUES (7, 1, 'a line', 'h')`)
	mustExec(`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_touched_at)
	          VALUES ('utterance', 7, 30, 3, datetime('now'))`)

	mustExec(`DELETE FROM utterances WHERE id = 7`)

	var n int
	if err := st.DB.QueryRow(
		`SELECT count(*) FROM item_reviews WHERE kind = 'utterance' AND item_id = 7`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("deleting an utterance left its item_reviews row behind.\n" +
			"id is a plain INTEGER PRIMARY KEY, so SQLite reuses the rowid — the next quote " +
			"created would silently inherit this one's stability, review count and lapse history.")
	}
}

// Deleting the owner has to take the quotes, their tags and their schedule.
func TestDeletingAUserTakesTheirUtterances(t *testing.T) {
	st := openHead(t)
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExec(`INSERT INTO utterances (id, user_id, quote, dedupe_hash) VALUES (5, 1, 'a line', 'h')`)
	mustExec(`INSERT INTO tags (id, user_id, name) VALUES (3, 1, 'freedom')`)
	mustExec(`INSERT INTO utterance_tags (utterance_id, tag_id) VALUES (5, 3)`)

	mustExec(`DELETE FROM users WHERE id = 1`)

	for _, q := range []string{
		`SELECT count(*) FROM utterances`,
		`SELECT count(*) FROM utterance_tags`,
	} {
		var n int
		if err := st.DB.QueryRow(q).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Fatalf("%s left %d rows after the owner was deleted", q, n)
		}
	}
}

// The FTS index has to stay in step through insert, update and delete, and it
// indexes speaker as well as the text — "who said the thing about freedom" is
// the natural way to look one of these up.
func TestUtterancesFTSStaysInStep(t *testing.T) {
	st := openHead(t)
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := st.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	count := func(match string) int {
		t.Helper()
		var n int
		if err := st.DB.QueryRow(`SELECT count(*) FROM utterances_fts WHERE utterances_fts MATCH ?`, match).Scan(&n); err != nil {
			t.Fatalf("MATCH %q: %v", match, err)
		}
		return n
	}
	mustExec(`INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExec(`INSERT INTO utterances (id, user_id, quote, speaker, dedupe_hash)
	          VALUES (1, 1, 'Give me blood and I will give you freedom', 'Subhas Chandra Bose', 'h')`)

	if got := count("freedom"); got != 1 {
		t.Fatalf("insert did not reach the FTS index: %d", got)
	}
	if got := count("speaker:Bose"); got != 1 {
		t.Fatalf("speaker is not indexed: %d", got)
	}

	mustExec(`UPDATE utterances SET quote = 'entirely different words' WHERE id = 1`)
	if got := count("freedom"); got != 0 {
		t.Fatalf("update left the old text in the index: %d", got)
	}
	if got := count("different"); got != 1 {
		t.Fatalf("update did not index the new text: %d", got)
	}

	mustExec(`DELETE FROM utterances WHERE id = 1`)
	if got := count("different"); got != 0 {
		t.Fatalf("delete left the row in the index: %d", got)
	}
}

// store.Recover() copies base tables while sync triggers are live, excluding
// anything matching '%_fts' or '%_fts_%'. rebuildFTSTable finds an index's
// triggers by substring. Both are silent when broken, and both constrain the
// name rather than the contents.
func TestUtterancesFTSNameIsSafeForRecoveryAndRebuild(t *testing.T) {
	const name = "utterances_fts"
	if !strings.HasSuffix(name, "_fts") {
		t.Fatalf("%s does not match Recover()'s exclusion pattern; it would be copied as a base "+
			"table into a live index and report as a malformed database on the next insert", name)
	}
	// rebuildFTSTable does `sql LIKE '%<name>%'` to find the triggers to drop and
	// recreate, so any containment either way cross-wires two repairs.
	for _, other := range []string{"books_fts", "annotations_fts", "movies_fts", "dialogues_fts"} {
		if strings.Contains(name, other) || strings.Contains(other, name) {
			t.Errorf("%s and %s contain one another; rebuilding either would drop the other's triggers", name, other)
		}
	}
}
