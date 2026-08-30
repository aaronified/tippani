package metadata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// THE SLUG IS THE GUESS, so it is tested before anything is fetched.
//
// Letterboxd KEEPS a leading article where a Fandom wiki drops it — "the-matrix"
// against "matrix" — which is the opposite convention. Stated here as a test so
// the two guesses are not later "tidied" into agreement and quietly broken.
func TestLetterboxdSlugFollowsLetterboxdsOwnConvention(t *testing.T) {
	for _, tc := range []struct{ title, want string }{
		{"V for Vendetta", "v-for-vendetta"},
		{"The Matrix", "the-matrix"}, // the article STAYS, unlike a Fandom wiki
		{"Star Wars: A New Hope", "star-wars-a-new-hope"},
		{"WALL·E", "wall-e"},
		{"8½", "8"},
		{"  Heat  ", "heat"},
		{"", ""},
	} {
		if got := LetterboxdSlug(tc.title); got != tc.want {
			t.Errorf("LetterboxdSlug(%q) = %q, want %q", tc.title, got, tc.want)
		}
	}
}

// The page's own schema.org record, in the shape a real one has — verified
// against letterboxd.com/film/v-for-vendetta/ before this was written, including
// the comment wrapper around the JSON and the year living OUTSIDE it.
const lbPage = `<html><head>
<script type="application/ld+json">
/* <![CDATA[ */
{"@type":"Movie","name":"V for Vendetta",
 "description":"In a world in which Great Britain has become a fascist state...",
 "image":"https://a.ltrbxd.com/resized/film-poster/5/1/4/0/0/51400-v-for-vendetta.jpg",
 "genre":["Thriller","Science Fiction"],
 "director":[{"@type":"Person","name":"James McTeigue"}],
 "actor":[{"@type":"Person","name":"Natalie Portman"},{"@type":"Person","name":"Hugo Weaving"}]}
/* ]]> */
</script></head><body><a href="/films/year/2005/">2005</a></body></html>`

func TestLetterboxdReadsThePublishedRecordAndTheYearBesideIt(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/film/v-for-vendetta/") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(lbPage))
	}))
	defer srv.Close()
	SetLetterboxdBaseForTest(t, srv.URL)

	d, err := LetterboxdDetails(context.Background(), "V for Vendetta")
	if err != nil || d == nil {
		t.Fatalf("no record: %v / %+v", err, d)
	}
	if d.Title != "V for Vendetta" || d.Director != "James McTeigue" {
		t.Errorf("title/director: %q / %q", d.Title, d.Director)
	}
	// THE YEAR IS NOT IN THE JSON-LD and is read from the page's year link. If
	// that ever moves, the year is dropped and everything else still arrives —
	// which is the behaviour the next assertion protects.
	if d.ReleaseYear != 2005 {
		t.Errorf("release year = %d, want 2005", d.ReleaseYear)
	}
	if !strings.HasPrefix(d.Overview, "In a world") {
		t.Errorf("overview: %q", d.Overview)
	}
	if d.Source != "letterboxd" || d.SourceID != "v-for-vendetta" {
		t.Errorf("the record does not name itself: %q / %q", d.Source, d.SourceID)
	}
	// CAST WITHOUT CHARACTERS, because schema.org's `actor` carries no role. The
	// names arrive; nothing invents a character for them.
	if len(d.Cast) != 2 || d.Cast[0].Actor != "Natalie Portman" || d.Cast[0].Character != "" {
		t.Errorf("cast: %+v", d.Cast)
	}

	// A WRONG GUESS IS A 404 AND IS SILENCE, not an error: this rung guesses, and
	// a rung that could fail the request it is one of would make every mis-slugged
	// title break a re-verify.
	got, err := LetterboxdDetails(context.Background(), "Some Film That Is Not There")
	if err != nil || got != nil {
		t.Errorf("a missed guess was not silent: %+v / %v", got, err)
	}
}

// A page with no published record is not a partially-read one. The discipline
// every scrape here follows: silence rather than partial garbage.
func TestLetterboxdRefusesAPageWithNoStructuredRecord(t *testing.T) {
	if _, err := parseLetterboxd([]byte(`<html><body>nothing here</body></html>`), "x"); err == nil {
		t.Error("a page with no JSON-LD was accepted")
	}
	if _, err := parseLetterboxd([]byte(`<script type="application/ld+json">{"@type":"Movie"}</script>`), "x"); err == nil {
		t.Error("a record with no title was accepted")
	}
}
