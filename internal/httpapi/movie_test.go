package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type dlgList struct {
	Dialogues []dialogueRow `json:"dialogues"`
}

func TestMovieAndDialogueCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": " Casablanca ", "director": "Michael Curtiz", "release_year": 1942,
		"genres": []string{"Drama", "Romance"},
	}, http.StatusCreated))
	if m.Title != "Casablanca" || m.TMDBID != 0 || len(m.Cast) != 0 ||
		!sameStrings(m.Genres, []string{"Drama", "Romance"}) {
		t.Fatalf("movie: %+v", m)
	}
	c.mustDo("POST", "/movies", map[string]any{"title": "X", "release_year": 42}, http.StatusBadRequest)

	// Seed the cast list directly (manual movies have none) to exercise the
	// PLAN §3b actor auto-fill.
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Rick Blaine","actor":"Humphrey Bogart"},{"character":"Ilsa Lund","actor":"Ingrid Bergman"}]`,
		m.ID); err != nil {
		t.Fatal(err)
	}

	// Auto-fill: case-insensitive, trimmed character match.
	d1 := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Here's looking at you, kid.",
		"character": "  rick blaine ", "timestamp": "01:15:00",
	}, http.StatusCreated))
	if d1.Actor != "Humphrey Bogart" || d1.Character != "rick blaine" {
		t.Fatalf("auto-fill: %+v", d1)
	}
	// An explicit actor is never overwritten.
	d2 := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Play it, Sam.", "character": "Ilsa Lund",
		"actor": "Someone Else", "timestamp": "00:30:00",
	}, http.StatusCreated))
	if d2.Actor != "Someone Else" {
		t.Fatalf("explicit actor overwritten: %+v", d2)
	}
	// Unknown character, no timestamp.
	d3 := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Round up the usual suspects.", "character": "Captain Renault",
	}, http.StatusCreated))
	if d3.Actor != "" {
		t.Fatalf("unexpected auto-fill: %+v", d3)
	}

	// Duplicates and validation.
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "here's LOOKING at you, kid."}, http.StatusConflict)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": " "}, http.StatusBadRequest)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m.ID, "quote": "x", "timestamp": strings.Repeat("y", 129)}, http.StatusBadRequest)

	// Order: timestamped lines lexically, untimed lines last.
	list := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(m.ID), nil, 200))
	if len(list.Dialogues) != 3 || list.Dialogues[0].ID != d2.ID ||
		list.Dialogues[1].ID != d1.ID || list.Dialogues[2].ID != d3.ID {
		t.Fatalf("order: %+v", list.Dialogues)
	}

	// Update is full state, with the same auto-fill rule.
	upd := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(d3.ID), map[string]any{
		"quote": "Round up the usual suspects.", "character": "ILSA LUND", "timestamp": "00:05:00",
	}, 200))
	if upd.Actor != "Ingrid Bergman" || upd.Timestamp != "00:05:00" {
		t.Fatalf("update: %+v", upd)
	}
	list = decode[dlgList](t, c.mustDo("GET", "/dialogues", nil, 200))
	if list.Dialogues[0].ID != d3.ID {
		t.Fatalf("order after update: %+v", list.Dialogues)
	}
	// Edit colliding with a sibling quote -> 409.
	c.mustDo("PUT", "/dialogues/"+itoa(d3.ID), map[string]any{"quote": "play it, sam."}, http.StatusConflict)

	// dialogue_count on the movie list.
	count := decode[struct {
		Movies []struct {
			DialogueCount int `json:"dialogue_count"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, 200))
	if count.Movies[0].DialogueCount != 3 {
		t.Fatalf("dialogue_count: %+v", count.Movies)
	}

	// Movie update: genre change GCs the dropped name.
	mu := decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "Casablanca", "director": "M. Curtiz", "release_year": 1942,
		"genres": []string{"Drama"},
	}, 200))
	if mu.Director != "M. Curtiz" || !sameStrings(mu.Genres, []string{"Drama"}) {
		t.Fatalf("movie update: %+v", mu)
	}
	if g := decode[namesResp](t, c.mustDo("GET", "/genres", nil, 200)); !sameStrings(g.Genres, []string{"Drama"}) {
		t.Fatalf("genres after movie update: %v", g.Genres)
	}

	// Dialogue delete, then movie delete cascades the rest + GCs genres.
	c.mustDo("DELETE", "/dialogues/"+itoa(d2.ID), nil, 200)
	c.mustDo("DELETE", "/dialogues/"+itoa(d2.ID), nil, http.StatusNotFound)
	c.mustDo("DELETE", "/movies/"+itoa(m.ID), nil, 200)
	c.mustDo("GET", "/movies/"+itoa(m.ID), nil, http.StatusNotFound)
	list = decode[dlgList](t, c.mustDo("GET", "/dialogues", nil, 200))
	if len(list.Dialogues) != 0 {
		t.Fatalf("dialogues after movie delete: %+v", list.Dialogues)
	}
	if g := decode[namesResp](t, c.mustDo("GET", "/genres", nil, 200)); len(g.Genres) != 0 {
		t.Fatalf("genres after movie delete: %v", g.Genres)
	}
}

func TestTMDBWithoutKey(t *testing.T) {
	srv := newTestServer(t) // empty TMDB key
	h := srv.Handler()
	c := signupAdmin(t, h)

	for _, req := range []struct {
		path string
		body map[string]any
	}{
		{"/movies/lookup", map[string]any{"title": "Heat"}},
		{"/movies", map[string]any{"tmdb_id": 949}},
	} {
		rec := c.mustDo("POST", req.path, req.body, http.StatusServiceUnavailable)
		if !strings.Contains(rec.Body.String(), "Settings") {
			t.Fatalf("%s: %s", req.path, rec.Body)
		}
	}
	// Manual movie entry still works without a key (PLAN §6).
	c.mustDo("POST", "/movies", map[string]any{"title": "Heat"}, http.StatusCreated)
}

func TestMovieCreateFromTMDB(t *testing.T) {
	srv := newTestServer(t)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			w.Write([]byte(`{"results":[{"id":603,"title":"The Matrix","release_date":"1999-03-31","overview":"A hacker."}]}`))
		case "/movie/603":
			if r.URL.Query().Get("append_to_response") != "credits" {
				t.Errorf("missing append_to_response=credits: %s", r.URL)
			}
			w.Write([]byte(`{"id":603,"title":"The Matrix","overview":"A hacker.","release_date":"1999-03-31",
				"poster_path":"/no-such-poster.jpg",
				"genres":[{"name":"Action"},{"name":"Science Fiction"}],
				"credits":{"cast":[{"character":"Neo","name":"Keanu Reeves"}],
				           "crew":[{"job":"Director","name":"Lana Wachowski"}]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Lookup goes through the fake.
	cands := decode[struct {
		Candidates []struct {
			TMDBID int64  `json:"tmdb_id"`
			Title  string `json:"title"`
		} `json:"candidates"`
	}](t, c.mustDo("POST", "/movies/lookup", map[string]any{"title": "Matrix"}, 200))
	if len(cands.Candidates) != 1 || cands.Candidates[0].TMDBID != 603 {
		t.Fatalf("lookup: %+v", cands.Candidates)
	}

	// Create by tmdb_id: server fetches details+credits itself. The poster
	// fetch fails (bogus path on the real image host) — non-fatal.
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603}, http.StatusCreated))
	if m.Title != "The Matrix" || m.Director != "Lana Wachowski" ||
		m.ReleaseYear != 1999 || m.TMDBID != 603 {
		t.Fatalf("movie: %+v", m)
	}
	if m.PosterPath != "" {
		t.Fatalf("poster fetch should have failed silently, got %q", m.PosterPath)
	}
	if !sameStrings(m.Genres, []string{"Action", "Science Fiction"}) ||
		len(m.Cast) != 1 || m.Cast[0].Actor != "Keanu Reeves" {
		t.Fatalf("genres/cast: %+v", m)
	}

	// source_metadata caches the raw TMDB payload.
	var meta string
	if err := srv.Store.DB.QueryRow(
		`SELECT source_metadata FROM movies WHERE id = ?`, m.ID).Scan(&meta); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(meta, `"The Matrix"`) {
		t.Fatalf("source_metadata: %s", meta)
	}

	// Dialogue auto-fill works from the TMDB-sourced cast.
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "I know kung fu.", "character": "neo",
	}, http.StatusCreated))
	if d.Actor != "Keanu Reeves" {
		t.Fatalf("auto-fill from tmdb cast: %+v", d)
	}

	// Same tmdb_id again -> 409.
	c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603}, http.StatusConflict)
}

// newMatrixTMDB is a fake TMDB serving one movie (id 603) for the add/enrich
// duplicate-confirm tests. The bogus poster path fails to fetch (non-fatal).
func newMatrixTMDB(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			_, _ = w.Write([]byte(`{"results":[{"id":603,"title":"The Matrix","release_date":"1999-03-31","overview":"A hacker.","poster_path":"/x.jpg"}]}`))
		case "/movie/603":
			_, _ = w.Write([]byte(`{"id":603,"title":"The Matrix","overview":"A hacker.","release_date":"1999-03-31",
				"genres":[{"name":"Action"}],
				"credits":{"cast":[{"character":"Neo","name":"Keanu Reeves"}],
				           "crew":[{"job":"Director","name":"Lana Wachowski"}]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

type confirmResp struct {
	NeedsConfirm bool `json:"needs_confirm"`
	Existing     []struct {
		ID            int64 `json:"id"`
		HasPoster     bool  `json:"has_poster"`
		DialogueCount int   `json:"dialogue_count"`
	} `json:"existing"`
}

// TestMovieAddConfirmDuplicate covers the "added later" direction: an add from a
// supplier that would create a second same-name title is held for confirmation
// (409 + needs_confirm + the existing rows); confirm_new then adds it separately.
func TestMovieAddConfirmDuplicate(t *testing.T) {
	srv := newTestServer(t)
	fake := newMatrixTMDB(t)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A same-name title already present (e.g. from an IMDb import — no tmdb id).
	a := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix"}, http.StatusCreated))

	// Adding tmdb 603 surfaces the look-alike for confirmation rather than dup.
	confirm := decode[confirmResp](t, c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603}, http.StatusConflict))
	if !confirm.NeedsConfirm || len(confirm.Existing) != 1 || confirm.Existing[0].ID != a.ID {
		t.Fatalf("confirm payload: %+v", confirm)
	}

	// confirm_new adds it as a distinct title (same-name films are legitimate).
	c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603, "confirm_new": true}, http.StatusCreated)
	if list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200)); len(list.Movies) != 2 {
		t.Fatalf("expected 2 titles after confirm_new: %+v", list.Movies)
	}
}

// TestMovieEnrichExisting covers the confirm dialog's "Enrich this" action: a
// PUT with source+source_id re-syncs the existing row in place (no duplicate),
// after which re-adding the same id is a plain already-in-library 409.
func TestMovieEnrichExisting(t *testing.T) {
	srv := newTestServer(t)
	fake := newMatrixTMDB(t)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix"}, http.StatusCreated))
	m := decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(a.ID),
		map[string]any{"source": "tmdb", "source_id": "603"}, 200))
	if m.ID != a.ID || m.TMDBID != 603 || m.Director != "Lana Wachowski" {
		t.Fatalf("enrich in place: %+v", m)
	}
	if list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200)); len(list.Movies) != 1 {
		t.Fatalf("enrich spawned a title: %+v", list.Movies)
	}
	// The row now holds tmdb 603, so re-adding it is the plain 409, not a confirm.
	confirm := decode[confirmResp](t, c.mustDo("POST", "/movies", map[string]any{"tmdb_id": 603}, http.StatusConflict))
	if confirm.NeedsConfirm {
		t.Fatalf("post-enrich re-add should be a plain 409, got needs_confirm: %+v", confirm)
	}
}

// TestMovieResyncBackfillsActors covers the reported bug: a dialogue captured
// before the movie had a cast (empty actor) gets its actor filled retroactively
// when the movie's metadata is corrected via a supplier re-sync.
func TestMovieResyncBackfillsActors(t *testing.T) {
	srv := newTestServer(t)
	fake := newMatrixTMDB(t)
	defer fake.Close()
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix"}, http.StatusCreated))
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": m.ID, "quote": "I know kung fu.", "character": "Neo"}, http.StatusCreated))
	if d.Actor != "" {
		t.Fatalf("actor should be empty before the movie has a cast: %+v", d)
	}
	// Correct the movie from TMDB (cast Neo -> Keanu Reeves): backfill should fire.
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{"source": "tmdb", "source_id": "603"}, 200)
	list := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(m.ID), nil, 200))
	if len(list.Dialogues) != 1 || list.Dialogues[0].Actor != "Keanu Reeves" {
		t.Fatalf("actor not backfilled after resync: %+v", list.Dialogues)
	}
}
