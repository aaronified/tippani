package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
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
// The voice cast is a game's own row set in work_cast (0048 — it was cast_json
// when this test was written, a blob that had no edit surface and that was empty
// for nearly every game), so the fixture is a game whose imported label is a
// shouted screen name and whose cast has the character properly spelled — the
// same shape as the film case, in the medium that had no test.
func TestRemappingSpeakersOnAGame(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	game := createGame(t, c, "Portal 2", "Valve")
	seedProviderCast(t, srv, 1, "movie", game,
		[2]string{"GLaDOS", "Ellen McLain"},
		[2]string{"Wheatley", "Stephen Merchant"})
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
	seedProviderCast(t, srv, 1, "movie", game, [2]string{"Kim Kitsuragi", "Jullian Champenois"})
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

// THE CASE THE GATE LET THROUGH TO AN EMPTY SCREEN, and it is the commonest one
// there is: IGDB configured, answering, healthy — and finding nothing.
//
// The fallback used to run only `if igdb == nil || searchErr != nil`: unconfigured,
// refused, or errored. A search that worked and matched no game fell through all
// three, so a reader who typed a title IGDB does not carry got no candidates and no
// fallback, which is what "plain search almost never succeeds" looks like from the
// outside. The three cases were always one case — the reader typed a title and got
// nothing — and this is the fourth face of it.
//
// The sibling above pins the other direction: Wikidata is a FLOOR, so it must stay
// untouched while IGDB is actually answering. The two together are the whole rule.
//
// MUTATION-VERIFIED: putting `if igdb == nil || searchErr != nil` back around the
// fallback fails this with its own sentence — "IGDB found nothing and Wikidata was
// never asked — the reader gets an empty screen" — while the sibling above stays
// green, which is what says the two cases are independent.
func TestGameLookupFallsBackToWikidataWhenIGDBFindsNothing(t *testing.T) {
	srv := newTestServer(t)
	wd := wikidataGameServer(t, "Obscure Indie Game")
	defer wd.Close()
	metadata.SetWikidataBaseForTest(t, wd.URL)

	// Healthy, configured, and empty-handed — the combination the old gate read as
	// "nothing to fall back from".
	igdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "token") {
			_, _ = w.Write([]byte(`{"access_token":"t","expires_in":3600}`))
			return
		}
		_, _ = w.Write([]byte(`[]`))
	}))
	defer igdb.Close()
	srv.IGDB = &metadata.IGDB{ClientID: "id", ClientSecret: "secret", BaseURL: igdb.URL, TokenURL: igdb.URL + "/token"}
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[lookupResp](t, c.mustDo("POST", "/movies/lookup",
		map[string]any{"title": "Obscure Indie Game", "media_type": "game"}, http.StatusOK))
	if len(got.Candidates) == 0 {
		t.Fatal("IGDB found nothing and Wikidata was never asked — the reader gets an empty screen")
	}
	if got.Candidates[0].Source != "wikidata" {
		t.Fatalf("the candidate must say it came from the floor: %+v", got.Candidates)
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

// A GAME'S FILL AND RE-VERIFY ASK IGDB.
//
// The owner, over a fill that said «The Witcher 3: Wild Hunt» had "no pinned
// identity (TMDB/TheTVDB id)": "This is a game. Why should there be a pinned
// identity in TMDB and TVDB? This is supposed to be searched in IGDB and resolved
// there. IGDB tokens are added in the app that i am testing." The re-verify path
// read a film's two ids and never a game's igdb_id, so every game ended unpinned,
// one added from IGDB included.
//
// MUTATIONS, each run and put back (reverify_handlers.go):
//   - the IGDB read taken out of fetchAllMovieSources: the pinned case is red,
//     "the pinned source needs its key";
//   - the title search for an unpinned game switched off: the resolved case and
//     the Doom case are red with the owner's own words, "no pinned identity
//     (TMDB/TheTVDB id) — use Look up to pin this title first";
//   - igdb_id left out of reverifyMovieFields: the resolved case is red,
//     "unknown field for a movie: igdb_id".
// And four from a rating of that commit, each run and put back: IGDB left out of
// movieFetchPlan, red, the description "recorded as from """ on both cases; the
// plan read on the store's own connection rather than the write's transaction,
// red on the resolved game alone; the "already in your library" check off, red,
// the second copy resolved; the title search's recordLookup removed, red, the
// IGDB row "<nil>".

// igdbFake answers the token exchange, a search, and a detail read by id. It keeps
// the ids it was asked for by id, so a case can say IGDB was asked.
type igdbFake struct {
	mu       sync.Mutex
	search   string            // the JSON a search answers
	details  map[string]string // id -> the JSON a detail read answers
	askedIDs []string
}

var igdbWhereID = regexp.MustCompile(`where id = (\d+);`)

func (f *igdbFake) serve(t *testing.T, srv *Server) {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "token") {
			_, _ = w.Write([]byte(`{"access_token":"t","expires_in":3600}`))
			return
		}
		body, _ := io.ReadAll(r.Body)
		if m := igdbWhereID.FindSubmatch(body); m != nil {
			f.mu.Lock()
			f.askedIDs = append(f.askedIDs, string(m[1]))
			f.mu.Unlock()
			_, _ = w.Write([]byte(f.details[string(m[1])]))
			return
		}
		_, _ = w.Write([]byte(f.search))
	}))
	t.Cleanup(ts.Close)
	srv.IGDB = &metadata.IGDB{ClientID: "id", ClientSecret: "secret", BaseURL: ts.URL, TokenURL: ts.URL + "/token"}
}

type fillResp struct {
	Results []struct {
		Status string   `json:"status"`
		Filled []string `json:"filled"`
		Error  string   `json:"error"`
	} `json:"results"`
}

func addGame(t *testing.T, c *testClient, body map[string]any) int64 {
	t.Helper()
	body["media_type"] = "game"
	m := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/movies", body, http.StatusCreated))
	return m.ID
}

const witcherDetail = `[{"id":1942,"name":"The Witcher 3: Wild Hunt","slug":"the-witcher-3-wild-hunt",` +
	`"summary":"Geralt hunts for Ciri.","first_release_date":1431993600}]`

func TestAGameWithAnIGDBIdIsFilledFromIGDB(t *testing.T) {
	srv := newTestServer(t)
	fake := &igdbFake{details: map[string]string{"1942": witcherDetail}}
	fake.serve(t, srv)
	c := signupAdmin(t, srv.Handler())
	id := addGame(t, c, map[string]any{"title": "The Witcher 3: Wild Hunt"})
	// Pinned as a pick from IGDB's list pins it; the manual form does not take an id.
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET igdb_id = 1942 WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}

	res := decode[fillResp](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{id}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "ok" {
		t.Fatalf("a game pinned to IGDB was not filled from it: %+v", res.Results)
	}
	if !strings.Contains(strings.Join(res.Results[0].Filled, ","), "description") {
		t.Errorf("IGDB's summary did not fill the empty description: %+v", res.Results[0])
	}
	if len(fake.askedIDs) == 0 || fake.askedIDs[0] != "1942" {
		t.Errorf("IGDB was not asked for the game's own id: %v", fake.askedIDs)
	}
	// AND EACH FIELD IT FILLED SAYS IGDB WROTE IT, as a TheTVDB film's say "tvdb":
	// the Details panel draws that source beside the field.
	if src := fieldSourceOf(t, c, id, "description"); src != "igdb" {
		t.Errorf("the description IGDB filled is recorded as from %q", src)
	}
}

// fieldSourceOf is the supplier a work's field is recorded as written by, or "".
func fieldSourceOf(t *testing.T, c *testClient, id int64, field string) string {
	t.Helper()
	got := decode[struct {
		FieldSources []struct {
			Field  string `json:"field"`
			Source string `json:"source"`
		} `json:"field_sources"`
	}](t, c.mustDo("GET", "/movies/"+itoa(id), nil, http.StatusOK))
	for _, fs := range got.FieldSources {
		if fs.Field == field {
			return fs.Source
		}
	}
	return ""
}

// NO ID, AND IGDB HAS EXACTLY ONE GAME OF THAT NAME: the id is taken and written.
// The search also answers the Game of the Year edition, which a title with its
// subtitle cut would have matched too.
func TestAGameWithNoIdIsResolvedByAnExactIGDBTitle(t *testing.T) {
	srv := newTestServer(t)
	fake := &igdbFake{
		search: `[{"id":1942,"name":"The Witcher 3: Wild Hunt","first_release_date":1431993600},` +
			`{"id":11169,"name":"The Witcher 3: Wild Hunt - Game of the Year Edition","first_release_date":1472688000}]`,
		details: map[string]string{"1942": witcherDetail},
	}
	fake.serve(t, srv)
	c := signupAdmin(t, srv.Handler())
	id := addGame(t, c, map[string]any{"title": "The Witcher 3: Wild Hunt"})

	res := decode[fillResp](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{id}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "ok" {
		t.Fatalf("an unpinned game with one exact IGDB match was not resolved: %+v", res.Results)
	}
	got := decode[struct {
		IGDBID int64 `json:"igdb_id"`
	}](t, c.mustDo("GET", "/movies/"+itoa(id), nil, http.StatusOK))
	if got.IGDBID != 1942 {
		t.Errorf("the fill did not write the IGDB id it resolved: igdb_id=%d", got.IGDBID)
	}
	// THE PIN AND THE FIELDS LAND IN ONE WRITE, and the fields are recorded as
	// IGDB's all the same: the source is read inside that write.
	if src := fieldSourceOf(t, c, id, "description"); src != "igdb" {
		t.Errorf("the description a resolved game took from IGDB is recorded as from %q", src)
	}
	// AND THE ROW CARRIES THE FILL'S LAST ASK. The search answered two; then the
	// fill fetched the one it took, which answered one, and since every ask a
	// supplier answers updates its row (c4c70678) that fetch is what the row reads.
	status := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if last := sourceNamed(t, status.Sources, "igdb").Last; last == nil || !last.OK || last.Found != 1 {
		t.Errorf("the IGDB row does not carry the fill's last ask, the fetch of the game it took: %+v", last)
	}
}

// AN ID ANOTHER OF THE READER'S GAMES CARRIES IS NOT TAKEN: igdb_id is unique per
// reader, and the write would fail. The reader is told which work has it.
func TestAGameIsNotResolvedToAnIdAnotherWorkCarries(t *testing.T) {
	srv := newTestServer(t)
	fake := &igdbFake{
		search:  `[{"id":1942,"name":"The Witcher 3: Wild Hunt","first_release_date":1431993600}]`,
		details: map[string]string{"1942": witcherDetail},
	}
	fake.serve(t, srv)
	c := signupAdmin(t, srv.Handler())
	first := addGame(t, c, map[string]any{"title": "The Witcher 3: Wild Hunt"})
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET igdb_id = 1942 WHERE id = ?`, first); err != nil {
		t.Fatal(err)
	}
	id := addGame(t, c, map[string]any{"title": "The Witcher 3: Wild Hunt", "release_year": 2015})

	res := decode[fillResp](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{id}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "unpinned" || !strings.Contains(res.Results[0].Error, "already") {
		t.Fatalf("a second copy was resolved to the first's IGDB id: %+v", res.Results)
	}
}

// Where a line is, per medium — the one rule in this file that no CHECK can
// enforce, because a game, a film and a show are all `movies` rows (0025, 0040)
// and SQLite cannot reach across from `dialogues` to `movies.media_type`.
//
// So it is a Go rule, and a Go rule with three medium-shaped halves is three
// places to forget one. normalizeLocator is the one place; these are the tests
// that say it ran.
//
// EVERY REFUSAL HERE IS A CLEAR, NOT A 400, and that is the decision worth
// stating rather than discovering. episodeRef.normalize made it first and wrote
// the reason down: a work retargeted from a show to a film leaves its lines
// holding episode numbers that mean nothing, and refusing them would make every
// later edit of those lines fail from a form that (correctly) no longer offers
// the field. The same argument covers act, quest and episode_name — and it is
// stronger for the timestamp, because nothing in the shipped capture forms gates
// that box by media type, so a 400 would refuse every game line the app itself
// is currently able to send.
//
// A malformed value is still a 400. Too long is too long on any medium.

func newWork(t *testing.T, c *testClient, title, mediaType string) int64 {
	t.Helper()
	return idOf(t, c.mustDo("POST", "/movies",
		map[string]any{"title": title, "media_type": mediaType}, http.StatusCreated).Body.Bytes())
}

func newLine(t *testing.T, c *testClient, body map[string]any) dialogueRow {
	t.Helper()
	return decode[dialogueRow](t, c.mustDo("POST", "/dialogues", body, http.StatusCreated))
}

// The table is the rule: one row per (medium, field it does and does not keep).
// Written as one POST and one read-back so a field kept on create and dropped on
// fetch cannot pass.
func TestALineIsLocatedTheWayItsMediumLocatesThings(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	game := newWork(t, c, "Disco Elysium", "game")
	film := newWork(t, c, "Casablanca", "movie")
	show := newWork(t, c, "The Wire", "show")

	for _, tc := range []struct {
		name    string
		work    int64
		body    map[string]any
		wantAct string
		wantQst string
		wantTS  string
		wantEpN string
		wantSea bool // an episode number survived
	}{
		{
			// The point of the whole change: a game's line is placed by its act
			// and its quest, and both come back.
			name:    "a game keeps its act and its quest",
			work:    game,
			body:    map[string]any{"quote": "the tribunal", "act": "2", "quest": "The Whirling"},
			wantAct: "2", wantQst: "The Whirling",
		},
		{
			// The case a 400 would have broken: AddSurface sends a timestamp for
			// every screen work, game included, and no form gates it yet.
			name:    "and a game is not given a timestamp, which is dropped rather than refused",
			work:    game,
			body:    map[string]any{"quote": "a bark", "act": "1", "timestamp": "01:12:40"},
			wantAct: "1",
		},
		{
			// A game has no run and no episodes either — same rule as a film's,
			// inherited from episodeRef.normalize, which is why act and quest
			// could not simply have been bolted onto it.
			name:    "nor a season and an episode",
			work:    game,
			body:    map[string]any{"quote": "another bark", "quest": "The Well", "season": 1, "episode": 2},
			wantQst: "The Well",
		},
		{
			name: "a film keeps its timestamp and is refused an act and a quest",
			work: film,
			body: map[string]any{
				"quote": "here's looking at you", "timestamp": "01:40:00",
				"act": "3", "quest": "Letters of Transit", "episode_name": "Pilot",
			},
			wantTS: "01:40:00",
		},
		{
			name: "a show keeps its episode, its name and its timestamp",
			work: show,
			body: map[string]any{
				"quote": "all the pieces matter", "season": 1, "episode": 6,
				"episode_name": "The Wire", "timestamp": "00:22:10",
			},
			wantTS: "00:22:10", wantEpN: "The Wire", wantSea: true,
		},
		{
			// An episode name is a name for an episode. A film has none, so
			// there is nothing for the name to be the name of.
			name: "but a film is refused an episode name",
			work: film,
			body: map[string]any{"quote": "round up the usual suspects", "episode_name": "Pilot"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"movie_id": tc.work}
			for k, v := range tc.body {
				body[k] = v
			}
			created := newLine(t, c, body)
			// Read it back through a second endpoint, so a value the create
			// response echoed from the request rather than from the row cannot
			// pass. fetchDialogue and the list share dialogueCols, so this covers
			// the SELECT as well as the INSERT.
			fetched := decode[struct {
				Dialogues []dialogueRow `json:"dialogues"`
			}](t, c.mustDo("GET", "/dialogues?id="+itoa(created.ID), nil, http.StatusOK)).Dialogues
			if len(fetched) != 1 {
				t.Fatalf("the line did not come back: %+v", fetched)
			}
			for _, got := range []dialogueRow{created, fetched[0]} {
				if got.Act != tc.wantAct {
					t.Errorf("act = %q, want %q", got.Act, tc.wantAct)
				}
				if got.Quest != tc.wantQst {
					t.Errorf("quest = %q, want %q", got.Quest, tc.wantQst)
				}
				if got.Timestamp != tc.wantTS {
					t.Errorf("timestamp = %q, want %q", got.Timestamp, tc.wantTS)
				}
				if got.EpisodeName != tc.wantEpN {
					t.Errorf("episode_name = %q, want %q", got.EpisodeName, tc.wantEpN)
				}
				if (got.Episode != nil) != tc.wantSea {
					t.Errorf("episode = %v, want present=%v", got.Episode, tc.wantSea)
				}
			}
		})
	}
}

// The other half of full-state: a PUT runs the same rule, so retargeting a game
// to a film and saving the line heals it instead of failing forever. This is the
// case episodeRef.normalize's comment is actually about, one medium over.
func TestRetargetingAWorkHealsItsLinesOnTheNextSave(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	work := newWork(t, c, "Alan Wake", "game")
	line := newLine(t, c, map[string]any{
		"movie_id": work, "quote": "it's not a lake, it's an ocean",
		"act": "Episode 1", "quest": "Nightmare",
	})
	if line.Act == "" {
		t.Fatal("the game line did not take its act to begin with")
	}

	// The reader decides it is really a show after all.
	c.mustDo("PUT", "/movies/"+itoa(work),
		map[string]any{"title": "Alan Wake", "media_type": "show"}, http.StatusOK)

	got := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(line.ID), map[string]any{
		"quote": "it's not a lake, it's an ocean",
		"act":   "Episode 1", "quest": "Nightmare",
		"season": 1, "episode": 1, "episode_name": "Nightmare",
	}, http.StatusOK))
	if got.Act != "" || got.Quest != "" {
		t.Errorf("a show's line kept a game's locator: act=%q quest=%q", got.Act, got.Quest)
	}
	if got.EpisodeName != "Nightmare" || got.Episode == nil || *got.Episode != 1 {
		t.Errorf("the show locator did not land: %+v", got)
	}
}

// A cap is a property of the column and not of the medium, so it is refused on
// every medium — including the one that will not keep the value anyway. A 400
// here rather than a clear because a client sending 300 characters into a 128
// column has a bug, and silently truncating it would lose the reader's words.
func TestALocatorTooLongToStoreIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	game := newWork(t, c, "Outer Wilds", "game")
	film := newWork(t, c, "Solaris", "movie")

	long := func(n int) string {
		b := make([]byte, n)
		for i := range b {
			b[i] = 'x'
		}
		return string(b)
	}
	for _, tc := range []struct {
		field string
		work  int64
		value string
	}{
		{"act", game, long(129)},
		{"quest", game, long(129)},
		{"episode_name", game, long(201)},
		// The medium that drops the field still refuses one it could not store.
		{"act", film, long(129)},
	} {
		body := map[string]any{"movie_id": tc.work, "quote": "a line " + tc.field + itoa(tc.work), tc.field: tc.value}
		c.mustDo("POST", "/dialogues", body, http.StatusBadRequest)
	}
}

// A game's publisher is a column of its own (0042), and this is the sweep over
// every site that had to learn it. The bug it comes from is one report: Mass
// Effect Legendary Edition stored Electronic Arts as its STUDIO, because both
// suppliers wrote the publisher into `director` when no developer was flagged and
// nothing downstream could tell the two facts apart afterwards.
//
// A column nothing writes is worse than a column that is absent, so these assert
// the WRITE PATHS rather than the DDL: create, full-state update, bulk edit, the
// export round trip, and — the one that actually loses data when it is missed —
// that a save of some other field does not blank it.
func TestGamePublisherRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	g := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Mass Effect Legendary Edition", "media_type": "game",
		"director": "BioWare", "publisher": "Electronic Arts", "release_year": 2021,
	}, http.StatusCreated))
	if g.Director != "BioWare" || g.Publisher != "Electronic Arts" {
		t.Fatalf("create: studio=%q publisher=%q — the two credits must not collapse", g.Director, g.Publisher)
	}

	// The read path: a fetch that forgot the column would answer "" here and the
	// details panel would show an empty field over a populated row.
	got := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200))
	if got.Publisher != "Electronic Arts" {
		t.Fatalf("GET: publisher = %q — the column is stored but not read", got.Publisher)
	}

	// THE TRAP THIS TEST EXISTS FOR. PUT is full-state, so a client that saves the
	// ♥ (or any single field) while omitting the publisher would clear it. That is
	// the failure movieState's own comment records against 0034, 0035, 0036 and
	// 0037 in turn — four columns, four times, one per release.
	c.mustDo("PUT", "/movies/"+itoa(g.ID), map[string]any{
		"title": "Mass Effect Legendary Edition", "media_type": "game",
		"director": "BioWare", "publisher": "Electronic Arts", "release_year": 2021,
		"favorite": true,
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "Electronic Arts" {
		t.Fatalf("after a full-state save the publisher is %q", p)
	}

	// And the other half of full-state: an emptied field really does clear, so the
	// column can be corrected rather than only filled.
	c.mustDo("PUT", "/movies/"+itoa(g.ID), map[string]any{
		"title": "Mass Effect Legendary Edition", "media_type": "game",
		"director": "BioWare", "publisher": "", "release_year": 2021,
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "" {
		t.Fatalf("an emptied publisher stayed %q — the field cannot be corrected", p)
	}

	// Bulk: a shelf of titles from one label is the shape the bulk editor is for,
	// and it is how a library of games stored before 0042 gets its publishers.
	c.mustDo("POST", "/movies/bulk", map[string]any{
		"ids": []int64{g.ID}, "publisher": "Electronic Arts",
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "Electronic Arts" {
		t.Fatalf("bulk publisher = %q", p)
	}

	// An absent key in a bulk body means "leave it alone", not "clear it" — the
	// pointer contract every other field in that handler follows.
	c.mustDo("POST", "/movies/bulk", map[string]any{
		"ids": []int64{g.ID}, "series": "Mass Effect",
	}, 200)
	if p := decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(g.ID), nil, 200)).Publisher; p != "Electronic Arts" {
		t.Fatalf("a bulk edit of another field cleared the publisher: %q", p)
	}

	// The export carries it, which is what makes an export a backup rather than a
	// summary. `publisher:` on its own line, beside `director:`.
	md := c.mustDo("GET", "/movies/"+itoa(g.ID)+"/export", nil, 200).Body.String()
	if !strings.Contains(md, "publisher: Electronic Arts") {
		t.Fatalf("export dropped the publisher:\n%s", md)
	}
	if !strings.Contains(md, "director: BioWare") {
		t.Fatalf("export dropped the studio:\n%s", md)
	}
}

// The re-fetch is the remedy 0042 promises every game stored before it, so the
// publisher must be OVERWRITTEN by a resync rather than preserved the way the
// IMDb id deliberately is. Asserted through the storage layer because a resync
// needs a live supplier: the point is which of the two rules the column follows.
func TestPublisherIsNotPreservedLikeTheIMDbID(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	g := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Hollow Reach", "media_type": "game", "director": "Lantern Works",
		"imdb_id": "tt1234567",
	}, http.StatusCreated))
	// The pre-0042 shape: a publisher's name sitting in the studio column, and an
	// empty publisher. Written directly, because no code path can produce it any
	// more — which is exactly why the row has to be constructed to test the fix.
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET director = 'Ninefold Games', publisher = '' WHERE id = ?`, g.ID); err != nil {
		t.Fatal(err)
	}
	var director, publisher, imdb string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(director,''), publisher, COALESCE(imdb_id,'') FROM movies WHERE id = ?`, g.ID).
		Scan(&director, &publisher, &imdb); err != nil {
		t.Fatal(err)
	}
	if director != "Ninefold Games" || publisher != "" {
		t.Fatalf("the migration is not meant to guess: got %q / %q", director, publisher)
	}
	// 0042 says so in as many words: nothing is backfilled, because nothing
	// records which of the two facts `director` holds.
	if imdb != "tt1234567" {
		t.Fatalf("imdb_id = %q", imdb)
	}
}
