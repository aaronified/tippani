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
// Renaming a book's author cleans up the old author's saved metadata (it's no
// longer referenced) while a still-referenced author survives.
func TestPeopleOrphanGC(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Idiot", "author": "F. Dostoevsky"}, http.StatusCreated))
	decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Emma", "author": "J. Austen"}, http.StatusCreated))
	// Save metadata for both authors.
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "F. Dostoevsky", "bio": "x"}, 200)
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "J. Austen", "bio": "y"}, 200)

	type peopleResp struct {
		People []struct {
			Name string `json:"name"`
		} `json:"people"`
	}
	before := decode[peopleResp](t, c.mustDo("GET", "/people?kind=author", nil, 200))
	if len(before.People) != 2 {
		t.Fatalf("expected 2 saved authors, got %+v", before.People)
	}

	// Fix the author's name on the book — the old "F. Dostoevsky" is now orphaned.
	c.mustDo("PUT", "/books/"+itoa(b.ID),
		map[string]any{"title": "The Idiot", "author": "Fyodor Dostoevsky"}, 200)

	after := decode[peopleResp](t, c.mustDo("GET", "/people?kind=author", nil, 200))
	names := map[string]bool{}
	for _, p := range after.People {
		names[p.Name] = true
	}
	if names["F. Dostoevsky"] {
		t.Fatalf("orphaned author metadata was not cleaned: %+v", after.People)
	}
	if !names["J. Austen"] {
		t.Fatalf("still-referenced author was wrongly removed: %+v", after.People)
	}
}

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
	// A referenced author with saved metadata shows the saved flag + links.
	// (Unreferenced saved rows are swept on this endpoint now — see
	// TestRenamePersonAndSweep — so keep this author backed by a real book.)
	admin.mustDo("POST", "/books", map[string]any{"title": "The Dispossessed", "author": "Ursula K. Le Guin"}, 201)
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

// Rename an author across the library folds two spellings into one — books
// rewritten, saved metadata migrated to the new name, old row gone. And the
// orphan sweep on /people/names removes a saved row no book references.
func TestRenamePersonAndSweep(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/books", map[string]any{"title": "Crime and Punishment", "author": "Fyodor Dostoevsky"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "The Idiot", "author": "Fyodor Dostoyevsky"}, http.StatusCreated)
	// Saved metadata on the variant spelling (the one we'll rename away).
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Fyodor Dostoevsky", "bio": "Russian novelist", "born": "1821"}, 200)

	res := decode[struct {
		OK      bool `json:"ok"`
		Updated int  `json:"updated"`
	}](t, c.mustDo("POST", "/people/rename",
		map[string]any{"kind": "author", "from": "Fyodor Dostoevsky", "to": "Fyodor Dostoyevsky"}, 200))
	if !res.OK || res.Updated != 1 {
		t.Fatalf("rename response: %+v", res)
	}

	var oldBooks, newBooks int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books WHERE author = 'Fyodor Dostoevsky'`).Scan(&oldBooks); err != nil {
		t.Fatal(err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM books WHERE author = 'Fyodor Dostoyevsky'`).Scan(&newBooks); err != nil {
		t.Fatal(err)
	}
	if oldBooks != 0 || newBooks != 2 {
		t.Fatalf("book authors after rename: old=%d new=%d, want 0/2", oldBooks, newBooks)
	}

	got := decode[struct {
		Exists bool      `json:"exists"`
		Person personRow `json:"person"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Fyodor+Dostoyevsky", nil, 200))
	if !got.Exists || got.Person.Bio != "Russian novelist" || got.Person.Born != "1821" {
		t.Fatalf("metadata not folded onto the new name: %+v", got)
	}
	old := decode[struct {
		Exists bool `json:"exists"`
	}](t, c.mustDo("GET", "/people?kind=author&name=Fyodor+Dostoevsky", nil, 200))
	if old.Exists {
		t.Fatal("old-spelling metadata row still exists after rename")
	}

	// Auto-sweep: a saved row for a name no book references is gone after a
	// /people/names load.
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ghost Author", "bio": "unreferenced"}, 200)
	names := decode[struct {
		People []struct {
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/names?kind=author", nil, 200))
	for _, n := range names.People {
		if n.Name == "Ghost Author" {
			t.Fatal("unreferenced 'Ghost Author' was not swept on /people/names load")
		}
	}
	var ghost int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM people WHERE name = 'Ghost Author'`).Scan(&ghost); err != nil {
		t.Fatal(err)
	}
	if ghost != 0 {
		t.Fatalf("orphan sweep left %d 'Ghost Author' rows", ghost)
	}
}
