package httpapi

import (
	"net/http"
	"testing"

	"tippani/internal/store"
)

// The derived credit columns, exercised through the API rather than the store.
//
// WHY THIS FILE EXISTS. 0056 made books.author / translator / editor and
// movies.director a cache of work_person, and internal/store proves the cache
// and the links agree for writes that go through SetCredits. What it cannot
// prove is that every HANDLER goes through it. Twenty-one places write those
// columns; a handler that forgets is not a compile error and not a store test
// failure — it is a book whose author line and whose person panel say different
// things, discovered by a reader.
//
// So every assertion here drives a real request and then asks CreditsAgree,
// which walks the whole library comparing the two. It is the same question the
// store tests ask, from the only side that can answer it for a handler.

// creditsMustAgree fails with the disagreement, not just a count: the row and
// both values are what say which handler forgot.
func creditsMustAgree(t *testing.T, srv *Server, uid int64) {
	t.Helper()
	bad, err := store.CreditsAgree(srv.Store.DB, uid, srv.creditSeps(uid))
	if err != nil {
		t.Fatalf("credit check failed: %v", err)
	}
	for _, d := range bad {
		t.Errorf("%s %d %s: column %q, links %q", d.Kind, d.WorkID, d.Role, d.Column, d.Links)
	}
	if len(bad) > 0 {
		t.FailNow()
	}
}

func TestCreatingABookWritesItsCreditLinks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title":      "The Master and Margarita",
		"author":     "Mikhail Bulgakov",
		"translator": "Richard Pevear, Larissa Volokhonsky",
	}, http.StatusCreated))

	// TWO TRANSLATORS, NOT ONE PERSON WITH A COMMA IN THEIR NAME. This is the
	// whole point of the split, and it is what the person panel's counts rest on.
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM work_person WHERE kind = 'book' AND work_id = ? AND role = 'translator'`,
		b.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("expected two translator links, got %d", n)
	}
	creditsMustAgree(t, srv, 1)
}

func TestEditingABookRepointsItsCreditLinks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Solaris", "author": "Stanislaw Lem",
	}, http.StatusCreated))

	c.mustDo("PUT", "/books/"+itoa(b.ID), map[string]any{
		"title": "Solaris", "author": "Stanisław Lem",
	}, http.StatusOK)

	// The OLD person is not deleted — they may be credited elsewhere, and a
	// people sweep is what removes an orphan, not an edit. What must be true is
	// that this book now points at the new one and nothing else.
	var name string
	if err := srv.Store.DB.QueryRow(
		`SELECT p.name FROM work_person wp JOIN people p ON p.id = wp.person_id
		  WHERE wp.kind = 'book' AND wp.work_id = ? AND wp.role = 'author'`, b.ID).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Stanisław Lem" {
		t.Fatalf("the edit did not re-point the credit: %q", name)
	}
	creditsMustAgree(t, srv, 1)
}

func TestCreatingAFilmWritesItsDirectorLink(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Ran", "director": "Akira Kurosawa",
	}, http.StatusCreated))

	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(*) FROM work_person WHERE kind = 'movie' AND work_id = ? AND role = 'director'`,
		m.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected one director link, got %d", n)
	}
	creditsMustAgree(t, srv, 1)
}

// ONE HUMAN BEING ACROSS TWO WORKS IS ONE RECORD, which is the claim the whole
// migration exists to make true and the one a string-keyed library could not
// make at all.
func TestTwoWorksByOnePersonShareTheRecord(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
	}, http.StatusCreated))
	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The White Guard", "author": "Mikhail Bulgakov",
	}, http.StatusCreated))

	var ids []int64
	rows, err := srv.Store.DB.Query(
		`SELECT DISTINCT person_id FROM work_person WHERE role = 'author' AND work_id IN (?, ?)`, a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	if len(ids) != 1 {
		t.Fatalf("two works by one author produced %d people: %v", len(ids), ids)
	}
	creditsMustAgree(t, srv, 1)
}

// A BULK EDIT IS THE LARGEST CREDIT WRITE THE APP CAN MAKE, and the shape most
// likely to leave link rows describing a name nobody holds.
func TestBulkSettingAnAuthorCarriesTheLinks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	var ids []int64
	for _, title := range []string{"One", "Two", "Three"} {
		b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
			"title": title, "author": "Somebody",
		}, http.StatusCreated))
		ids = append(ids, b.ID)
	}
	c.mustDo("POST", "/books/bulk", map[string]any{
		"ids": ids, "author": "Ursula K. Le Guin",
	}, http.StatusOK)

	creditsMustAgree(t, srv, 1)
	var n int
	if err := srv.Store.DB.QueryRow(
		`SELECT count(DISTINCT person_id) FROM work_person WHERE role = 'author' AND work_id IN (?, ?, ?)`,
		ids[0], ids[1], ids[2]).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("a bulk author set produced %d people across three books", n)
	}
}
