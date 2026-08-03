package httpapi

import (
	"net/http"
	"testing"
)

// books.updated_at and movies.updated_at arrived in 0020 and were never written:
// no INSERT set them, no UPDATE bumped them. 0022 maintains both with triggers,
// because these tables are written from many places and forgetting one is exactly
// how the column came to be dead in the first place.

func updatedAt(t *testing.T, srv *Server, table string, id int64) string {
	t.Helper()
	var v string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(updated_at, '') FROM `+table+` WHERE id = ?`, id).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestBookUpdatedAtIsMaintained(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Invisible Cities"}, http.StatusCreated)).ID

	created := updatedAt(t, srv, "books", id)
	if created == "" {
		t.Fatal("a newly created book must have updated_at set, not NULL")
	}

	// Backdate it so the bump is observable without depending on clock resolution.
	if _, err := srv.Store.DB.Exec(
		`UPDATE books SET updated_at = datetime('now', '-2 days') WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}
	stale := updatedAt(t, srv, "books", id)

	c.mustDo("PUT", "/books/"+itoa(id), map[string]any{"title": "Invisible Cities (rev)"}, http.StatusOK)
	if got := updatedAt(t, srv, "books", id); got == stale {
		t.Fatalf("editing a book must bump updated_at, still %q", got)
	}
}

func TestMovieUpdatedAtIsMaintained(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID

	if updatedAt(t, srv, "movies", id) == "" {
		t.Fatal("a newly created movie must have updated_at set, not NULL")
	}

	if _, err := srv.Store.DB.Exec(
		`UPDATE movies SET updated_at = datetime('now', '-2 days') WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}
	stale := updatedAt(t, srv, "movies", id)

	c.mustDo("PUT", "/movies/"+itoa(id), map[string]any{"title": "Stalker (rev)"}, http.StatusOK)
	if got := updatedAt(t, srv, "movies", id); got == stale {
		t.Fatalf("editing a movie must bump updated_at, still %q", got)
	}
}

// An import creates books through a different path than the API, which is the
// class of write site the trigger exists to cover.
func TestImportedBookHasUpdatedAt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Imported\nauthor: A. Writer\n---\n\n> A quote from an import.\n"
	if rec := c.importApprove("/import/markdown", "imported.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	var id int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM books WHERE title = 'Imported'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if updatedAt(t, srv, "books", id) == "" {
		t.Fatal("an imported book must have updated_at set, not NULL")
	}
}

// A writer that sets updated_at explicitly must win — the trigger stands aside
// rather than overwriting it with now().
func TestExplicitUpdatedAtIsRespected(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Explicit"}, http.StatusCreated)).ID

	want := "2020-01-01 00:00:00"
	if _, err := srv.Store.DB.Exec(
		`UPDATE books SET updated_at = ? WHERE id = ?`, want, id); err != nil {
		t.Fatal(err)
	}
	if got := updatedAt(t, srv, "books", id); got != want {
		t.Fatalf("explicit updated_at = %q, want %q (the trigger overwrote it)", got, want)
	}
}
