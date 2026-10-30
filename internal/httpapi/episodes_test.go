package httpapi

// WHAT THIS FILE KNOWS: GET /movies/{id}/episodes and the answer's fields, POST /movies and
// /dialogues to arrange a show with lines, and the one-time pass's effect on a database that
// already held lines (run directly through the store, since the server has booted by then).

import (
	"net/http"
	"testing"
)

type episodesBody struct {
	Order    string `json:"order"`
	HasDVD   bool   `json:"has_dvd"`
	Episodes []struct {
		Name       string                                   `json:"name"`
		Quotes     int                                      `json:"quotes"`
		Candidates []string                                 `json:"candidates"`
		Orders     map[string]struct{ Season, Episode int } `json:"orders"`
	} `json:"episodes"`
}

func TestAShowsEpisodesAreListedWithTheirQuoteCountsAndNameCandidates(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show := c.newScreen("A Show", "show")
	c.newLine(show, "one", map[string]any{"season": 1, "episode": 1, "episode_name": "Pilot"})
	c.newLine(show, "two", map[string]any{"season": 1, "episode": 1, "episode_name": "Pilot"})
	if _, err := srv.Store.DB.Exec(`INSERT INTO episodes (movie_id, name, source) VALUES (?, '', '')`, show); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`INSERT INTO episode_orders (episode_id, kind, season, episode) VALUES (1, 'tv', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	got := decode[episodesBody](t, c.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK))
	if got.Order != "tv" || got.HasDVD || len(got.Episodes) != 1 {
		t.Fatalf("%+v", got)
	}
	e := got.Episodes[0]
	if e.Quotes != 2 || len(e.Candidates) != 1 || e.Candidates[0] != "Pilot" || e.Orders["tv"].Season != 1 {
		t.Fatalf("%+v", e)
	}
}

func TestAFilmHasNoEpisodesAndAnotherReadersShowIsNotFound(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	film := alice.newScreen("A Film", "movie")
	show := alice.newScreen("Alice's Show", "show")
	alice.mustDo("GET", "/movies/"+itoa(film)+"/episodes", nil, http.StatusNotFound)
	bob.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusNotFound)
	alice.mustDo("GET", "/movies/"+itoa(show)+"/episodes", nil, http.StatusOK)
}
