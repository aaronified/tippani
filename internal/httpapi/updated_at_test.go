package httpapi

import (
	"net/http"
	"testing"
)

func updatedAt(t *testing.T, srv *Server, table string, id int64) string {
	t.Helper()
	var v string
	if err := srv.Store.DB.QueryRow(
		`SELECT COALESCE(updated_at, '') FROM `+table+` WHERE id = ?`, id).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

// books.updated_at and movies.updated_at arrived in 0020 and were never written:
// no INSERT set them, no UPDATE bumped them. 0022 maintains both with triggers,
// because these tables are written from many places and forgetting one is exactly
// how the column came to be dead in the first place.
func TestUpdatedAtIsMaintained(t *testing.T) {
	type idOnly struct {
		ID int64 `json:"id"`
	}

	cases := []struct {
		name  string
		table string
		path  string
		title string
	}{
		{"book", "books", "/books", "Invisible Cities"},
		{"movie", "movies", "/movies", "Stalker"},
	}

	// One server serves both rows: each row reads and writes only the table it
	// created its own row in ("books" vs "movies"), keyed by that row's own id,
	// so no assertion here can observe the other row's data.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			id := decode[idOnly](t, c.mustDo("POST", tc.path,
				map[string]any{"title": tc.title}, http.StatusCreated)).ID

			created := updatedAt(t, srv, tc.table, id)
			if created == "" {
				t.Fatalf("a newly created %s must have updated_at set, not NULL", tc.name)
			}

			// Backdate it so the bump is observable without depending on clock resolution.
			if _, err := srv.Store.DB.Exec(
				`UPDATE `+tc.table+` SET updated_at = datetime('now', '-2 days') WHERE id = ?`, id); err != nil {
				t.Fatal(err)
			}
			stale := updatedAt(t, srv, tc.table, id)

			c.mustDo("PUT", tc.path+"/"+itoa(id), map[string]any{"title": tc.title + " (rev)"}, http.StatusOK)
			if got := updatedAt(t, srv, tc.table, id); got == stale {
				t.Fatalf("editing a %s must bump updated_at, still %q", tc.name, got)
			}
		})
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
