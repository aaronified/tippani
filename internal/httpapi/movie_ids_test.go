package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

// TestMovieSupplierIDsEditable pins the rules of the hand-typed TMDB/TVDB id:
// a save with a title writes the columns, a save that never mentions them
// leaves them alone (they are not full-state), 0 clears, a negative number is
// refused, and an id another title already holds is a 409 rather than a 500.
func TestMovieSupplierIDsEditable(t *testing.T) {
	srv := newTestServer(t) // no supplier key: editing an id needs no lookup
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Persuasion"}, http.StatusCreated))
	if m.TMDBID != 0 || m.TVDBID != 0 {
		t.Fatalf("manual add should carry no supplier id: %+v", m)
	}

	// Typing both ids.
	got := decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "Persuasion", "tmdb_id": 65754, "tvdb_id": 11111,
	}, 200))
	if got.TMDBID != 65754 || got.TVDBID != 11111 {
		t.Fatalf("ids not stored: %+v", got)
	}

	// A save that says nothing about them keeps them. This is the whole reason
	// the fields are pointers: an older client PUTs a full record without ever
	// having heard of tmdb_id, and must not wipe it by omission.
	got = decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(m.ID),
		map[string]any{"title": "Persuasion", "director": "Roger Michell"}, 200))
	if got.TMDBID != 65754 || got.TVDBID != 11111 {
		t.Fatalf("ids lost by an omitting save: %+v", got)
	}

	// An explicit 0 is how you clear one, and it clears only the one named.
	got = decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(m.ID),
		map[string]any{"title": "Persuasion", "tvdb_id": 0}, 200))
	if got.TMDBID != 65754 || got.TVDBID != 0 {
		t.Fatalf("clear should touch tvdb_id only: %+v", got)
	}

	// Nonsense is refused before it reaches the column.
	c.mustDo("PUT", "/movies/"+itoa(m.ID),
		map[string]any{"title": "Persuasion", "tmdb_id": -1}, http.StatusBadRequest)

	// An id another of your titles already holds: 409, naming the collision,
	// rather than the opaque unique-index failure it would otherwise be.
	other := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Persuasion (1995)"}, http.StatusCreated))
	rec := c.mustDo("PUT", "/movies/"+itoa(other.ID),
		map[string]any{"title": "Persuasion (1995)", "tmdb_id": 65754}, http.StatusConflict)
	if body := rec.Body.String(); !strings.Contains(body, "already has that id") {
		t.Fatalf("409 should name the clash: %s", body)
	}

	// Re-typing the id a title already holds is not a clash with itself.
	c.mustDo("PUT", "/movies/"+itoa(m.ID),
		map[string]any{"title": "Persuasion", "tmdb_id": 65754}, 200)
}

// TestMovieUpdateLegacyTMDBIDStillResyncs guards the older verb: a PUT whose
// whole body is {"tmdb_id": N} predates source/source_id and still means
// "re-sync from TMDB". It is told apart from an id edit by having no title,
// which a full-state save can never legitimately omit.
func TestMovieUpdateLegacyTMDBIDStillResyncs(t *testing.T) {
	srv := newTestServer(t)
	fake := newMatrixTMDB(t)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Matrix, The"}, http.StatusCreated))
	got := decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(m.ID),
		map[string]any{"tmdb_id": 603}, 200))
	if got.Title != "The Matrix" || got.Director != "Lana Wachowski" || got.TMDBID != 603 {
		t.Fatalf("bare tmdb_id should re-sync, not just set a column: %+v", got)
	}
}

// newPinTMDB is a fake TMDB where the title search and the pinned id disagree:
// searching finds 603, but id 604 is a different film the search never returns.
// That gap is what a typed id exists to close.
func newPinTMDB(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			_, _ = w.Write([]byte(`{"results":[{"id":603,"title":"The Matrix","release_date":"1999-03-31","poster_path":"/a.jpg"}]}`))
		case "/movie/603":
			_, _ = w.Write([]byte(`{"id":603,"title":"The Matrix","release_date":"1999-03-31"}`))
		case "/movie/604":
			_, _ = w.Write([]byte(`{"id":604,"title":"The Matrix Reloaded","release_date":"2003-05-15","poster_path":"/b.jpg"}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

type lookupResp struct {
	Candidates []metadata.MovieCandidate `json:"candidates"`
}

// TestMovieLookupPinsSuppliedID covers the search half of the feature: an id in
// the lookup body fetches that exact record and lists it first, the title hits
// follow, and a record that is both pinned and found appears once.
func TestMovieLookupPinsSuppliedID(t *testing.T) {
	srv := newTestServer(t)
	fake := newPinTMDB(t)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Title + a pinned id the title search does not return: pinned goes first.
	got := decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Matrix", "tmdb_id": 604}, 200))
	if len(got.Candidates) != 2 {
		t.Fatalf("want pinned + searched: %+v", got.Candidates)
	}
	if got.Candidates[0].TMDBID != 604 || got.Candidates[0].Title != "The Matrix Reloaded" {
		t.Fatalf("pinned candidate should lead: %+v", got.Candidates)
	}
	if got.Candidates[1].TMDBID != 603 {
		t.Fatalf("title hits should follow: %+v", got.Candidates)
	}
	// The pinned record is a details fetch, whose poster is the storage-size
	// original — the picker draws it at thumbnail size, so it must arrive as one.
	if got.Candidates[0].PosterURL != "https://image.tmdb.org/t/p/w342/b.jpg" {
		t.Fatalf("pinned poster should be the picker thumbnail: %q", got.Candidates[0].PosterURL)
	}

	// An id with no title at all: the pin is the entire lookup.
	got = decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"tmdb_id": 604}, 200))
	if len(got.Candidates) != 1 || got.Candidates[0].TMDBID != 604 {
		t.Fatalf("id-only lookup: %+v", got.Candidates)
	}

	// Pinning what the search would also return lists it once, not twice.
	got = decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Matrix", "tmdb_id": 603}, 200))
	if len(got.Candidates) != 1 || got.Candidates[0].TMDBID != 603 {
		t.Fatalf("pinned + found should dedupe: %+v", got.Candidates)
	}

	// Neither a title nor an id is nothing to look up.
	c.mustDo("POST", "/movies/lookup", map[string]any{}, http.StatusBadRequest)

	// A pin that misses, with nothing else asked for, reports the supplier's
	// failure rather than pretending the search came back empty.
	c.mustDo("POST", "/movies/lookup", map[string]any{"tmdb_id": 999}, http.StatusBadGateway)
}

// TestMovieLookupPinsTVDBID is the TheTVDB half: the same pin, through the
// login-then-bearer client, for a show.
func TestMovieLookupPinsTVDBID(t *testing.T) {
	srv := newTestServer(t)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login":
			_, _ = w.Write([]byte(`{"data":{"token":"tok"}}`))
		case "/series/121361/extended":
			_, _ = w.Write([]byte(`{"data":{"id":121361,"name":"Game of Thrones","year":"2011",
				"image":"https://artworks.thetvdb.com/banners/posters/121361-1.jpg"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer fake.Close()
	srv.TVDB = &metadata.TVDB{Key: "testkey", BaseURL: fake.URL}
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"tvdb_id": 121361, "media_type": "show"}, 200))
	if len(got.Candidates) != 1 {
		t.Fatalf("want the pinned series: %+v", got.Candidates)
	}
	p := got.Candidates[0]
	if p.Source != "tvdb" || p.SourceID != "121361" || p.MediaType != "show" ||
		p.Title != "Game of Thrones" || p.ReleaseYear != 2011 {
		t.Fatalf("pinned series: %+v", p)
	}
}

// THETVDB LEADS THE PICKER (2.2.0), and this is the whole of what "the default
// film/show source" means.
//
// Both suppliers are still consulted and every hit is still offered; what changed
// is the order they arrive in. It matters because a reader taking the first
// sensible-looking match is how a title gets pinned, and the record they end up
// pinned to decides whether the app can ever show a character in costume — a
// TheTVDB character record carries an image per role and TMDB has none at any
// endpoint.
//
// Asserted BY ORDER rather than by presence, because presence was already true
// before the change and a test that only checks both are there would have passed
// under the old order too.
func TestTheTVDBLeadsThePickerAndTMDBFollows(t *testing.T) {
	srv := newTestServer(t)

	tmdbFake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/search/movie" {
			_, _ = w.Write([]byte(`{"results":[{"id":297761,"title":"Suicide Squad","release_date":"2016-08-05"}]}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer tmdbFake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = tmdbFake.URL

	tvdbFake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login":
			_, _ = w.Write([]byte(`{"data":{"token":"tok"}}`))
		case "/search":
			_, _ = w.Write([]byte(`{"data":[{"tvdb_id":"297","name":"Suicide Squad","year":"2016","type":"movie"}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer tvdbFake.Close()
	srv.TVDB = &metadata.TVDB{Key: "testkey", BaseURL: tvdbFake.URL}

	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Suicide Squad"}, 200))
	if len(got.Candidates) != 2 {
		t.Fatalf("both suppliers should still be consulted: %+v", got.Candidates)
	}
	if got.Candidates[0].Source != "tvdb" {
		t.Errorf("first candidate came from %q, want tvdb — TheTVDB is the default source",
			got.Candidates[0].Source)
	}
	if got.Candidates[1].Source != "tmdb" {
		t.Errorf("second candidate came from %q, want tmdb — the fallback is still offered",
			got.Candidates[1].Source)
	}
}

// WITH NEITHER KEY, THE MESSAGE NAMES THE DEFAULT. It used to name TMDB, which
// since 2.2.0 sends somebody to configure the fallback instead of the default —
// a wrong turn the app itself caused.
func TestNoFilmSourceConfiguredNamesTheTVDBFirst(t *testing.T) {
	srv := newTestServer(t)
	srv.TMDB.Key = ""
	srv.TVDB = nil
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := c.mustDo("POST", "/movies/lookup", map[string]any{"title": "Suicide Squad"},
		http.StatusServiceUnavailable)
	body := res.Body.String()
	if !strings.Contains(body, "TheTVDB") {
		t.Errorf("message does not mention TheTVDB: %s", body)
	}
	if !strings.Contains(body, "TMDB") {
		t.Errorf("message should still offer TMDB as the alternative: %s", body)
	}
	if strings.Index(body, "TheTVDB") > strings.Index(body, "TMDB") {
		t.Errorf("TMDB is named before TheTVDB, so the reader is sent to the fallback: %s", body)
	}
}
