package httpapi

import (
	"net/http"
	"testing"
)

// WHAT THE LIST HAS TO GET RIGHT, and it is not "returns rows".
//
// The screen it feeds exists so a reader can find decisions they have forgotten
// making. A list that quietly omits a kind of quote is worse than no list: it
// answers "what have I excluded?" with a number that is wrong, and the reader
// stops looking.
func TestExcludedQuotesAreListedUnderTheirWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "A Reference Manual")
	keep := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a line worth being asked about"}, http.StatusCreated))
	skip := decode[idResp](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "page 41, see appendix"}, http.StatusCreated))

	// Nothing excluded yet: the list is empty rather than absent, so a screen can
	// draw "nothing here" without telling a loading state from an empty one.
	got := decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 0 || len(got.Groups) != 0 {
		t.Fatalf("a library with nothing excluded: %+v", got)
	}

	// THE PATH THE APP ITSELF USES. review.jsx excludes a card with
	// POST /<kind>s/bulk {ids, review:false} — one endpoint for one quote and for
	// forty — so a test that wrote the column another way would be proving
	// something no reader can reach.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{skip.ID}, "review": false}, http.StatusOK)

	got = decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 1 {
		t.Fatalf("one quote excluded, total says %d", got.Total)
	}
	if len(got.Groups) != 1 {
		t.Fatalf("want one group, got %d", len(got.Groups))
	}
	g := got.Groups[0]
	if g.Title != "A Reference Manual" {
		t.Errorf("the group should be named for the work: %q", g.Title)
	}
	if g.WorkID != book {
		t.Errorf("the group should carry the work's id so the screen can unskip the lot: %d", g.WorkID)
	}
	if len(g.Quotes) != 1 || g.Quotes[0].ID != skip.ID {
		t.Fatalf("want only the excluded quote: %+v", g.Quotes)
	}
	// THE ONE THAT IS STILL ASKED ABOUT MUST NOT BE HERE. A list that showed every
	// quote of a work with one excluded would read as the whole book being skipped.
	for _, q := range g.Quotes {
		if q.ID == keep.ID {
			t.Error("a quote still in the deck is listed as never asked about")
		}
	}
	if g.Quotes[0].Text == "" {
		t.Error("a quote with no words cannot be recognised by the reader who excluded it")
	}

	// AND PUTTING IT BACK EMPTIES THE LIST, which is the whole point of the screen
	// and the half a read-only test would miss.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{skip.ID}, "review": true}, http.StatusOK)
	got = decode[excludedResp](t, c.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 0 {
		t.Fatalf("after putting it back, total says %d", got.Total)
	}
}

// ANOTHER ACCOUNT'S EXCLUSIONS ARE NOT YOURS, which is the repo's standing
// invariant and is worth one case on every new listing endpoint: this one joins
// to a parent table, and per-user scoping on a join is exactly where it gets
// dropped.
func TestExcludedQuotesAreScopedToTheirOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	mine := signupAdmin(t, h)
	book := createBook(t, mine, "Mine")
	q := decode[idResp](t, mine.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "a line of my own"}, http.StatusCreated))
	mine.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{q.ID}, "review": false}, http.StatusOK)

	other := addUser(t, h, mine, "someone")
	got := decode[excludedResp](t, other.mustDo("GET", "/review/excluded", nil, http.StatusOK))
	if got.Total != 0 || len(got.Groups) != 0 {
		t.Fatalf("another account can see what I excluded: %+v", got)
	}
}

type idResp struct {
	ID int64 `json:"id"`
}

type excludedResp struct {
	Groups []excludedGroup `json:"groups"`
	Total  int             `json:"total"`
}
