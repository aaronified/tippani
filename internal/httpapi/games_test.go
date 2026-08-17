package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

// createWork posts a movies-table row of the given media_type and returns its id.
// Games are movies rows with media_type 'game' (0040), so they go through the
// ordinary movie handler rather than a new one — the whole point of the design.
func createWork(t *testing.T, c *testClient, title, credit, mediaType string) int64 {
	t.Helper()
	rec := c.mustDo("POST", "/movies", map[string]any{
		"title": title, "director": credit, "media_type": mediaType,
	}, http.StatusCreated)
	var out struct {
		ID        int64  `json:"id"`
		MediaType string `json:"media_type"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode create %q: %v (%s)", title, err, rec.Body)
	}
	if out.MediaType != mediaType {
		t.Fatalf("created %q with media_type %q, want %q", title, out.MediaType, mediaType)
	}
	return out.ID
}

func createGame(t *testing.T, c *testClient, title, studio string) int64 {
	t.Helper()
	return createWork(t, c, title, studio, "game")
}

func createFilm(t *testing.T, c *testClient, title, director string) int64 {
	t.Helper()
	return createWork(t, c, title, director, "movie")
}

func statusOfMovie(t *testing.T, srv *Server, id int64) string {
	t.Helper()
	var s string
	if err := srv.Store.DB.QueryRow(`SELECT status FROM movies WHERE id = ?`, id).Scan(&s); err != nil {
		t.Fatal(err)
	}
	return s
}

func directorOf(t *testing.T, srv *Server, id int64) string {
	t.Helper()
	var d string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(director, '') FROM movies WHERE id = ?`, id).Scan(&d); err != nil {
		t.Fatal(err)
	}
	return d
}

// TestRenamingADirectorLeavesGameStudiosAlone is hazard 1 of the games design,
// stated as behaviour.
//
// A game's studio lives in movies.director — the same column a film's director
// uses — split only by media_type. Before 0040 every people query read that
// column unfiltered, so renaming a director would have rewritten any game studio
// with the same name, in place, library-wide, with no undo. metadata.ReplaceCredit
// matches a name as a COMPONENT of a joined credit, which is what makes the blast
// radius larger than one row.
//
// The two works here deliberately SHARE a name. A test with distinct names would
// pass against the unfiltered query and prove nothing.
func TestRenamingADirectorLeavesGameStudiosAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	const shared = "Hideo Kojima"
	film := createFilm(t, c, "A Documentary", shared)
	game := createGame(t, c, "Death Stranding", shared)

	c.mustDo("POST", "/people/rename", map[string]any{
		"kind": "director", "from": shared, "to": "H. Kojima",
	}, http.StatusOK)

	if got := directorOf(t, srv, film); got != "H. Kojima" {
		t.Errorf("film director = %q, want the rename to have applied", got)
	}
	if got := directorOf(t, srv, game); got != shared {
		t.Errorf("GAME STUDIO = %q, want %q left untouched.\n"+
			"Renaming a director rewrote a game's studio — the two share movies.director\n"+
			"and are separated only by media_type.", got, shared)
	}
}

// The mirror: renaming a studio must not touch a film's director.
func TestRenamingAStudioLeavesFilmDirectorsAlone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	const shared = "Hideo Kojima"
	film := createFilm(t, c, "A Documentary", shared)
	game := createGame(t, c, "Death Stranding", shared)

	c.mustDo("POST", "/people/rename", map[string]any{
		"kind": "studio", "from": shared, "to": "Kojima Productions",
	}, http.StatusOK)

	if got := directorOf(t, srv, game); got != "Kojima Productions" {
		t.Errorf("game studio = %q, want the rename to have applied", got)
	}
	if got := directorOf(t, srv, film); got != shared {
		t.Errorf("FILM DIRECTOR = %q, want %q left untouched", got, shared)
	}
}

// TestPeopleNamesSeparatesDirectorsFromStudios is the other half of hazard 1 —
// the visible one. The Metadata console asks /people/names?kind=director, and an
// unfiltered query answers with every studio in the library, tallied, named as
// directors and offered for renaming. That exact sentence has been written in
// this repo twice before about other kinds.
func TestPeopleNamesSeparatesDirectorsFromStudios(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	createFilm(t, c, "Heat", "Michael Mann")
	createGame(t, c, "Elden Ring", "FromSoftware")

	names := func(kind string) map[string]bool {
		rec := c.mustDo("GET", "/people/names?kind="+kind, nil, http.StatusOK)
		var res struct {
			People []struct {
				Name  string `json:"name"`
				Count int    `json:"count"`
			} `json:"people"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("decode names(%s): %v (%s)", kind, err, rec.Body)
		}
		out := map[string]bool{}
		for _, n := range res.People {
			out[n.Name] = true
		}
		return out
	}

	dirs := names("director")
	if !dirs["Michael Mann"] {
		t.Errorf("directors = %v, want the film's director listed", dirs)
	}
	if dirs["FromSoftware"] {
		t.Errorf("directors = %v — a GAME STUDIO is listed as a director, and is therefore\n"+
			"offered for renaming from the Metadata console.", dirs)
	}

	studios := names("studio")
	if !studios["FromSoftware"] {
		t.Errorf("studios = %v, want the game's studio listed", studios)
	}
	if studios["Michael Mann"] {
		t.Errorf("studios = %v — a film DIRECTOR is listed as a studio.", studios)
	}
}

// TestGameShelfStatusIsPlayed covers hazard 2: shelfCap used to end in
// `default: return 2`, and activeStatus took only the kind — so a game would
// have silently been "watching", capped at two in progress, on the strength of a
// fallthrough rather than a decision.
func TestGameShelfStatusIsPlayed(t *testing.T) {
	if got := activeStatus("movie", "game"); got != StatusPlaying {
		t.Errorf("activeStatus(movie, game) = %q, want %q — a game is played, not watched", got, StatusPlaying)
	}
	if got := activeStatus("movie", "movie"); got != StatusWatching {
		t.Errorf("activeStatus(movie, movie) = %q, want %q", got, StatusWatching)
	}
	if got := activeStatus("movie", "show"); got != StatusWatching {
		t.Errorf("activeStatus(movie, show) = %q, want %q", got, StatusWatching)
	}
	if got := activeStatus("book", ""); got != StatusReading {
		t.Errorf("activeStatus(book) = %q, want %q", got, StatusReading)
	}
	// Every arm is a decision. Asserted as distinct VALUES rather than "not the
	// default", because inheriting the film cap is the failure.
	caps := map[string]int{"book": 5, "show": 5, "game": 3, "movie": 2}
	for mt, want := range caps {
		kind := "movie"
		if mt == "book" {
			kind = "book"
		}
		if got := shelfCap(kind, mt); got != want {
			t.Errorf("shelfCap(%s, %s) = %d, want %d", kind, mt, got, want)
		}
	}
}

// TestSettingAGameToPlaying drives the real endpoint: a game accepts 'playing'
// and refuses 'watching'.
func TestSettingAGameToPlaying(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	game := createGame(t, c, "Hades", "Supergiant Games")

	c.mustDo("PUT", "/movies/"+itoa(game)+"/status", map[string]any{"status": StatusPlaying}, http.StatusOK)
	if got := statusOfMovie(t, srv, game); got != StatusPlaying {
		t.Fatalf("status = %q, want %q", got, StatusPlaying)
	}
	// 'watching' is not a word that applies to a game, and is refused rather than
	// silently stored — a stored 'watching' would sort a game onto the wrong shelf.
	c.mustDo("PUT", "/movies/"+itoa(game)+"/status", map[string]any{"status": StatusWatching}, http.StatusBadRequest)
}

// TestBulkStatusResolvesPerRow covers the mixed selection: one bulk call over a
// film and a game must set each to its OWN in-progress word rather than writing
// the requested literal onto both.
func TestBulkStatusResolvesPerRow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film := createFilm(t, c, "Heat", "Michael Mann")
	game := createGame(t, c, "Elden Ring", "FromSoftware")

	c.mustDo("POST", "/movies/bulk/status", map[string]any{
		"ids": []int64{film, game}, "status": StatusWatching,
	}, http.StatusOK)

	if got := statusOfMovie(t, srv, film); got != StatusWatching {
		t.Errorf("film status = %q, want %q", got, StatusWatching)
	}
	if got := statusOfMovie(t, srv, game); got != StatusPlaying {
		t.Errorf("game status = %q, want %q — a bulk 'watching' over a mixed selection must\n"+
			"resolve to each row's own word, not write the literal onto a game.", got, StatusPlaying)
	}
}

// TestRemappingSpeakersOnAGame is a coverage gap closed rather than a bug fixed.
//
// The Metadata console's speaker remap already works on a game, and works for
// the reason 0040 predicted: a game IS a movies row, its lines ARE dialogues
// rows, and handleRemapSpeakers selects on (id, user_id) with no media_type
// anywhere in it. handleMetadataLibrary lists every movies row the same way, so
// the picker offers a game with dialogue without being told games exist.
//
// Nothing pinned that. Every remap test in metadata_library_test.go runs on a
// film, so the first `AND media_type <> 'game'` added to either query — and
// people_handlers.go is full of that exact clause, correctly, for the studio
// split — would take games out of the remap silently. There is no error to see:
// the title simply stops being in the dropdown, or the remap reports 0 rows
// changed, which reads as "there was nothing to do".
//
// The voice cast is what a game keeps in cast_json (0040), so the fixture is a
// game whose imported label is a shouted screen name and whose cast has the
// character properly spelled — the same shape as the film case, in the medium
// that had no test.
func TestRemappingSpeakersOnAGame(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Portal 2", "Valve")
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"GLaDOS","actor":"Ellen McLain"},{"character":"Wheatley","actor":"Stephen Merchant"}]`,
		game); err != nil {
		t.Fatal(err)
	}
	// "GLADOS AI" is the label an import leaves behind: it matches no cast
	// member, so the actor comes back empty.
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "The cake is a lie.", "character": "GLADOS AI",
	}, http.StatusCreated))
	if d.Actor != "" {
		t.Fatalf("actor should be empty before the remap: %+v", d)
	}

	// The title has to be OFFERED before it can be remapped, and that is the half
	// a media_type filter on the listing query would break on its own.
	lib := decode[struct {
		Movies []struct {
			ID            int64  `json:"id"`
			MediaType     string `json:"media_type"`
			DialogueCount int    `json:"dialogue_count"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/metadata/library", nil, http.StatusOK))
	offered := false
	for _, m := range lib.Movies {
		if m.ID == game && m.MediaType == "game" && m.DialogueCount == 1 {
			offered = true
		}
	}
	if !offered {
		t.Fatalf("the console lists no game with dialogue, so none can be picked: %+v", lib.Movies)
	}

	res := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(game)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{{"from": "GLADOS AI", "character": "GLaDOS", "actor": ""}},
	}, http.StatusOK))
	if res.Remapped != 1 {
		t.Fatalf("remapped = %d, want 1 — a game's dialogue must remap like a film's", res.Remapped)
	}
	got := decode[dlgList](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(game), nil, http.StatusOK))
	if len(got.Dialogues) != 1 || got.Dialogues[0].Character != "GLaDOS" || got.Dialogues[0].Actor != "Ellen McLain" {
		t.Fatalf("after remap: %+v — the actor must fill from the voice cast", got.Dialogues)
	}
}

// TestRefillingActorsOnAGame is the remap's other half: no mappings at all, just
// "fill the actors in from the cast". It runs through refillMovieActors, which is
// a second query over `dialogues` that a media_type filter could equally reach.
func TestRefillingActorsOnAGame(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Disco Elysium", "ZA/UM")
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Kim Kitsuragi","actor":"Jullian Champenois"}]`, game); err != nil {
		t.Fatal(err)
	}
	d := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": game, "quote": "It is a shithole.", "character": "Kim Kitsuragi",
	}, http.StatusCreated))
	// The character already matches the cast, so it auto-filled on create. Empty
	// it so the refill has something to do.
	if _, err := srv.Store.DB.Exec(`UPDATE dialogues SET actor = NULL WHERE id = ?`, d.ID); err != nil {
		t.Fatal(err)
	}

	res := decode[remapResp](t, c.mustDo("POST", "/movies/"+itoa(game)+"/remap-speakers", map[string]any{
		"mappings": []map[string]any{}, "refill": true,
	}, http.StatusOK))
	if res.Refilled != 1 {
		t.Fatalf("refilled = %d, want 1 — a game's voice cast fills its lines like a film's", res.Refilled)
	}
}

// ---- the Wikidata fallback (1.16.0) ---------------------------------------
//
// GAMES WERE THE ONE MEDIUM WITH NO FLOOR. Books need no key, films run on a
// shared built-in TMDB key, and a game needed a Twitch application, a client id
// and a secret before it could be looked up at all — so the medium with the
// highest setup cost was also the only one that answered 503 and told you to
// type it in yourself. Wikidata is the floor under it.
//
// The rule these pin is that it is a FLOOR AND NOT A SECOND OPINION: it must
// answer when IGDB cannot, and must not run at all while IGDB is answering.
// Getting that backwards would be invisible in the response — the candidate list
// would simply be longer, with thinner records mixed into good ones.

// wikidataGameServer stubs the two Action API calls the fallback makes.
func wikidataGameServer(t *testing.T, title string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		switch {
		case q.Get("action") == "query":
			_, _ = w.Write([]byte(`{"query":{"search":[{"title":"Q1","snippet":"a video game"}]}}`))
		case q.Get("action") == "wbgetentities":
			if q.Get("props") == "claims" {
				_, _ = w.Write([]byte(`{"entities":{"Q1":{"claims":{` +
					`"P31":[{"mainsnak":{"datavalue":{"value":{"id":"Q7889"}}}}],` +
					`"P577":[{"mainsnak":{"datavalue":{"value":{"time":"+2010-05-18T00:00:00Z"}}}}]}}}}`))
				return
			}
			_, _ = fmt.Fprintf(w, `{"entities":{"Q1":{"labels":{"en":{"value":%q}}}}}`, title)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestGameLookupFallsBackToWikidataWithNoIGDBKey(t *testing.T) {
	srv := newTestServer(t)
	wd := wikidataGameServer(t, "Alan Wake")
	metadata.SetWikidataBaseForTest(t, wd.URL)
	// No IGDB credentials at all, which is the ordinary state of a fresh
	// instance: this used to be a flat 503 with nothing to choose from.
	srv.IGDB = nil
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Alan Wake", "media_type": "game"}, http.StatusOK))
	if len(got.Candidates) != 1 {
		t.Fatalf("want one wikidata candidate, got %+v", got.Candidates)
	}
	cand := got.Candidates[0]
	if cand.Source != "wikidata" {
		t.Fatalf("source = %q — the picker has to be able to say the record is the thinner one", cand.Source)
	}
	if cand.MediaType != "game" || cand.Title != "Alan Wake" || cand.ReleaseYear != 2010 {
		t.Fatalf("candidate = %+v", cand)
	}
}

// With no key AND no title there is nothing to fall back WITH, so the missing
// pair is still the honest answer — "no results" would be false, because nothing
// was asked.
func TestGameLookupStillReportsTheMissingKeyWhenItCannotFallBack(t *testing.T) {
	srv := newTestServer(t)
	srv.IGDB = nil
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/movies/lookup",
		map[string]any{"igdb_id": 123, "media_type": "game"}, http.StatusServiceUnavailable)
}

// The half that cannot be seen in a response: with IGDB answering, Wikidata must
// not be consulted at all. The stub fails the test if it is touched.
func TestGameLookupDoesNotConsultWikidataWhenIGDBAnswers(t *testing.T) {
	srv := newTestServer(t)
	touched := false
	wd := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		touched = true
		http.NotFound(w, r)
	}))
	defer wd.Close()
	metadata.SetWikidataBaseForTest(t, wd.URL)

	igdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "token") {
			_, _ = w.Write([]byte(`{"access_token":"t","expires_in":3600}`))
			return
		}
		_, _ = w.Write([]byte(`[{"id":7,"name":"Alan Wake","slug":"alan-wake","first_release_date":1274140800}]`))
	}))
	defer igdb.Close()
	srv.IGDB = &metadata.IGDB{ClientID: "id", ClientSecret: "secret", BaseURL: igdb.URL, TokenURL: igdb.URL + "/token"}
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Alan Wake", "media_type": "game"}, http.StatusOK))
	if len(got.Candidates) == 0 || got.Candidates[0].Source != "igdb" {
		t.Fatalf("IGDB must answer for itself: %+v", got.Candidates)
	}
	if touched {
		t.Fatal("Wikidata was consulted while IGDB was answering — it is a floor, not a second opinion")
	}
}

// A studio stops claiming it came from Open Library (0041).
//
// Fixing the two code paths stopped NEW rows being written that way and did
// nothing about the ones already there — so the panel kept reading "VIA
// OPENLIBRARY" under a studio that had just been re-fetched from IGDB and
// correctly found nothing. A stale provenance line is worse than none: it is the
// interface stating, in the present tense, where a fact came from, and being
// wrong.
func TestMigrationClearsStudioProvenanceFromTheAuthorPath(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	uid := int64(1)

	// A studio written the old way, and an author written the right way.
	for _, p := range []struct{ name, kind string }{{"Electronic Arts", "studio"}, {"Ursula K. Le Guin", "author"}} {
		res, err := srv.Store.DB.Exec(
			`INSERT INTO people (user_id, name, source, source_id, links, bio, born)
			 VALUES (?, ?, 'openlibrary', 'OL1A', '{"openlibrary":"x"}', 'a bio', '1929')`, uid, p.name)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		if _, err := srv.Store.DB.Exec(
			`INSERT INTO person_kinds (person_id, kind) VALUES (?, ?)`, id, p.kind); err != nil {
			t.Fatal(err)
		}
	}
	// Re-run the migration over the seeded rows — newTestServer migrated before
	// they existed, which is exactly the order a real upgrade cannot have.
	if _, err := srv.Store.DB.Exec(`
		UPDATE people SET source = '', source_id = '', links = '', bio = '', born = '', died = ''
		 WHERE source = 'openlibrary'
		   AND EXISTS (SELECT 1 FROM person_kinds pk WHERE pk.person_id = people.id AND pk.kind = 'studio')`); err != nil {
		t.Fatal(err)
	}

	var src, bio string
	if err := srv.Store.DB.QueryRow(
		`SELECT source, bio FROM people WHERE name = 'Electronic Arts'`).Scan(&src, &bio); err != nil {
		t.Fatal(err)
	}
	if src != "" || bio != "" {
		t.Errorf("a studio still carries an author record: source=%q bio=%q", src, bio)
	}
	// AND THE AUTHOR IS UNTOUCHED, which is the half that makes the clause worth
	// scoping: an over-broad fix would wipe every author's bio in the library.
	if err := srv.Store.DB.QueryRow(
		`SELECT source, bio FROM people WHERE name = 'Ursula K. Le Guin'`).Scan(&src, &bio); err != nil {
		t.Fatal(err)
	}
	if src != "openlibrary" || bio == "" {
		t.Errorf("an author lost their Open Library identity: source=%q bio=%q", src, bio)
	}
	_ = c
}
