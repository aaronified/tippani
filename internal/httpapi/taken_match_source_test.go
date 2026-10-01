package httpapi

import (
	"net/http"
	"strconv"
	"testing"
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
// the edit body's `sources` map.

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
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies", map[string]any{"title": "Ran"}, http.StatusCreated))
	if got := sourcesByField(t, c, m.ID); got["title"] != "manual" {
		t.Errorf("a film typed in by hand is not the reader's: %v", got)
	}
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "Ran", "director": "Akira Kurosawa", "release_year": 1985, "genres": []string{"Drama"},
		"sources": map[string]string{"director": "tmdb", "release_year": "letterboxd", "genres": "tmdb"},
	}, http.StatusOK)
	got := sourcesByField(t, c, m.ID)
	for f, w := range map[string]string{"director": "tmdb", "release_year": "letterboxd", "genres": "tmdb"} {
		if got[f] != w {
			t.Errorf("%s is credited to %q, want %q (%v)", f, got[f], w, got)
		}
	}
	// A ♥ press re-posts the same genres in another casing: not an edit.
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "Ran", "director": "Akira Kurosawa", "release_year": 1985, "genres": []string{"drama"}, "favorite": true,
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
