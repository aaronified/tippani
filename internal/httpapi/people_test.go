package httpapi

import (
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
