package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
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
	if len(res.Items) == 0 {
		t.Fatal("no item came back")
	}

	// THE DEFAULT FILM SOURCE IS TheTVDB, so it is the one whose values LEAD:
	// `source` names it and `fresh` carries its answer, which is what a reader
	// ticking a field without opening the choice gets.
	if res.Items[0].Source != "tvdb" {
		t.Errorf("re-verify read a dual-pinned title from %q, want tvdb — the resolver "+
			"contradicts the default the rest of the app states", res.Items[0].Source)
	}
	if *tvdbHits == 0 {
		t.Error("TheTVDB was never asked about a title pinned to it")
	}
	// BOTH ARE ASKED NOW, AND THAT IS THE FEATURE RATHER THAN A REGRESSION.
	//
	// This assertion used to read "TMDB must not be asked at all", which was the
	// right test when a record had ONE supplier for every field: asking the
	// fallback was pure waste. Per-field mix-and-match inverts that — the second
	// supplier is asked precisely so the reader can be shown what it says and take
	// its answer for the fields where they prefer it. Asking only TheTVDB would
	// now mean there is nothing to choose between.
	//
	// What the old assertion was really protecting is unchanged and is checked
	// above: TMDB must not WIN. The order is still TheTVDB's.
	if *tmdbHits == 0 {
		t.Error("TMDB was not asked, so a dual-pinned title has no alternatives to " +
			"offer and mix-and-match has nothing to mix")
	}
	if len(res.Items[0].Sources) != 2 || res.Items[0].Sources[0] != "tvdb" {
		t.Errorf("sources = %v, want both with tvdb leading", res.Items[0].Sources)
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

// MIX AND MATCH: the description from one supplier, the year from the other, in
// one apply — and each field recorded against the supplier it actually came from.
//
// THIS IS THE FEATURE. A record used to take every field from one supplier chosen
// by a single switch, so "TheTVDB describes it better but TMDB has the right
// year" was not expressible and the disagreement was not even visible. The test
// asserts all three halves: both suppliers answer, the diff carries what each
// said, and provenance afterwards names two different sources on one work.
func TestAReaderCanTakeOneFieldFromEachSupplier(t *testing.T) {
	srv := newTestServer(t)
	tmdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":603,"title":"The Matrix","release_date":"1999-03-30",
			"overview":"TMDB's description.","credits":{"cast":[]}}`))
	}))
	defer tmdb.Close()
	tvdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/login" {
			_, _ = w.Write([]byte(`{"status":"success","data":{"token":"tok"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"data":{"id":70,"name":"The Matrix","year":"1998",
			"overview":"TheTVDB's description.","characters":[]}}`))
	}))
	defer tvdb.Close()
	srv.TMDB.Key, srv.TMDB.BaseURL = "k", tmdb.URL
	srv.TVDB = &metadata.TVDB{Key: "k", BaseURL: tvdb.URL}
	c := signupAdmin(t, srv.Handler())

	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "The Matrix", "media_type": "movie", "tmdb_id": 603, "tvdb_id": 70,
	}, http.StatusOK)

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, 200))

	// THE DISAGREEMENT IS VISIBLE. Both suppliers describe the film and they
	// describe it differently, so the description field carries both answers.
	var descAlts map[string]string
	for _, d := range res.Items[0].Diffs {
		if d.Field == "description" {
			descAlts = map[string]string{}
			for _, a := range d.Alts {
				descAlts[a.Source] = a.Value.(string)
			}
		}
	}
	if len(descAlts) != 2 {
		t.Fatalf("description offers %v, want both suppliers' answers", descAlts)
	}
	if descAlts["tvdb"] != "TheTVDB's description." || descAlts["tmdb"] != "TMDB's description." {
		t.Errorf("the alternatives are not each supplier's own words: %v", descAlts)
	}

	// TAKE ONE FROM EACH: TheTVDB's words, TMDB's year (1999 against TheTVDB's 1998).
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "movie", "id": m.ID,
			"set": map[string]any{
				"description":  "TheTVDB's description.",
				"release_year": 1999,
			},
			"sources": map[string]string{
				"description":  "tvdb",
				"release_year": "tmdb",
			},
		}},
	}, http.StatusOK)

	got := sourcesByField(t, c, m.ID)
	if got["description"] != "tvdb" {
		t.Errorf("description recorded as %q, want tvdb — %v", got["description"], got)
	}
	if got["release_year"] != "tmdb" {
		t.Errorf("release_year recorded as %q, want tmdb — %v", got["release_year"], got)
	}
	// And the values actually landed.
	after := decode[movieDetail](t, c.mustDo("GET", "/movies/"+strconv.FormatInt(m.ID, 10), nil, 200))
	if after.Description != "TheTVDB's description." || after.ReleaseYear != 1999 {
		t.Errorf("the mixed values were not written: %q / %d", after.Description, after.ReleaseYear)
	}
}

// AN UNRECOGNISED SUPPLIER ON THE WIRE FALLS BACK, IT DOES NOT POISON THE REST.
// The fields are already written by the time provenance is recorded, so a note
// that refused to be written because one entry was nonsense would lose the
// provenance of every other field in the same apply.
func TestABadPerFieldSourceFallsBackWithoutLosingTheOthers(t *testing.T) {
	srv := newTestServer(t)
	srv.TVDB = newTVDBStub(t, `{"data":{"id":70,"name":"The Matrix","year":"1999",
		"overview":"From TheTVDB.","characters":[]}}`)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"source": "tvdb", "source_id": "70", "media_type": "movie"}, http.StatusCreated))

	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "movie", "id": m.ID,
			"set":     map[string]any{"description": "From TheTVDB.", "director": "Somebody"},
			"sources": map[string]string{"description": "not-a-supplier", "director": "tvdb"},
		}},
	}, http.StatusOK)

	got := sourcesByField(t, c, m.ID)
	if got["director"] != "tvdb" {
		t.Errorf("a valid per-field source was lost because a sibling was bad: %v", got)
	}
	// The nonsense one falls back to the work's own pinned supplier rather than
	// being recorded as typed, or dropped.
	if got["description"] != "tvdb" {
		t.Errorf("description = %q, want the fallback supplier — %v", got["description"], got)
	}
}

// THE KEYLESS SUPPLIERS REACH THE PICKER, which is what makes them metadata
// sources rather than two functions nobody calls.
//
// Letterboxd and Fandom need no credential, so what gates them is not a key but
// the work being PINNED to somebody first: both find their page by guessing a
// slug from the title, and a guess is worth making beside a record that is
// already identified — the reader sees the two side by side and can reject a
// wrong one. Offered as the only answer on an unpinned row, the same guess would
// be a confident wrong record with nothing to check it against.
func TestLetterboxdAndFandomAppearAsAlternativesOnAPinnedFilm(t *testing.T) {
	srv := newTestServer(t)
	lb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<html><script type="application/ld+json">
			{"@type":"Movie","name":"The Matrix","description":"Letterboxd's synopsis.",
			 "image":"https://a.ltrbxd.com/p.jpg","director":[{"name":"The Wachowskis"}]}
			</script><a href="/films/year/1999/">1999</a></html>`))
	}))
	defer lb.Close()
	fandom := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"query":{"pages":[{"title":"The Matrix",
			"extract":"Fandom's synopsis.","original":{"source":"https://static.wikia.nocookie.net/m.jpg"}}]}}`))
	}))
	defer fandom.Close()
	srv.TVDB = newTVDBStub(t, `{"data":{"id":70,"name":"The Matrix","year":"1999",
		"overview":"TheTVDB's synopsis.","characters":[]}}`)
	metadata.SetLetterboxdBaseForTest(t, lb.URL)
	metadata.SetFandomAndScrapeBasesForTest(t, fandom.URL, "")

	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{
		"title": "The Matrix", "media_type": "movie", "tvdb_id": 70,
	}, http.StatusOK)

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, 200))

	srcs := map[string]bool{}
	for _, s := range res.Items[0].Sources {
		srcs[s] = true
	}
	if !srcs["letterboxd"] || !srcs["fandom"] {
		t.Fatalf("the keyless suppliers did not answer: %v", res.Items[0].Sources)
	}
	// THE PINNED SUPPLIER STILL LEADS. Being keyless must not mean being first:
	// a guessed slug does not outrank an id the reader pinned.
	if res.Items[0].Sources[0] != "tvdb" {
		t.Errorf("a guessed source outranked the pinned one: %v", res.Items[0].Sources)
	}

	var descBySource map[string]string
	for _, d := range res.Items[0].Diffs {
		if d.Field == "description" {
			descBySource = map[string]string{}
			for _, a := range d.Alts {
				descBySource[a.Source] = a.Value.(string)
			}
		}
	}
	if descBySource["letterboxd"] != "Letterboxd's synopsis." || descBySource["fandom"] != "Fandom's synopsis." {
		t.Errorf("their words are not offered as alternatives: %v", descBySource)
	}

	// And one of them can be taken, and is recorded as itself.
	c.mustDo("POST", "/metadata/reverify/apply", map[string]any{
		"items": []map[string]any{{
			"type": "movie", "id": m.ID,
			"set":     map[string]any{"description": "Letterboxd's synopsis."},
			"sources": map[string]string{"description": "letterboxd"},
		}},
	}, http.StatusOK)
	if got := sourcesByField(t, c, m.ID); got["description"] != "letterboxd" {
		t.Errorf("description recorded as %q, want letterboxd — %v", got["description"], got)
	}
}

// AN UNPINNED FILM GETS NO GUESSES. Nothing identifies it, so a slug derived from
// its title has nothing to be checked against — and a confident wrong record is
// worse than none.
func TestAnUnpinnedFilmIsNotGivenAGuessedRecord(t *testing.T) {
	srv := newTestServer(t)
	var asked int
	lb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		asked++
		w.WriteHeader(http.StatusNotFound)
	}))
	defer lb.Close()
	metadata.SetLetterboxdBaseForTest(t, lb.URL)
	c := signupAdmin(t, srv.Handler())
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))

	res := decode[reverifyResp](t, c.mustDo("POST", "/metadata/reverify",
		map[string]any{"movie_ids": []int64{m.ID}}, 200))
	if res.Items[0].Status != "unpinned" {
		t.Errorf("status = %q, want unpinned", res.Items[0].Status)
	}
	if asked != 0 {
		t.Errorf("Letterboxd was guessed at for an unpinned film (%d request(s))", asked)
	}
}

// THE WIKI IS RESOLVED ONCE AND REMEMBERED, and a typed one is never overwritten.
//
// Probing costs up to four requests, which is affordable exactly once. What makes
// it affordable at all is that the answer is stored on the work, so every later
// character search on that title is a single request. And because the ladder
// cannot resolve every work — Star Wars characters live on `starwars` and on
// `wookieepedia`, and no derivation from a title picks between them — a value the
// reader typed has to survive every later probe.
func TestTheFandomWikiIsProbedOnceRememberedAndNeverOverwritten(t *testing.T) {
	var probes int
	srv := newTestServer(t)
	fandom := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slug := strings.Trim(strings.TrimSuffix(r.URL.Path, "/api.php"), "/")
		q := r.URL.Query()
		if q.Get("meta") == "siteinfo" {
			probes++
			if slug != "witcher" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			_, _ = w.Write([]byte(`{"batchcomplete":true}`))
			return
		}
		if slug == "witcher" && q.Get("titles") == "Geralt of Rivia" {
			_, _ = w.Write([]byte(`{"query":{"pages":[{"title":"Geralt of Rivia",
				"original":{"source":"https://static.wikia.nocookie.net/geralt.jpg"}}]}}`))
			return
		}
		_, _ = w.Write([]byte(`{"query":{"pages":[{"missing":true}]}}`))
	}))
	defer fandom.Close()
	metadata.SetFandomAndScrapeBasesForTest(t, fandom.URL+"/%s", "")

	c := signupAdmin(t, srv.Handler())
	game := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Witcher 3: Wild Hunt", "media_type": "game"}, http.StatusCreated))
	cast := decode[struct {
		Cast []ladderCastRow `json:"cast"`
	}](t, c.mustDo("POST", "/movies/"+strconv.FormatInt(game.ID, 10)+"/cast",
		map[string]any{"character": "Geralt of Rivia"}, http.StatusCreated))
	_ = cast
	rows := decode[struct {
		Cast []ladderCastRow `json:"cast"`
	}](t, c.mustDo("GET", "/movies/"+strconv.FormatInt(game.ID, 10)+"/cast", nil, http.StatusOK))
	if len(rows.Cast) == 0 {
		t.Fatal("no cast row to search from")
	}

	search := func() imageSearchResp {
		return decode[imageSearchResp](t, c.mustDo("POST", "/images/search", map[string]any{
			"kind": "character", "name": "Geralt of Rivia", "title": "The Witcher 3: Wild Hunt",
			"media_type": "game", "cast_id": rows.Cast[0].ID,
		}, http.StatusOK))
	}

	got := search()
	if len(got.Images) != 1 || got.Images[0].Source != "fandom" {
		t.Fatalf("the franchise wiki was not reached: %+v", got.Images)
	}
	// Three probes: witcher3wildhunt, witcher3, witcher.
	if probes != 3 {
		t.Errorf("probed %d times, want 3 (full, de-subtitled, de-numbered)", probes)
	}

	// SECOND SEARCH: NO PROBES AT ALL. The wiki is on the row now.
	probes = 0
	if got := search(); len(got.Images) != 1 {
		t.Fatalf("the remembered wiki was not used: %+v", got.Images)
	}
	if probes != 0 {
		t.Errorf("re-probed %d time(s) for a wiki already stored", probes)
	}

	// A TYPED WIKI SURVIVES. Set one by hand and confirm no probe replaces it.
	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET fandom_wiki = 'wookieepedia' WHERE id = ?`, game.ID); err != nil {
		t.Fatal(err)
	}
	probes = 0
	search()
	if probes != 0 {
		t.Errorf("a typed wiki was re-probed %d time(s)", probes)
	}
	var stored string
	if err := srv.Store.DB.QueryRow(`SELECT fandom_wiki FROM movies WHERE id = ?`, game.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != "wookieepedia" {
		t.Errorf("a typed wiki was overwritten by a probe: %q", stored)
	}
}
