package httpapi

import (
	"archive/zip"
	"bytes"
	"net/http"
	"strings"
	"testing"
	"time"
)

// seedExportBook builds the golden-test library: one book, four annotations
// covering chapterless entries, multi-line quotes, non-default bindings and
// a note-only annotation.
func seedExportBook(t *testing.T, c *testClient) bookDetail {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dune", "author": "Frank Herbert", "isbn": "9780441013593",
		"published_year": 1965, "genres": []string{"Science Fiction", "Classics"},
	}, http.StatusCreated))
	for _, body := range []map[string]any{
		{"quote": "Chapterless quote."},
		{"quote": "Fear is the mind-killer.\nI will face my fear.", "note": "my  note\nacross lines",
			"color": "blue", "chapter": "Book One", "location": "p.12",
			"tags": []string{"philosophy", "fear"}, "favorite": true, "rating": 5},
		{"note": "A note-only thought.", "chapter": "Book One"},
		{"quote": "Second chapter quote.", "chapter": "Book Two"},
	} {
		body["book_id"] = book.ID
		c.mustDo("POST", "/annotations", body, http.StatusCreated)
	}
	return book
}

// __DATE__ stands in for today's date: manual annotations get noted_at = now,
// so every quote block exports a "- date:" binding (the test substitutes it).
const wantBookExport = `---
title: Dune
author: Frank Herbert
isbn: 9780441013593
year: 1965
genres: Classics, Science Fiction
---

> Chapterless quote.
- date: __DATE__

## Book One

> Fear is the mind-killer.
> I will face my fear.
- note: my note across lines
- color: blue
- tags: fear, philosophy
- loc: p.12
- date: __DATE__
- favorite: true
- rating: 5

> A note-only thought.
- date: __DATE__

## Book Two

> Second chapter quote.
- date: __DATE__
`

func TestBookExport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := seedExportBook(t, c)

	rec := c.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, 200)
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Fatalf("content type: %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); cd != `attachment; filename="Dune.md"` {
		t.Fatalf("content disposition: %q", cd)
	}
	want := strings.ReplaceAll(wantBookExport, "__DATE__", time.Now().UTC().Format("2006-01-02"))
	if got := rec.Body.String(); got != want {
		t.Fatalf("export mismatch:\n--- got ---\n%s\n--- want ---\n%s", got, want)
	}
	c.mustDo("GET", "/books/999/export", nil, http.StatusNotFound)
	c.mustDo("GET", "/books/abc/export", nil, http.StatusBadRequest)
}

// PLAN §6b property: a book export is valid §5b(a) importer input, so
// re-importing it is a dedupe no-op.
func TestBookExportRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := seedExportBook(t, c)

	exported := c.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, 200).Body.Bytes()
	res := decode[importResult](t, c.importFile("/import/markdown", "dune.md", exported))
	if res.BookID != book.ID || res.Added != 0 || res.Skipped != 4 {
		t.Fatalf("round trip: %+v", res)
	}
}

// TestNotedAtRoundTrip: an imported "- date:" binding is stored as noted_at and
// re-exported, so the date of addition survives export → re-import.
func TestNotedAtRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Dated Book\n---\n\n> A dated highlight.\n- date: 2020-01-15\n"
	res := decode[importResult](t, c.importFile("/import/markdown", "d.md", []byte(md)))
	if res.Added != 1 {
		t.Fatalf("import: %+v", res)
	}
	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(res.BookID), nil, 200))
	if len(anns.Annotations) != 1 || anns.Annotations[0].NotedAt != "2020-01-15" {
		t.Fatalf("noted_at not stored: %+v", anns.Annotations)
	}
	if exp := c.mustDo("GET", "/books/"+itoa(res.BookID)+"/export", nil, 200).Body.String(); !strings.Contains(exp, "- date: 2020-01-15") {
		t.Fatalf("export missing date:\n%s", exp)
	}
}

func TestMovieExport(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942,
		"genres": []string{"Drama"},
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.",
		"character": "Rick Blaine", "actor": "Humphrey Bogart", "timestamp": "01:15:00",
		"note": "iconic", "tags": []string{"classic"}, "favorite": true, "rating": 5,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{ // untimed -> sorts last
		"movie_id": movie.ID, "quote": "Round up the usual suspects.",
	}, http.StatusCreated)

	want := `---
title: Casablanca
director: Michael Curtiz
year: 1942
genres: Drama
---

> Here's looking at you, kid.
- character: Rick Blaine
- actor: Humphrey Bogart
- timestamp: 01:15:00
- note: iconic
- tags: classic
- favorite: true
- rating: 5

> Round up the usual suspects.
`
	rec := c.mustDo("GET", "/movies/"+itoa(movie.ID)+"/export", nil, 200)
	if got := rec.Body.String(); got != want {
		t.Fatalf("export mismatch:\n--- got ---\n%s\n--- want ---\n%s", got, want)
	}
	c.mustDo("GET", "/movies/999/export", nil, http.StatusNotFound)
}

func TestExportZip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Two books whose titles sanitize to the same filename, plus one movie.
	c.mustDo("POST", "/books", map[string]any{"title": "Dune?"}, http.StatusCreated)
	c.mustDo("POST", "/books", map[string]any{"title": "Dune*"}, http.StatusCreated)
	c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix"}, http.StatusCreated)

	rec := c.mustDo("GET", "/export", nil, 200)
	if ct := rec.Header().Get("Content-Type"); ct != "application/zip" {
		t.Fatalf("content type: %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "tippani-export.zip") {
		t.Fatalf("content disposition: %q", cd)
	}
	body := rec.Body.Bytes()
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range zr.File {
		names = append(names, f.Name)
	}
	want := []string{"books/Dune-.md", "books/Dune- (2).md", "movies/The Matrix.md"}
	if !sameStrings(names, want) {
		t.Fatalf("zip entries: %v", names)
	}
	// Each member is a rendered markdown file.
	f, err := zr.File[0].Open()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	buf := make([]byte, 32)
	n, _ := f.Read(buf)
	if !strings.HasPrefix(string(buf[:n]), "---\ntitle: Dune?\n") {
		t.Fatalf("first member: %q", buf[:n])
	}
}

func TestExportOwnership(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Dune"}, http.StatusCreated))
	movie := decode[movieDetail](t, alice.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))

	// Foreign ids answer 404 (no existence leak), like every other route.
	bob.mustDo("GET", "/books/"+itoa(book.ID)+"/export", nil, http.StatusNotFound)
	bob.mustDo("GET", "/movies/"+itoa(movie.ID)+"/export", nil, http.StatusNotFound)

	// Bob's library zip is empty; Alice's has both items.
	body := bob.mustDo("GET", "/export", nil, 200).Body.Bytes()
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	if len(zr.File) != 0 {
		t.Fatalf("bob's zip: %v", zr.File)
	}
	body = alice.mustDo("GET", "/export", nil, 200).Body.Bytes()
	if zr, err = zip.NewReader(bytes.NewReader(body), int64(len(body))); err != nil || len(zr.File) != 2 {
		t.Fatalf("alice's zip: %v (%v)", zr.File, err)
	}
}
