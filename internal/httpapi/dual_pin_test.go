package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"tippani/internal/metadata"
	"tippani/internal/store"
)

// A TITLE PINNED TO BOTH SUPPLIERS, which is not an exotic state.
//
// 2.2.0 made TheTVDB the default film and show source. The lookup route says so,
// the Settings card says so, and the message a keyless install gets names
// TheTVDB as the one to configure first. Re-verify does not: its switch tries
// TMDB first, so a row carrying both ids fetches everything from TMDB for ever.
//
// And a row acquires both ids by ordinary use — re-verify itself offers a
// `tvdb_id` diff whenever TheTVDB's record carries one, so accepting that diff
// is how a TMDB title gains a TheTVDB id. The reader is thereby invited to do
// the thing that makes the default stop applying to them.
//
// The notice makes it worse rather than catching it: it counts titles matching
// `tmdb_id IS NOT NULL AND tvdb_id IS NULL`, so the moment a row has both it
// leaves the count. It is still fetching from TMDB, and the app has stopped
// saying so.

// bothSuppliers stands up a TMDB and a TheTVDB that each answer for the same
// film, and counts who was actually asked.
func bothSuppliers(t *testing.T) (tmdbHits, tvdbHits *int, tmdbURL, tvdbURL string) {
	t.Helper()
	var th, vh int
	tmdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		th++
		_, _ = w.Write([]byte(`{"id":603,"title":"The Matrix","release_date":"1999-03-30",
			"overview":"From TMDB.","credits":{"cast":[]}}`))
	}))
	t.Cleanup(tmdb.Close)
	tvdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/login" {
			_, _ = w.Write([]byte(`{"status":"success","data":{"token":"tok"}}`))
			return
		}
		vh++
		_, _ = w.Write([]byte(`{"data":{"id":70,"name":"The Matrix","year":"1999",
			"overview":"From TheTVDB.","characters":[]}}`))
	}))
	t.Cleanup(tvdb.Close)
	return &th, &vh, tmdb.URL, tvdb.URL
}

func TestATitlePinnedToBothIsFetchedFromTheDefaultSource(t *testing.T) {
	srv := newTestServer(t)
	tmdbHits, tvdbHits, tmdbURL, tvdbURL := bothSuppliers(t)
	srv.TMDB.Key, srv.TMDB.BaseURL = "k", tmdbURL
	srv.TVDB = &metadata.TVDB{Key: "k", BaseURL: tvdbURL}
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "The Matrix", "media_type": "movie", "tmdb_id": 603, "tvdb_id": 70,
	}, http.StatusOK)

	*tmdbHits, *tvdbHits = 0, 0
	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, 200))

	// THE DEFAULT FILM SOURCE IS TheTVDB. A row that has a TheTVDB id should be
	// read from TheTVDB; TMDB is the fallback, which is what every other surface
	// in the app already tells the reader.
	if res.Items[0].Source != "tvdb" {
		t.Errorf("re-verify read a dual-pinned title from %q, want tvdb — the resolver "+
			"contradicts the default the rest of the app states", res.Items[0].Source)
	}
	if *tvdbHits == 0 {
		t.Error("TheTVDB was never asked about a title pinned to it")
	}
	if *tmdbHits > 0 {
		t.Errorf("TMDB was asked %d time(s) for a title TheTVDB can answer", *tmdbHits)
	}
}

// THE NOTICE MUST NOT GO QUIET ON A TITLE THAT IS STILL ON TMDB.
//
// The count is what makes the notice self-clearing, so what it counts has to be
// "titles this reader still fetches from TMDB" and nothing else. A row with no
// TheTVDB id is exactly that. A row with both is NOT — once the resolver prefers
// TheTVDB it genuinely is on the new source — so the two halves of this test
// pin the same rule from both sides.
func TestTheStillOnTMDBCountMeansWhatItSays(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	if err := srv.Store.SetSetting(store.SettingFilmSourceNotice, "2.2.0"); err != nil {
		t.Fatal(err)
	}

	only := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Heat", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(only.ID, 10), map[string]any{
		"title": "Heat", "media_type": "movie", "tmdb_id": 949,
	}, http.StatusOK)

	both := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(both.ID, 10), map[string]any{
		"title": "The Matrix", "media_type": "movie", "tmdb_id": 603, "tvdb_id": 70,
	}, http.StatusOK)

	n := noticeOf(t, c).Notice
	if n == nil {
		t.Fatal("no notice for a reader with a TMDB-only title")
	}
	// One, not two: Heat is still on TMDB and The Matrix is not.
	if n.TMDBPinned != 1 {
		t.Errorf("count = %d, want 1 — the notice counts titles still read from TMDB, "+
			"and a dual-pinned row is read from TheTVDB", n.TMDBPinned)
	}
}
