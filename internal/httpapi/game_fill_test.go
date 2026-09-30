package httpapi

import (
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"

	"tippani/internal/metadata"
)

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
}

// SEVERAL OF THAT NAME, OR NO IGDB AT ALL: nothing is guessed, and the words say
// IGDB, never a film supplier.
func TestAGameIGDBCannotResolveSaysSoInIGDBsName(t *testing.T) {
	srv := newTestServer(t)
	fake := &igdbFake{search: `[{"id":1,"name":"Doom"},{"id":2,"name":"Doom"}]`}
	fake.serve(t, srv)
	c := signupAdmin(t, srv.Handler())
	id := addGame(t, c, map[string]any{"title": "Doom"})

	res := decode[fillResp](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{id}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "unpinned" || !strings.Contains(res.Results[0].Error, "several") {
		t.Fatalf("two games called Doom should leave it unpinned, saying so: %+v", res.Results)
	}

	srv.IGDB = nil
	res = decode[fillResp](t, c.mustDo("POST", "/metadata/fill", map[string]any{"movie_ids": []int64{id}}, http.StatusOK))
	if len(res.Results) != 1 || res.Results[0].Status != "unpinned" {
		t.Fatalf("with no IGDB pair: %+v", res.Results)
	}
	if e := res.Results[0].Error; !strings.Contains(e, "IGDB") || strings.Contains(e, "TMDB") {
		t.Errorf("a game with no IGDB pair is told about the wrong supplier: %q", e)
	}
}
