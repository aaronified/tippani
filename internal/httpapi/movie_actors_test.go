package httpapi

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

import (
	"net/http"
	"strings"
	"testing"
)

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

func TestAMovieWithACastAndNoQuotesNamesNobody(t *testing.T) {
	// THE ONE THAT DECIDES THE COLUMN, and it has to write cast_json DIRECTLY.
	//
	// The obvious version of this test posts a `cast` in the create body and
	// asserts nothing comes back. It passes, and it proves nothing: movieReq has
	// no Cast field, so the create ignored it and the film never had a cast at
	// all. Found by rewriting movieActors to read cast_json and watching this
	// test stay green — the exact shape of an assertion that agrees with itself.
	//
	// cast_json is written by a metadata fetch, so seeding it here is seeding
	// what a fetch would leave behind: a film whose whole cast is known and from
	// which nothing has been quoted. The board must not offer it under any of
	// those names, because searching one of them cannot return it.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := idOf(t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Stalker", "director": "Andrei Tarkovsky",
	}, http.StatusCreated).Body.Bytes())
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET cast_json = ? WHERE id = ?`,
		`[{"character":"Stalker","actor":"Alexander Kaidanovsky"},`+
			`{"character":"Writer","actor":"Anatoly Solonitsyn"}]`, id); err != nil {
		t.Fatalf("seed cast: %v", err)
	}
	// The seed is real, or the assertion below is vacuous again.
	var cast string
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(cast_json, '') FROM movies WHERE id = ?`, id).Scan(&cast); err != nil {
		t.Fatalf("read cast back: %v", err)
	}
	if !strings.Contains(cast, "Kaidanovsky") {
		t.Fatalf("the cast did not stick: %q", cast)
	}

	if got := listMovieActors(t, c)["Stalker"]; len(got) != 0 {
		t.Errorf("actors = %v on a film with a full cast and no saved lines; want none — "+
			"the board would offer it under an actor whose search cannot return it", got)
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
