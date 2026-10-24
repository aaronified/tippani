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
	// 42 is a year, not a typo — the old floor of 1000 rejected the first
	// millennium wholesale. Out of range now means outside -4000..3000, and the
	// round trip lives in ancient_years_test.go rather than here, where an extra
	// row would shift the counts asserted below.
	c.mustDo("POST", "/movies", map[string]any{"title": "X", "release_year": 3001}, http.StatusBadRequest)
	c.mustDo("POST", "/movies", map[string]any{"title": "X", "release_year": -4001}, http.StatusBadRequest)

	// Seed the cast mapping directly (manual movies have none) to exercise the
	// PLAN §3b actor auto-fill. Rows rather than the cast_json blob it used to
	// write: the blob is still stored for one release and is no longer what the
	// auto-fill reads (0048).
	seedProviderCast(t, srv, 1, "movie", m.ID,
		[2]string{"Rick Blaine", "Humphrey Bogart"},
		[2]string{"Ilsa Lund", "Ingrid Bergman"})

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

func TestMovieCreateFromTMDB(t *testing.T) {
	srv := newTestServer(t)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search/movie":
			w.Write([]byte(`{"results":[{"id":603,"title":"The Matrix","release_date":"1999-03-31","overview":"A hacker."}]}`))
		case "/movie/603":
			// credits AND external_ids on the one call: the IMDb id (0038) is
			// fetched from the appendix rather than from a second request.
			if r.URL.Query().Get("append_to_response") != "credits,external_ids" {
				t.Errorf("missing append_to_response=credits,external_ids: %s", r.URL)
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

// Who is quoted in a film, as against who is in it.
//
// The Catalogue filters by actor, and the whole question is which of two
// available answers the column gives. `movies.cast_json` is right there and
// holds the full TMDB cast; `dialogues.actor` holds the credit on each line you
// saved. They are different sets, and they diverge for exactly the films a
// metadata fetch has touched and a reader has not quoted — which, in a library
// that imports covers before it imports highlights, is most of them.
//
// The list row derives it from the LINES, for one decisive reason: `actor:` in
// search reads `d.actor` (searchFacets.where → creditAnyOf), so a board built
// on the cast would filter to one set of films and seed a search that answers
// with another. A filter whose meaning changes on the way to the search box is
// the failure the seeding rule exists to prevent, and it changes it in the
// direction of MORE results, which reads as the search being broken.
//
// So these assert VALUES, and the negative one is the point: a film with a cast
// and no saved lines reports no actors.

type movieActorRow struct {
	ID     int64    `json:"id"`
	Title  string   `json:"title"`
	Actors []string `json:"actors"`
}

func listMovieActors(t *testing.T, c *testClient) map[string][]string {
	t.Helper()
	rows := decode[struct {
		Movies []movieActorRow `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, 200)).Movies
	out := map[string][]string{}
	for _, m := range rows {
		out[m.Title] = m.Actors
	}
	return out
}

func TestAMovieReportsWhoIsQuotedInIt(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	casablanca := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": casablanca, "quote": "here's looking at you, kid",
		"character": "Rick", "actor": "Humphrey Bogart",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": casablanca, "quote": "we'll always have Paris",
		"character": "Rick", "actor": "Humphrey Bogart",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": casablanca, "quote": "play it, Sam",
		"character": "Ilsa", "actor": "Ingrid Bergman",
	}, http.StatusCreated)

	got := listMovieActors(t, c)
	// DISTINCT: Bogart has two lines and appears once. A dropdown that listed
	// him twice would be a dropdown built from a list nobody deduplicated.
	want := []string{"Humphrey Bogart", "Ingrid Bergman"}
	if len(got["Casablanca"]) != len(want) {
		t.Fatalf("actors = %v, want %v", got["Casablanca"], want)
	}
	for i, w := range want {
		if got["Casablanca"][i] != w {
			t.Errorf("actor %d = %q, want %q (sorted by name, so the dropdown is stable)", i, got["Casablanca"][i], w)
		}
	}
}

func TestAnUncreditedLineNamesNobodyAndTheFieldIsNeverNull(t *testing.T) {
	// A line saved without an actor is ordinary — most are, until the cast
	// arrives and refillMovieActors backfills them — and must not put an empty
	// name in the dropdown. `actors` is [] and never null, because the client
	// maps over it and a board that throws on the films with nothing quoted is
	// the shape of bug an empty-vs-absent difference always makes.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	id := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Solaris"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": id, "quote": "we don't want other worlds; we want mirrors",
	}, http.StatusCreated)

	raw := c.mustDo("GET", "/movies", nil, 200).Body.String()
	if !strings.Contains(raw, `"actors":[]`) {
		t.Errorf("the list row does not carry an empty actors array: %s", raw)
	}
	if got := listMovieActors(t, c)["Solaris"]; len(got) != 0 {
		t.Errorf("actors = %v on a film whose only line credits nobody, want none", got)
	}
}

func TestActorsAreScopedToTheAccount(t *testing.T) {
	// WHAT THIS DOES AND DOES NOT PROVE, stated because the first draft claimed
	// the wrong one. Dropping `m.user_id = ?` from movieActors leaves this test
	// green, and that is correct rather than a hole in it: the map is keyed by
	// movie id and the rows it is read against are already user-scoped, so
	// another account's entries are built and never looked up. The WHERE is
	// there to bound the query, not to hold a boundary.
	//
	// The boundary this pins is the observable one — Bob's board names Bob's
	// actors and nobody else's — which is worth a regression test on its own
	// account, and is the thing that would actually change if the row list or
	// the join ever stopped agreeing about whose films these are.
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	aliceFilm := idOf(t, alice.mustDo("POST", "/movies", map[string]any{"title": "Alice's film"}, http.StatusCreated).Body.Bytes())
	alice.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": aliceFilm, "quote": "a line", "actor": "Alice's Actor",
	}, http.StatusCreated)

	bobFilm := idOf(t, bob.mustDo("POST", "/movies", map[string]any{"title": "Bob's film"}, http.StatusCreated).Body.Bytes())
	bob.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": bobFilm, "quote": "another line", "actor": "Bob's Actor",
	}, http.StatusCreated)

	for title, actors := range listMovieActors(t, bob) {
		for _, a := range actors {
			if a == "Alice's Actor" {
				t.Errorf("Bob's %q lists %q", title, a)
			}
		}
	}
	if got := listMovieActors(t, bob)["Bob's film"]; len(got) != 1 || got[0] != "Bob's Actor" {
		t.Errorf("Bob's own film lists %v, want [Bob's Actor]", got)
	}
}

// The IMDb id on a film and on a show (0038).
//
// It is the odd one of the three supplier ids: nothing FETCHES with it, because
// IMDb has no public API. So the rules that matter are about carrying it safely
// rather than about resolving anything — it must survive an ordinary save, it
// must survive a re-sync that did not find one, and it must accept what a reader
// actually has in their hand, which is a URL.

func newMovie(t *testing.T, c *testClient, body map[string]any) movieDetail {
	t.Helper()
	return decode[movieDetail](t, c.mustDo("POST", "/movies", body, http.StatusCreated))
}

func movieByID(t *testing.T, c *testClient, id int64) movieDetail {
	t.Helper()
	return decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(id), nil, http.StatusOK))
}

// A pasted URL is the common case, not the exotic one: an IMDb id is reached by
// copying an address bar. Refusing it would be a message asking somebody to do
// by hand what one line of code does.
func TestAnIMDbIdIsTakenFromWhateverTheReaderPastes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	for _, tc := range []struct{ in, want string }{
		{"tt0111161", "tt0111161"},
		{"https://www.imdb.com/title/tt0111161/", "tt0111161"},
		{"https://m.imdb.com/title/tt0111161/?ref_=nv_sr_1", "tt0111161"},
		{"  tt0111161  ", "tt0111161"},
		// A bare number is what somebody reads off the page; the leading zeros
		// are part of the id, so they are put back rather than lost.
		{"111161", "tt0111161"},
		{"", ""},
	} {
		m := newMovie(t, c, map[string]any{"title": "Shawshank " + tc.in, "imdb_id": tc.in})
		if got := movieByID(t, c, m.ID).IMDbID; got != tc.want {
			t.Errorf("imdb_id %q came back as %q, want %q", tc.in, got, tc.want)
		}
	}
}

// THE TRAP, on the fifth column in a row. PUT is full-state here, so a client
// that saves the title and forgets this field clears it, and nothing says so.
func TestAnOrdinarySaveDoesNotClearTheIMDbId(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	m := newMovie(t, c, map[string]any{"title": "Solaris", "imdb_id": "tt0069293"})

	// A full-state save, exactly as the client sends it.
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "Solaris", "media_type": "movie", "imdb_id": "tt0069293", "favorite": true,
	}, http.StatusOK)

	got := movieByID(t, c, m.ID)
	if got.IMDbID != "tt0069293" {
		t.Fatalf("imdb_id = %q after a save of another field", got.IMDbID)
	}
	if !got.Favorite {
		t.Fatal("the save did not take")
	}
}

// Emptying the field is a real edit, and has to be distinguishable from an
// old client omitting it. It is full-state, so an empty string clears it.
func TestTheIMDbIdCanBeCleared(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	m := newMovie(t, c, map[string]any{"title": "Stalker", "imdb_id": "tt0079944"})
	c.mustDo("PUT", "/movies/"+itoa(m.ID), map[string]any{
		"title": "Stalker", "media_type": "movie", "imdb_id": "",
	}, http.StatusOK)
	if got := movieByID(t, c, m.ID).IMDbID; got != "" {
		t.Fatalf("imdb_id = %q, want empty", got)
	}
}
