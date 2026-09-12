package httpapi

// FILLING AN ANTHOLOGY FROM A RULE (0075).
//
// THE GUARD THE PLAN CALLS "the one test that has to exist" is the first one below:
// the same rule through the fill and through the SEARCH must find the same quotes.
// Everything else here is about what the fill does to an anthology that already has
// entries and a reader's writing in it.

import (
	"net/http"
	"testing"
)

func fill(t *testing.T, c *testClient, id int64, rule string, auto bool) anthologyFillResp {
	t.Helper()
	return decode[anthologyFillResp](t, c.mustDo("POST", "/anthologies/"+itoa(id)+"/fill",
		map[string]any{"rule": rule, "auto": auto}, http.StatusOK))
}

// A shelf with a known shape: three quotes carrying one tag and one that does not.
func taggedShelf(t *testing.T, c *testClient) (int64, int64, int64, int64) {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Meditations", "author": "Marcus Aurelius"}, http.StatusCreated))
	mk := func(quote string, tags []string) int64 {
		body := map[string]any{"book_id": book.ID, "quote": quote}
		if tags != nil {
			body["tags"] = tags
		}
		return decode[annotationRow](t, c.mustDo("POST", "/annotations", body, http.StatusCreated)).ID
	}
	a := mk("Think of the whole of existence.", []string{"stoicism"})
	b := mk("Waste no more time arguing.", []string{"stoicism"})
	cq := mk("The soul becomes dyed with the colour of its thoughts.", []string{"stoicism"})
	d := mk("A cucumber is bitter. Throw it away.", nil)
	return a, b, cq, d
}

// THE DRIFT GUARD. A rule that finds different quotes from the search bar showing
// the same words is worse than either behaviour on its own — and it is the failure
// that cannot be seen from the screen, because the reader is looking at one of the
// two answers and not both.
func TestTheFillFindsWhatTheSearchFinds(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	taggedShelf(t, c)

	a := newAnthology(t, c, "Stoics")
	got := fill(t, c, a.ID, "tag=stoicism", false)

	// The same query string, through the endpoint the search bar actually calls.
	res := decode[struct {
		Annotations []struct {
			ID int64 `json:"id"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", "/search?tag=stoicism", nil, http.StatusOK))

	// NEITHER SIDE MAY BE EMPTY. Two zeroes are equal, and a guard that passes when
	// the search is broken is the way this particular test stops testing anything —
	// the fixture has exactly three tagged quotes and a fourth that is not.
	if len(res.Annotations) != 3 {
		t.Fatalf("the search found %d tagged quotes, want the fixture's 3", len(res.Annotations))
	}
	if got.Matched != len(res.Annotations) {
		t.Fatalf("the fill matched %d and the search found %d", got.Matched, len(res.Annotations))
	}
	// And the SAME rows, not merely the same count.
	entries := getAnthology(t, c, a.ID).Entries
	inFill := map[int64]bool{}
	for _, e := range entries {
		inFill[e.ItemID] = true
	}
	for _, hit := range res.Annotations {
		if !inFill[hit.ID] {
			t.Errorf("the search found annotation %d and the fill did not", hit.ID)
		}
	}
	if got.Added != len(res.Annotations) {
		t.Errorf("added %d, want %d", got.Added, len(res.Annotations))
	}
}

// APPENDS, NEVER REORDERS, AND NEVER REMOVES — the rule this feature is defined
// against. A fill that could remove would delete the reader's commentary as a side
// effect of a library change.
func TestAFillAppendsAndLeavesTheHandOrderAlone(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	one, two, three, loose := taggedShelf(t, c)

	a := newAnthology(t, c, "Stoics")
	// A hand-placed entry FIRST, with the reader's own writing on it, and it is the
	// one the rule does NOT match — so a fill that rebuilt from the rule would drop
	// it and take the paragraph with it.
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": loose}})
	setEntryNote(t, c, a.ID, "book", loose, "Kept because I like it.")

	got := fill(t, c, a.ID, "tag=stoicism", false)
	if got.Added != 3 {
		t.Fatalf("added %d, want 3", got.Added)
	}
	entries := getAnthology(t, c, a.ID).Entries
	if len(entries) != 4 {
		t.Fatalf("%d entries after the fill, want 4", len(entries))
	}
	if entries[0].ItemID != loose {
		t.Errorf("the hand-placed entry is no longer first")
	}
	if entries[0].Note != "Kept because I like it." {
		t.Errorf("the reader's commentary did not survive the fill: %q", entries[0].Note)
	}
	found := map[int64]bool{}
	for _, e := range entries[1:] {
		found[e.ItemID] = true
	}
	for _, id := range []int64{one, two, three} {
		if !found[id] {
			t.Errorf("the fill did not append %d", id)
		}
	}
}

// FILLING TWICE ADDS NOTHING AND SAYS SO. "found 3, added 0" and "found 3, added 0,
// all 3 were already here" are the same number and completely different news, which
// is why `skipped` is reported rather than folded into `added`.
func TestFillingTwiceSkipsWhatIsAlreadyThere(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	taggedShelf(t, c)
	a := newAnthology(t, c, "Stoics")

	first := fill(t, c, a.ID, "tag=stoicism", false)
	second := fill(t, c, a.ID, "tag=stoicism", false)
	if second.Added != 0 {
		t.Errorf("the second fill added %d, want 0", second.Added)
	}
	if second.Skipped != first.Added {
		t.Errorf("skipped %d, want the %d the first fill added", second.Skipped, first.Added)
	}
	if n := len(getAnthology(t, c, a.ID).Entries); n != first.Added {
		t.Errorf("%d entries after two fills, want %d", n, first.Added)
	}
}

// THE RULE IS STORED BY THE FILL THAT RAN IT, so what is kept and what was run
// cannot differ — which is what makes "keep it fed" safe to build on.
func TestTheFillStoresTheRuleItRan(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	taggedShelf(t, c)
	a := newAnthology(t, c, "Stoics")

	if got := getAnthology(t, c, a.ID).Anthology; got.Rule != "" || got.RuleAuto {
		t.Fatalf("a new anthology already carries a rule: %+v", got)
	}
	fill(t, c, a.ID, "tag=stoicism", true)
	got := getAnthology(t, c, a.ID).Anthology
	if got.Rule != "tag=stoicism" {
		t.Errorf("rule = %q", got.Rule)
	}
	if !got.RuleAuto {
		t.Errorf("auto did not survive the fill")
	}
	if got.RuleRunAt == "" {
		t.Errorf("nothing recorded when the rule last ran")
	}
}

// AN EMPTY RULE IS REFUSED. A search bar with nothing in it shows the library; a
// fill with nothing in it would put the library IN the anthology, two hundred at a
// time, and the only undo is removing them one at a time.
func TestAFillWithNoRuleIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	taggedShelf(t, c)
	a := newAnthology(t, c, "Everything")
	c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/fill", map[string]any{"rule": "   "}, http.StatusBadRequest)
	if n := len(getAnthology(t, c, a.ID).Entries); n != 0 {
		t.Errorf("%d entries after a refused fill, want 0", n)
	}
}

// ANOTHER READER'S ANTHOLOGY IS 404 AND NEVER 403 — and the check happens BEFORE
// the library is read, so a refusal does not first run a search.
func TestAnotherReadersAnthologyCannotBeFilled(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	taggedShelf(t, alice)
	a := newAnthology(t, alice, "Mine")

	bob := addUser(t, h, alice, "bob")
	bob.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/fill",
		map[string]any{"rule": "tag=stoicism"}, http.StatusNotFound)
	if n := len(getAnthology(t, alice, a.ID).Entries); n != 0 {
		t.Errorf("a foreign fill put %d entries in somebody else's anthology", n)
	}
}

// A FREE-TEXT RULE GOES THROUGH FTS, which is the half `facetedCount` could not
// have answered — and the reason the fill counts by scanning rather than counting.
func TestAFillCanMatchOnWords(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	taggedShelf(t, c)
	a := newAnthology(t, c, "Cucumbers")
	got := fill(t, c, a.ID, "q=cucumber", false)
	if got.Added != 1 {
		t.Fatalf("added %d, want 1 — only one quote says cucumber", got.Added)
	}
	entries := getAnthology(t, c, a.ID).Entries
	if len(entries) != 1 || entries[0].Quote != "A cucumber is bitter. Throw it away." {
		t.Errorf("the wrong quote was filled: %+v", entries)
	}
}

// A PREVIEW IS THE FILL, ROLLED BACK. Two claims and both matter: the numbers are
// identical to what the fill then does, and nothing at all is written — not the
// entries, and not the rule, because a rule saved by LOOKING at it is a rule that
// "keep it fed" would go on running against an anthology whose owner never agreed
// to it.
func TestAPreviewSaysWhatTheFillWillDoAndChangesNothing(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	taggedShelf(t, c)
	a := newAnthology(t, c, "Stoics")

	preview := decode[anthologyFillResp](t, c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/fill",
		map[string]any{"rule": "tag=stoicism", "auto": true, "preview": true}, http.StatusOK))
	if preview.Added != 3 || preview.Matched != 3 {
		t.Fatalf("preview = %+v, want 3 matched and 3 addable", preview)
	}
	if n := len(getAnthology(t, c, a.ID).Entries); n != 0 {
		t.Errorf("the preview added %d entries", n)
	}
	if got := getAnthology(t, c, a.ID).Anthology; got.Rule != "" || got.RuleAuto {
		t.Errorf("the preview stored the rule: %+v", got)
	}

	// AND THE FILL THEN DOES EXACTLY THAT. A preview whose number the fill does not
	// honour is worse than no preview: the reader was shown one answer and given
	// another.
	real := fill(t, c, a.ID, "tag=stoicism", true)
	if real.Added != preview.Added || real.Matched != preview.Matched || real.Skipped != preview.Skipped {
		t.Errorf("the fill did %+v after a preview promising %+v", real, preview)
	}
}

// A PREVIEW OVER AN ANTHOLOGY THAT ALREADY HOLDS SOME OF THE MATCHES reports the
// skips, which is the case a naive "count the matches" preview gets wrong — it
// would promise three and add one.
func TestAPreviewCountsWhatIsAlreadyThereAsSkipped(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	one, _, _, _ := taggedShelf(t, c)
	a := newAnthology(t, c, "Stoics")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": one}})

	preview := decode[anthologyFillResp](t, c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/fill",
		map[string]any{"rule": "tag=stoicism", "preview": true}, http.StatusOK))
	if preview.Matched != 3 || preview.Added != 2 || preview.Skipped != 1 {
		t.Errorf("preview = %+v, want matched 3, added 2, skipped 1", preview)
	}
	if n := len(getAnthology(t, c, a.ID).Entries); n != 1 {
		t.Errorf("%d entries after a preview, want the 1 that was already there", n)
	}
}
