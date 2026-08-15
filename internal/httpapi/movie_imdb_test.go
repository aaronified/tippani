package httpapi

// The IMDb id on a film and on a show (0038).
//
// It is the odd one of the three supplier ids: nothing FETCHES with it, because
// IMDb has no public API. So the rules that matter are about carrying it safely
// rather than about resolving anything — it must survive an ordinary save, it
// must survive a re-sync that did not find one, and it must accept what a reader
// actually has in their hand, which is a URL.

import (
	"net/http"
	"testing"
)

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

// A show is not a special case here — that was the whole request. The id lives
// on the same table, so this asserts the column is reachable through the show
// path rather than only the film one.
func TestAShowCarriesAnIMDbIdToo(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	m := newMovie(t, c, map[string]any{
		"title": "The Wire", "media_type": "show", "imdb_id": "https://www.imdb.com/title/tt0306414/",
	})
	got := movieByID(t, c, m.ID)
	if got.MediaType != "show" {
		t.Fatalf("media_type = %q", got.MediaType)
	}
	if got.IMDbID != "tt0306414" {
		t.Fatalf("a show's imdb_id = %q, want tt0306414", got.IMDbID)
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
