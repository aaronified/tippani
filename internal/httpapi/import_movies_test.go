package httpapi

import (
	"net/http"
	"testing"
)

// vForVendettaQuotes is a minimal saved IMDb quotes page (the shape imdb.go's
// regexes read): year 2005, one single-speaker exchange and one two-speaker
// exchange. Year 2005 differs on purpose from the TMDB release year (2006) so
// the test exercises anchoring across a year mismatch.
const vForVendettaQuotes = `<html><body><script id="__NEXT_DATA__" type="application/json">` +
	`{"props":{"pageProps":{"contentData":{"data":{"title":{"id":"tt0434409",` +
	`"titleText":{"text":"V for Vendetta","__typename":"TitleText"},` +
	`"releaseYear":{"year":2005,"endYear":null,"__typename":"YearRange"},` +
	`"titleType":{"id":"movie","text":"Movie","isSeries":false,"__typename":"TitleType"},` +
	`"quotes":{"total":2,"edges":[` +
	`{"node":{"__typename":"TitleQuote","id":"qt1","displayableArticle":{"body":{"plainText":"\n* V: People should not be afraid of their governments.\n","__typename":"Markdown"}}}},` +
	`{"node":{"__typename":"TitleQuote","id":"qt2","displayableArticle":{"body":{"plainText":"\n* Evey: Who are you?\n* V: I am V.\n","__typename":"Markdown"}}}}` +
	`]}}}}}}}</script></body></html>`

type imdbImportResp struct {
	MovieID      int64  `json:"movie_id"`
	MediaType    string `json:"media_type"`
	Title        string `json:"title"`
	Created      bool   `json:"created"`
	Anchored     bool   `json:"anchored"`
	YearImported int    `json:"year_imported"`
	MatchedYear  int    `json:"matched_year"`
	Ambiguous    bool   `json:"ambiguous"`
	Alternatives int    `json:"alternatives"`
	Added        int    `json:"added"`
	Skipped      int    `json:"skipped"`
}

type movieListResp struct {
	Movies []struct {
		ID            int64 `json:"id"`
		DialogueCount int   `json:"dialogue_count"`
	} `json:"movies"`
}

// TestIMDbImportAnchors covers the reported bug: a title added first (via a
// lookup, year 2006) must have imported IMDb dialogues (year 2005) attach to it
// rather than spawn a poster-less duplicate — and the response reports the
// anchor + year mismatch for the review UI.
func TestIMDbImportAnchors(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// "Added prior": a curated row (a lookup would set the year to 2006).
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "V for Vendetta", "release_year": 2006}, http.StatusCreated))

	// Import the quotes page — must anchor onto m, not create a second title.
	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if res.MovieID != m.ID || res.Created || !res.Anchored {
		t.Fatalf("expected anchor onto movie %d, got %+v", m.ID, res)
	}
	if res.YearImported != 2005 || res.MatchedYear != 2006 {
		t.Fatalf("year reporting: %+v", res)
	}
	if res.Added != 2 || res.Skipped != 0 || res.Ambiguous {
		t.Fatalf("dialogue counts: %+v", res)
	}

	// Exactly one title, carrying both dialogues (no duplicate spawned).
	list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200))
	if len(list.Movies) != 1 || list.Movies[0].ID != m.ID || list.Movies[0].DialogueCount != 2 {
		t.Fatalf("library after import: %+v", list.Movies)
	}

	// Re-import is idempotent: same dialogues skipped, still one title.
	res2 := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if res2.Added != 0 || res2.Skipped != 2 {
		t.Fatalf("re-import not idempotent: %+v", res2)
	}
	if list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200)); len(list.Movies) != 1 {
		t.Fatalf("re-import spawned a title: %+v", list.Movies)
	}
}

// TestIMDbImportCreatesWhenNoMatch: with no same-title film present, the import
// creates a new bare row (the pre-anchoring behaviour, still correct).
func TestIMDbImportCreatesWhenNoMatch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if !res.Created || res.Anchored || res.Added != 2 {
		t.Fatalf("expected a fresh create, got %+v", res)
	}
	if res.Title != "V for Vendetta" || res.MediaType != "movie" {
		t.Fatalf("header: %+v", res)
	}
}

// TestIMDbImportAmbiguous: two same-title films → the import anchors to one and
// flags the ambiguity so the review UI can prompt a check.
func TestIMDbImportAmbiguous(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/movies", map[string]any{"title": "V for Vendetta", "release_year": 2006}, http.StatusCreated)
	c.mustDo("POST", "/movies", map[string]any{"title": "V for Vendetta", "release_year": 1988}, http.StatusCreated)

	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if !res.Anchored || !res.Ambiguous || res.Alternatives != 1 {
		t.Fatalf("expected ambiguous anchor, got %+v", res)
	}
	// The 2005 import should have preferred neither-year-match; both lack posters
	// and dialogues, so recency wins — the 1988 row was created last.
	if list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200)); len(list.Movies) != 2 {
		t.Fatalf("ambiguous import spawned a title: %+v", list.Movies)
	}
}

// importMediaType is the last word on a parsed file's media type, so every value
// the shelf accepts has to survive it. It folded everything but "show" into
// "movie", which quietly cancelled whatever the parsers worked out: an IMDb game
// page or a "type: game" file arrived correctly typed and was filed as a film.
func TestImportMediaTypeKeepsTheWholeVocabulary(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"movie", "movie"},
		{"show", "show"},
		{"game", "game"},
		{"", "movie"},          // unset: the shelf's own default
		{"videoGame", "movie"}, // IMDb's spelling is not the shelf's
		{"anything else", "movie"},
	} {
		if got := importMediaType(tc.in); got != tc.want {
			t.Errorf("importMediaType(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
	// Whatever normalizeMediaType accepts from a client, this must preserve:
	// the two cannot drift apart without an import silently retyping a work.
	for _, mt := range []string{"movie", "show", "game"} {
		v := mt
		if msg := normalizeMediaType(&v); msg != "" {
			t.Fatalf("normalizeMediaType(%q) rejected it: %s", mt, msg)
		}
		if got := importMediaType(mt); got != mt {
			t.Errorf("client may send %q but an import folds it to %q", mt, got)
		}
	}
}
