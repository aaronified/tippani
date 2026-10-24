package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"testing"

	"tippani/internal/metadata"
)

// TAKING A MATCH CREDITS ITS SUPPLIER. The owner: "I have added new books and
// movies since then and have used the looked up results. They too do not show
// the provider glyphs or increase the number. And it should track if i am
// re-scanning/fetching missing and taking fields from there." Taking a lookup
// match onto a work you already have went through the edit endpoint, which
// recorded every changed field as the reader's. These are the API journeys of
// each path that writes a work's fields, read back through the work's own
// field_sources, which is what the Details panel's tags and the Sources counts
// read.
//
// SETUP KNOWS the addresses and fields the other field-source tests use, plus
// the edit body's `sources` map; the seams the offline server needs to have a
// supplier answer, srv.searchBooks for a book and srv.TMDB and srv.TVDB pointed
// at fakes (portraitTMDB, newTVDBCastStub) for a film; and the re-verify reply's
// `diffs` and `offers`, with each one's `alts` and `source`, which is what the
// review and the Details panel's field picker read.

func putBook(t *testing.T, c *testClient, id int64, body map[string]any) {
	t.Helper()
	c.mustDo("PUT", "/books/"+strconv.FormatInt(id, 10), body, http.StatusOK)
}

func TestTakingAMatchOnABookCreditsTheSupplierAndKeepsWhatYouTyped(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{"title": "Earthsea", "author": "Le Guin"}, http.StatusCreated))

	putBook(t, c, b.ID, map[string]any{
		"title": "A Wizard of Earthsea", "author": "Le Guin",
		"description": "Sparrowhawk goes to Roke.", "published_year": 1968, "pages": 205,
		// The description and year came from the match; the title the reader
		// retyped; the author is named but unchanged; one supplier is not a book's.
		"sources": map[string]string{"description": "openlibrary", "published_year": "google", "author": "openlibrary", "pages": "tvdb"},
	})
	got := booksSourcesByField(t, c, b.ID)
	want := map[string]string{"description": "openlibrary", "published_year": "google", "title": "manual", "pages": "manual", "author": "manual"}
	for f, w := range want {
		if got[f] != w {
			t.Errorf("%s is credited to %q, want %q (%v)", f, got[f], w, got)
		}
	}
}

func TestAnApprovedImportCreditsTheFileForWhatItBrought(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	md := "---\ntitle: Andor\ntype: show\nyear: 2022\ndirector: Tony Gilroy\n---\n\n> One way out.\n- character: Kino\n"
	res := decode[struct {
		MovieID int64 `json:"movie_id"`
	}](t, c.importApprove("/import/markdown", "andor.md", []byte(md)))
	got := sourcesByField(t, c, res.MovieID)
	for _, f := range []string{"title", "release_year", "director"} {
		if got[f] != "import" {
			t.Errorf("%s came in the file and is credited to %q (%v)", f, got[f], got)
		}
	}
}

// A MERGED MATCH IS CREDITED FIELD BY FIELD ON THE PATHS THAT FILL GAPS TOO. An
// ISBN search merges Google's and Open Library's answers into one candidate and
// names, per field, the half that gave it; Fetch covers and details and Fill gaps
// gave every field to the merge's primary supplier, so a year Open Library gave
// read Google.
func TestAMergedMatchIsCreditedFieldByFieldWhenItFillsGaps(t *testing.T) {
	for _, press := range []struct {
		path string
		body func(int64) map[string]any
	}{
		{"/covers/refetch", func(int64) map[string]any { return map[string]any{} }},
		{"/metadata/fill", func(id int64) map[string]any { return map[string]any{"book_ids": []int64{id}} }},
	} {
		srv := newTestServer(t)
		srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
			return []metadata.BookCandidate{{Source: "google", SourceID: "g1", Title: "Dune", ISBN13: isbn,
				Author: "Frank Herbert", PublishedYear: 1965, CoverURL: "https://covers.example/dune.jpg",
				Sources: map[string]string{"published_year": "openlibrary", "cover": "openlibrary"}}}, nil
		}
		srv.fetchImage = func(_ context.Context, u, _ string) (string, error) {
			if u == "https://covers.example/dune.jpg" {
				return "cccccccccccccccc.jpg", nil
			}
			return "", errors.New("not this one")
		}
		c := signupAdmin(t, srv.Handler())
		b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune", "isbn": "9780441013593"}, http.StatusCreated))
		c.mustDo("POST", press.path, press.body(b.ID), http.StatusOK)
		got := booksSourcesByField(t, c, b.ID)
		if got["published_year"] != "openlibrary" || got["author"] != "google" {
			t.Errorf("%s: the year is credited to %q and the author to %q, want openlibrary and google (%v)",
				press.path, got["published_year"], got["author"], got)
		}
		if got["cover"] != "openlibrary" {
			t.Errorf("%s: the cover Open Library gave is credited to %q (%v)", press.path, got["cover"], got)
		}
	}
}

// A RE-VERIFY OF A MERGED MATCH SAYS WHICH HALF GAVE EACH FIELD, on the diff and
// on the field's offer, so the review's apply and the Details field picker credit
// it there. The per-field credit stayed on the server, and only Fill gaps could
// use it: a Re-verify taken as offered credited Open Library's year to Google.
func TestARecheckOfAMergedMatchNamesTheHalfThatGaveEachField(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{Source: "google", SourceID: "g1", Title: "Dune", ISBN13: isbn,
			Author: "Frank Herbert", PublishedYear: 1965,
			Sources: map[string]string{"published_year": "openlibrary"}}}, nil
	}
	c := signupAdmin(t, srv.Handler())
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune", "isbn": "9780441013593"}, http.StatusCreated))
	type row struct {
		Field  string `json:"field"`
		Source string `json:"source"`
		Alts   []struct {
			Source string `json:"source"`
		} `json:"alts"`
	}
	res := decode[struct {
		Items []struct {
			Diffs  []row `json:"diffs"`
			Offers []row `json:"offers"`
		} `json:"items"`
	}](t, c.mustDo("POST", "/metadata/reverify", map[string]any{"book_ids": []int64{b.ID}, "offers": true}, http.StatusOK))
	by := map[string]row{}
	for _, d := range res.Items[0].Diffs {
		by[d.Field] = d
	}
	if by["published_year"].Source != "openlibrary" || by["author"].Source != "" {
		t.Errorf("the diffs name year %q and author %q, want openlibrary and the item's own (%+v)",
			by["published_year"].Source, by["author"].Source, res.Items[0].Diffs)
	}
	for _, o := range res.Items[0].Offers {
		if o.Field == "published_year" && (len(o.Alts) == 0 || o.Alts[0].Source != "openlibrary") {
			t.Errorf("the year is offered under %+v, want Open Library", o.Alts)
		}
	}
}

