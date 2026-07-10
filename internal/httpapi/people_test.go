package httpapi

import (
	"context"
	"net/http"
	"testing"
)

func TestPeopleMetadataCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Not saved yet → an exists:false shell so the UI can offer fetch / manual.
	shell := decode[struct {
		Exists bool   `json:"exists"`
		Name   string `json:"name"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Frank+Herbert", nil, 200))
	if shell.Exists || shell.Name != "Frank Herbert" {
		t.Fatalf("unsaved shell: %+v", shell)
	}

	// Upsert manual metadata.
	p := decode[personRow](t, c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Frank Herbert", "bio": "Author of Dune.", "born": "1920", "source": "manual",
	}, 200))
	if p.ID == 0 || p.Kind != "author" || p.Name != "Frank Herbert" || p.Bio != "Author of Dune." || p.Born != "1920" {
		t.Fatalf("upsert: %+v", p)
	}

	// GET single now resolves.
	got := decode[struct {
		Exists bool      `json:"exists"`
		Person personRow `json:"person"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Frank+Herbert", nil, 200))
	if !got.Exists || got.Person.Bio != "Author of Dune." {
		t.Fatalf("get single: %+v", got)
	}

	// Update = upsert on the same (kind, name); id is stable.
	p2 := decode[personRow](t, c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Frank Herbert", "bio": "Sci-fi author.", "born": "1920-10-08",
	}, 200))
	if p2.ID != p.ID || p2.Bio != "Sci-fi author." || p2.Born != "1920-10-08" {
		t.Fatalf("update: %+v", p2)
	}

	// List by kind; actors are a separate namespace.
	list := decode[struct {
		People []personRow `json:"people"`
	}](t, c.mustDo("GET", "/people?kind=author", nil, 200))
	if len(list.People) != 1 || list.People[0].Name != "Frank Herbert" {
		t.Fatalf("list: %+v", list)
	}
	actors := decode[struct {
		People []personRow `json:"people"`
	}](t, c.mustDo("GET", "/people?kind=actor", nil, 200))
	if len(actors.People) != 0 {
		t.Fatalf("actor list should be empty: %+v", actors)
	}

	// Validation.
	c.mustDo("GET", "/people?kind=nope", nil, http.StatusBadRequest)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": ""}, http.StatusBadRequest)

	// Delete clears the metadata.
	c.mustDo("DELETE", "/people/"+itoa(p.ID), nil, 200)
	after := decode[struct {
		Exists bool `json:"exists"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Frank+Herbert", nil, 200))
	if after.Exists {
		t.Fatalf("should be deleted")
	}
}

// Cross-user isolation: one user's people rows are invisible to another.
func TestPeopleUserIsolation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin", "bio": "x"}, 200)

	other := addUser(t, h, admin, "bob")
	list := decode[struct {
		People []personRow `json:"people"`
	}](t, other.mustDo("GET", "/people?kind=author", nil, 200))
	if len(list.People) != 0 {
		t.Fatalf("bob should not see admin's people: %+v", list)
	}
}

// /people/names merges referenced names (books.author / dialogues.actor via
// the caller's movies) with saved rows, user-scoped, sorted by name.
func TestPeopleNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	admin.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"}, 201)
	m := decode[struct {
		ID int64 `json:"id"`
	}](t, admin.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, 201))
	admin.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m.ID, "quote": "Here's looking at you, kid.",
		"character": "Rick", "actor": "Humphrey Bogart",
	}, 201)
	// A saved-but-unreferenced author must still appear (stale rows stay manageable).
	admin.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Ursula K. Le Guin",
		"links": "https://en.wikipedia.org/wiki/Ursula_K._Le_Guin",
	}, 200)

	type nameRow struct {
		Name  string `json:"name"`
		Saved bool   `json:"saved"`
		Links string `json:"links"`
	}
	authors := decode[struct {
		People []nameRow `json:"people"`
	}](t, admin.mustDo("GET", "/people/names?kind=author", nil, 200))
	if len(authors.People) != 2 || authors.People[0].Name != "Frank Herbert" || authors.People[1].Name != "Ursula K. Le Guin" {
		t.Fatalf("authors = %+v", authors.People)
	}
	if authors.People[0].Saved || !authors.People[1].Saved || authors.People[1].Links == "" {
		t.Fatalf("saved flags/links wrong: %+v", authors.People)
	}
	actors := decode[struct {
		People []nameRow `json:"people"`
	}](t, admin.mustDo("GET", "/people/names?kind=actor", nil, 200))
	if len(actors.People) != 1 || actors.People[0].Name != "Humphrey Bogart" {
		t.Fatalf("actors = %+v", actors.People)
	}

	// Isolation: bob sees none of admin's names; bad kind is a 400.
	empty := decode[struct {
		People []nameRow `json:"people"`
	}](t, bob.mustDo("GET", "/people/names?kind=author", nil, 200))
	if len(empty.People) != 0 {
		t.Fatalf("bob should see nothing: %+v", empty.People)
	}
	admin.mustDo("GET", "/people/names?kind=publisher", nil, 400)
}

// /people/lookup validates input and returns provider links via the seams;
// actor lookups without a TMDB key are a clear 503.
func TestPersonLookup(t *testing.T) {
	srv := newTestServer(t)
	srv.authorLinks = func(_ context.Context, name string) (map[string]string, error) {
		if name != "Frank Herbert" {
			t.Errorf("name = %q", name)
		}
		return map[string]string{"openlibrary": "https://openlibrary.org/authors/OL79034A", "wikipedia": "https://en.wikipedia.org/wiki/Frank_Herbert"}, nil
	}
	h := srv.Handler()
	admin := signupAdmin(t, h)

	res := decode[struct {
		Links map[string]string `json:"links"`
	}](t, admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "author", "name": "Frank Herbert"}, 200))
	if res.Links["wikipedia"] != "https://en.wikipedia.org/wiki/Frank_Herbert" {
		t.Fatalf("links = %v", res.Links)
	}

	admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "author", "name": ""}, 400)
	admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "narrator", "name": "X"}, 400)
	// No TMDB key resolvable in tests -> actor lookup is a labelled 503.
	admin.mustDo("POST", "/people/lookup", map[string]any{"kind": "actor", "name": "Humphrey Bogart"}, 503)
}
