package httpapi

import (
	"context"
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

// EVERY ASK A SUPPLIER ANSWERS IS ON ITS ROW. The owner chose "Every path", whose
// option read "… and every ask updates the row's last answer". A row's last
// answer moved only after a lookup, a picture search or a Test; a Rescan, a fill,
// Fetch missing or a person's links asked the same suppliers and left the row
// saying nothing had. These drive the API a reader's press drives and read the
// row back from GET /metadata/status.
//
// SETUP KNOWS the book search seam (srv.searchBooks), as the re-verify tests do:
// the offline test server has no supplier to ask.

func rowLast(t *testing.T, c *testClient, source string) *sourceLast {
	t.Helper()
	return sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, source).Last
}

func TestARescansBookSearchIsOnBothSuppliersRows(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", ISBN13: isbn},
			{Source: "openlibrary", Title: "Dune", ISBN13: isbn}}, nil
	}
	c := signupAdmin(t, srv.Handler())
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune", "isbn": "9780441013593"}, http.StatusCreated))
	for _, s := range []string{"google", "openlibrary"} {
		if last := rowLast(t, c, s); last != nil {
			t.Fatalf("%s's row has an answer before anything asked it: %+v", s, last)
		}
	}
	c.mustDo("POST", "/metadata/reverify", map[string]any{"book_ids": []int64{b.ID}}, http.StatusOK)
	for _, s := range []string{"google", "openlibrary"} {
		if last := rowLast(t, c, s); last == nil || !last.OK || last.Found != 1 {
			t.Errorf("after a Rescan, %s's row reads %+v, want answered with 1 found", s, last)
		}
	}
}

func TestAStoppedAskLeavesTheRowAsItWas(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	srv.recordAsk(ctx, faultAreaBooks, "google", 0, "", context.Canceled)
	if last := rowLast(t, c, "google"); last != nil {
		t.Errorf("a Stop was recorded as Google's answer: %+v", last)
	}
	srv.recordAsk(context.Background(), faultAreaPeople, "openlibrary", 2, "", nil)
	if last := rowLast(t, c, "openlibrary"); last == nil || last.Found != 2 {
		t.Errorf("an answer about a person is not on Open Library's row: %+v", last)
	}
}
