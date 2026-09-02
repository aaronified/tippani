package httpapi

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

// A book's subtitle, publisher and extent — 0061.
//
// THE STATE THIS REPLACES. All three arrived on every lookup and none of them
// had a column: Google Books returns `subtitle`, `publisher` and `pageCount`,
// Open Library returns `subtitle`, `publisher` and `number_of_pages_median`, and
// the app parsed the first for a series guess and threw the rest away. The design
// pack's Details form names all three, so what is pinned here is that they are
// stored, that a full-state save cannot clear them by omission, and that they
// survive the round trip a library is actually rebuilt from.

type bookEdition struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Subtitle  string `json:"subtitle"`
	Publisher string `json:"publisher"`
	Pages     int    `json:"pages"`
}

func TestABookKeepsItsSubtitlePublisherAndExtent(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookEdition](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"subtitle": "A Novel", "publisher": "Penguin Classics", "pages": 503,
	}, http.StatusCreated))
	if made.Subtitle != "A Novel" || made.Publisher != "Penguin Classics" || made.Pages != 503 {
		t.Fatalf("create: %+v", made)
	}
	got := decode[bookEdition](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Subtitle != "A Novel" || got.Publisher != "Penguin Classics" || got.Pages != 503 {
		t.Fatalf("fetch: %+v", got)
	}

	// FULL-STATE MEANS FULL-STATE. The update writes every column it names
	// unconditionally, so a body that omits one clears it — which is the defect
	// the languages carried for three releases (0047) and the reason this
	// assertion is here rather than left to the client's own ratchet.
	cleared := decode[bookEdition](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "The Master and Margarita",
	}, http.StatusOK))
	if cleared.Subtitle != "" || cleared.Publisher != "" || cleared.Pages != 0 {
		t.Fatalf("a full-state PUT that named none of them left %+v", cleared)
	}
}

func TestTheThreeEditionFieldsAreRefused(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	// A page count is a count. Negative is the only refusal — a ceiling would be
	// a guess about what a long book is, and an omnibus is the row that would
	// hit it.
	c.mustDo("POST", "/books", map[string]any{"title": "A", "pages": -1}, http.StatusBadRequest)
	c.mustDo("POST", "/books", map[string]any{"title": "B", "pages": 4000}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{
		"title": "C", "subtitle": strings.Repeat("x", 501),
	}, http.StatusBadRequest)
	c.mustDo("POST", "/books", map[string]any{
		"title": "D", "publisher": strings.Repeat("x", 201),
	}, http.StatusBadRequest)
}

func TestTheEditionFieldsRoundTripThroughTheExport(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookEdition](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"subtitle": "A Novel", "publisher": "Penguin Classics", "pages": 503,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": made.ID, "quote": "Manuscripts don't burn",
	}, http.StatusCreated)

	md := c.mustDo("GET", "/books/"+itoa(made.ID)+"/export?format=md", nil, http.StatusOK).Body.String()
	for _, want := range []string{"subtitle: A Novel", "publisher: Penguin Classics", "page_count: 503"} {
		if !strings.Contains(md, want) {
			t.Fatalf("the export is missing %q:\n%s", want, md)
		}
	}
	// `page_count` AND NOT `pages`. The importer has bound `page`/`pages` to the
	// reading position since 0024 and still does, so a file that spelled the
	// extent `pages:` would re-import as "you are on page 503 of nothing".
	if strings.Contains(md, "\npages:") {
		t.Fatalf("the extent was written under the reading position's key:\n%s", md)
	}

	// Back in, through the staging queue, onto a second account — which is the
	// path a library is actually rebuilt by, and the one that loses a field
	// silently with a successful import and matching counts.
	c2 := signupAdmin(t, newTestServer(t).Handler())
	res := stage(t, c2, "/import/markdown", "mm.md", []byte(md))
	c2.mustDo("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)
	list := decode[struct {
		Books []bookEdition `json:"books"`
	}](t, c2.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("the import made %d books", len(list.Books))
	}
	back := decode[bookEdition](t, c2.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if back.Subtitle != "A Novel" || back.Publisher != "Penguin Classics" || back.Pages != 503 {
		t.Fatalf("the round trip lost something: %+v", back)
	}
}

// Re-verify offers the three, and applying takes only what was ticked.
//
// A FIELD THE SWEEP CANNOT SEE IS A FIELD THAT NEVER CATCHES UP. Every library
// already in use holds books with a blank publisher and no page count, and the
// only control that fills them across a shelf is this one; leaving them out of
// the diff would have shipped three columns nothing but a manual edit could fill.
func TestReverifyOffersAndAppliesTheEditionFields(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{
			Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn,
			Subtitle: "A Novel", Publisher: "Ace Books", Pages: 412,
		}}, nil
	}
	c := signupAdmin(t, srv.Handler())
	made := decode[bookEdition](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dune", "author": "Frank Herbert", "isbn": "9780441013593",
		"publisher": "Gollancz",
	}, http.StatusCreated))

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"book_ids": []int64{made.ID}}, http.StatusOK))
	fields := diffFields(t, res, 0)
	if !fields["subtitle"] || !fields["publisher"] || !fields["pages"] {
		t.Fatalf("the sweep did not offer all three: %v", fields)
	}

	// ONLY WHAT WAS TICKED. The reader's own "Gollancz" is left alone here — the
	// whole reason apply takes a set rather than a candidate.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "book", "id": made.ID,
			"set": map[string]any{"subtitle": "A Novel", "pages": 412},
		}},
	}, http.StatusOK)
	got := decode[bookEdition](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Subtitle != "A Novel" || got.Pages != 412 {
		t.Fatalf("apply did not land: %+v", got)
	}
	if got.Publisher != "Gollancz" {
		t.Fatalf("apply overwrote a field nobody ticked: %q", got.Publisher)
	}

	// AND EVERY FIELD THE GUARD ADMITS MUST ALSO BE WRITTEN. `allowed` is a
	// separate list from the writers below it, so a key can pass validation and
	// then be dropped in silence — a 200 saying "applied 1" over a column nothing
	// touched, which is the worst shape a write can fail in.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "book", "id": made.ID,
			"set": map[string]any{"publisher": "Ace Books"},
		}},
	}, http.StatusOK)
	got = decode[bookEdition](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.Publisher != "Ace Books" {
		t.Fatalf("an admitted field was not written: %q", got.Publisher)
	}
}
