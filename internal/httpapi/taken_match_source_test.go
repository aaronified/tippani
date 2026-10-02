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

func TestTakingAFilmMatchCreditsEachSupplier(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies", map[string]any{"title": "Ran", "series": "Kurosawa", "series_index": 2}, http.StatusCreated))
	if got := sourcesByField(t, c, m.ID); got["title"] != "manual" || got["series_index"] != "manual" {
		t.Errorf("a film typed in by hand is not the reader's, field by field: %v", got)
	}
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "Ran", "director": "Akira Kurosawa", "release_year": 1985, "genres": []string{"Drama", "War"},
		"sources": map[string]string{"director": "tmdb", "release_year": "letterboxd", "genres": "tmdb"},
	}, http.StatusOK)
	got := sourcesByField(t, c, m.ID)
	for f, w := range map[string]string{"director": "tmdb", "release_year": "letterboxd", "genres": "tmdb"} {
		if got[f] != w {
			t.Errorf("%s is credited to %q, want %q (%v)", f, got[f], w, got)
		}
	}
	// A ♥ press re-posts the same genres in another order and casing: not an edit.
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "Ran", "director": "Akira Kurosawa", "release_year": 1985, "genres": []string{"war", "drama"}, "favorite": true,
	}, http.StatusOK)
	if got := sourcesByField(t, c, m.ID); got["genres"] != "tmdb" {
		t.Errorf("re-posting the same genres took them from tmdb: %v", got)
	}
}

func TestAddingAMergedBookCreditsEachFieldToItsSupplier(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Middlemarch", "author": "George Eliot", "pages": 880,
		"source": "google", "source_id": "g1", "sources": map[string]string{"title": "openlibrary"},
	}, http.StatusCreated))
	got := booksSourcesByField(t, c, b.ID)
	if got["title"] != "openlibrary" || got["author"] != "google" || got["pages"] != "google" {
		t.Errorf("a merged match was not credited field by field: %v", got)
	}
	unknown := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Romola", "source": "tvdb", "source_id": "x",
	}, http.StatusCreated))
	if got := booksSourcesByField(t, c, unknown.ID); len(got) != 0 {
		t.Errorf("a source no book can have was written: %v", got)
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

// AN IMPORTED BOOK IS CREDITED TO THE FILE TOO, on both of the import's writes:
// a new book, and a gap in one already on the shelf, where what the reader
// typed keeps its credit.
func TestAnApprovedImportCreditsTheFileForABook(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	md := "---\ntitle: Middlemarch\nauthor: George Eliot\n---\n\n> A quote.\n"
	if rec := c.importApprove("/import/markdown", "mm.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Books []struct{ ID int64 } `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 {
		t.Fatalf("expected one imported book, got %d", len(list.Books))
	}
	if got := booksSourcesByField(t, c, list.Books[0].ID); got["title"] != "import" || got["author"] != "import" {
		t.Errorf("a new book from a file is not credited to the import: %v", got)
	}

	typed := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{"title": "Romola", "isbn": "9780140434705"}, http.StatusCreated))
	md = "---\ntitle: Romola\nauthor: George Eliot\nisbn: 9780140434705\n---\n\n> Another.\n"
	if rec := c.importApprove("/import/markdown", "romola.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	if got := booksSourcesByField(t, c, typed.ID); got["title"] != "manual" || got["author"] != "import" {
		t.Errorf("an import filling a gap: %v, want the typed title the reader's and the author the import's", got)
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

// A FILM'S FILL CREDITS THE SUPPLIER THAT ANSWERED. A film pinned to TheTVDB and
// TMDB whose TheTVDB read fails is filled from TMDB, and the fill passed no
// credit, so the apply fell back to the pin order and named TheTVDB.
func TestAFilmFillCreditsTheSupplierThatAnswered(t *testing.T) {
	srv := newTestServer(t)
	tmdb := portraitTMDB(t, `[]`)
	t.Cleanup(tmdb.Close)
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = tmdb.URL
	st, client, done := newTVDBCastStub(t, `{}`)
	t.Cleanup(done)
	st.code = http.StatusInternalServerError
	srv.TVDB = client
	c := signupAdmin(t, srv.Handler())
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies", map[string]any{"title": "Portal 2", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{"title": "Portal 2", "media_type": "movie", "tvdb_id": 70, "tmdb_id": 603}, http.StatusOK)
	c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{m.ID}}, http.StatusOK)
	if got := sourcesByField(t, c, m.ID); got["description"] != "tmdb" {
		t.Errorf("the description TMDB gave is credited to %q (%v)", got["description"], got)
	}
}
