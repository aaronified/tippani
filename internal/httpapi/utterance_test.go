package httpapi

import (
	"net/http"
	"testing"
)

// Quotes with no book and no film (ROADMAP §24).
//
// The ownership tests are the important half of this file. Annotations and
// dialogues are owned through a parent, so their queries cannot omit the user
// scope — the join that fetches the row IS the check. An utterance has no
// parent, so every query carries its own WHERE user_id and a missing one leaks
// another account's quotes rather than hiding a row. There is a case per
// endpoint, and each asserts 404 rather than 403: 403 confirms the row exists.

type utterancesResp struct {
	Utterances []utteranceRow `json:"utterances"`
}

func newUtterance(t *testing.T, c *testClient, body map[string]any) utteranceRow {
	t.Helper()
	return decode[utteranceRow](t, c.mustDo("POST", "/quotes", body, http.StatusCreated))
}

func bose() map[string]any {
	return map[string]any{
		"quote":         "Give me blood, and I will give you freedom",
		"speaker":       "Subhas Chandra Bose",
		"occasion":      "Burma Radio broadcast",
		"occasion_date": "1944",
		"place":         "Burma",
		"medium":        "radio",
	}
}

func TestUtteranceCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose())
	if u.Quote != "Give me blood, and I will give you freedom" {
		t.Fatalf("quote: %q", u.Quote)
	}
	if u.Speaker != "Subhas Chandra Bose" || u.Occasion != "Burma Radio broadcast" ||
		u.OccasionDate != "1944" || u.Place != "Burma" || u.Medium != "radio" {
		t.Fatalf("occasion round-trip: %+v", u)
	}
	// The shared half behaves like the other two kinds.
	if u.Color != "yellow" {
		t.Fatalf("colour should default to yellow, got %q", u.Color)
	}
	if u.Tags == nil {
		t.Fatal("tags must marshal as [] rather than null")
	}
	if u.NotedAt == "" {
		t.Fatal("noted_at should default to now")
	}

	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 {
		t.Fatalf("list: %d", len(list.Utterances))
	}

	// PUT is full-state, and editing the words changes what the quote IS, so the
	// dedupe hash has to move with it.
	body := bose()
	body["quote"] = "Give me blood and I will give you freedom!"
	body["tags"] = []string{"freedom", "1944"}
	updated := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK))
	if updated.Quote != "Give me blood and I will give you freedom!" {
		t.Fatalf("update did not take: %q", updated.Quote)
	}
	if len(updated.Tags) != 2 {
		t.Fatalf("tags: %v", updated.Tags)
	}

	c.mustDo("DELETE", "/quotes/"+itoa(u.ID), nil, http.StatusOK)
	after := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(after.Utterances) != 0 {
		t.Fatalf("still %d after delete", len(after.Utterances))
	}
}

// One case per endpoint. This is the risk the no-parent model carries.
func TestUtteranceOwnership(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	mine := newUtterance(t, alice, bose())

	// Bob cannot see it in a list...
	list := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 0 {
		t.Fatalf("another account's quotes are visible: %d", len(list.Utterances))
	}
	// ...cannot edit it...
	bob.mustDo("PUT", "/quotes/"+itoa(mine.ID), bose(), http.StatusNotFound)
	// ...and cannot delete it. 404 rather than 403 throughout: 403 would confirm
	// the row exists, which is itself a disclosure.
	bob.mustDo("DELETE", "/quotes/"+itoa(mine.ID), nil, http.StatusNotFound)

	// And it survived all three attempts.
	still := decode[utterancesResp](t, alice.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(still.Utterances) != 1 {
		t.Fatalf("owner lost their quote: %d", len(still.Utterances))
	}
}

// The dedupe rule inverts for this kind: the occasion discriminates.
func TestUtteranceDedupeByOccasion(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())

	// The same words on the same occasion is a duplicate, and the 409 carries
	// the row already holding the slot so a retrying offline client can tell its
	// own earlier write from a real clash.
	c.mustDo("POST", "/quotes", bose(), http.StatusConflict)

	// The same words on a DIFFERENT occasion is a different quote.
	other := bose()
	other["occasion_date"] = "1943"
	newUtterance(t, c, other)

	elsewhere := bose()
	elsewhere["occasion"] = "Singapore rally"
	newUtterance(t, c, elsewhere)

	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 3 {
		t.Fatalf("expected three quotes, got %d", len(list.Utterances))
	}
}

// Two accounts must each be able to keep the same famous line — which is why
// the UNIQUE is (user_id, dedupe_hash) and not (dedupe_hash).
func TestUtteranceSameLineInTwoAccounts(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	newUtterance(t, alice, bose())
	newUtterance(t, bob, bose()) // must not 409 against someone else's row
}

func TestUtteranceValidation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A quote with no words is not a quote. (An annotation may be a bare note
	// about a page; there is no page here.)
	c.mustDo("POST", "/quotes", map[string]any{"note": "just a note"}, http.StatusBadRequest)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "   "}, http.StatusBadRequest)

	// The occasion date is partial by design, and validated by the same rule the
	// shelf read log uses.
	for _, bad := range []string{"1944-13", "44", "1944-02-30", "not a date", "0999"} {
		body := bose()
		body["occasion_date"] = bad
		c.mustDo("POST", "/quotes", body, http.StatusBadRequest)
	}
	for _, good := range []string{"1944", "1944-01", "1944-01-23", ""} {
		body := bose()
		body["occasion_date"] = good
		body["quote"] = "a distinct line for " + good
		newUtterance(t, c, body)
	}

	c.mustDo("POST", "/quotes", map[string]any{"quote": "x", "color": "chartreuse"}, http.StatusBadRequest)
}

// A proverb has no occasion to be qualified by, and two copies of the same
// unattributed words are the same quote.
func TestUtteranceWithNoOccasion(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	proverb := map[string]any{"quote": "Least said, soonest mended"}
	u := newUtterance(t, c, proverb)
	if u.Speaker != "" || u.OccasionDate != "" {
		t.Fatalf("expected an empty occasion: %+v", u)
	}
	c.mustDo("POST", "/quotes", proverb, http.StatusConflict)
}

// Deleting a quote takes its schedule row with it. item_reviews is polymorphic
// and cannot hold a foreign key to three parents, so this rides on the 0026
// AFTER DELETE trigger — and without it a reused rowid would hand the next
// quote a stranger's review history.
func TestDeletingAQuoteClearsItsSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose())
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO item_reviews (kind, item_id, stability, review_count, last_touched_at)
		 VALUES ('utterance', ?, 30, 3, datetime('now'))`, u.ID); err != nil {
		t.Fatal(err)
	}
	c.mustDo("DELETE", "/quotes/"+itoa(u.ID), nil, http.StatusOK)

	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM item_reviews WHERE kind = 'utterance' AND item_id = ?`, u.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("the schedule row outlived its quote")
	}
}

func TestUtteranceFilters(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := bose()
	a["tags"] = []string{"freedom"}
	newUtterance(t, c, a)

	b := bose()
	b["quote"] = "The only thing we have to fear is fear itself"
	b["speaker"] = "Franklin D. Roosevelt"
	b["occasion"] = "first inaugural address"
	b["occasion_date"] = "1933-03-04"
	b["color"] = "blue"
	b["favorite"] = true
	newUtterance(t, c, b)

	byQuery := func(qs string) int {
		t.Helper()
		return len(decode[utterancesResp](t, c.mustDo("GET", "/quotes"+qs, nil, http.StatusOK)).Utterances)
	}
	if got := byQuery(""); got != 2 {
		t.Fatalf("unfiltered: %d", got)
	}
	if got := byQuery("?color=blue"); got != 1 {
		t.Fatalf("colour filter: %d", got)
	}
	if got := byQuery("?favorite=1"); got != 1 {
		t.Fatalf("favourite filter: %d", got)
	}
	if got := byQuery("?tag=freedom"); got != 1 {
		t.Fatalf("tag filter: %d", got)
	}
	if got := byQuery("?speaker=Franklin+D.+Roosevelt"); got != 1 {
		t.Fatalf("speaker filter: %d", got)
	}
	c.mustDo("GET", "/quotes?color=chartreuse", nil, http.StatusBadRequest)
}

// Every filter must keep the user scope. A filter that replaced the WHERE
// rather than extending it would be the leak this model risks.
func TestUtteranceFiltersStayScopedToTheOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	a := bose()
	a["tags"] = []string{"freedom"}
	a["color"] = "blue"
	a["favorite"] = true
	newUtterance(t, alice, a)

	for _, qs := range []string{"", "?color=blue", "?favorite=1", "?tag=freedom", "?speaker=Subhas+Chandra+Bose"} {
		got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes"+qs, nil, http.StatusOK))
		if len(got.Utterances) != 0 {
			t.Fatalf("GET /quotes%s leaked %d of another account's quotes", qs, len(got.Utterances))
		}
	}
}
