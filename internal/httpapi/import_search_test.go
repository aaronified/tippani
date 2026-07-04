package httpapi

import (
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type importResult struct {
	BookID  int64 `json:"book_id"`
	Added   int   `json:"added"`
	Skipped int   `json:"skipped"`
}

func TestImportMarkdown(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := strings.Join([]string{
		"---",
		"title: The Book Title",
		"author: Author Name",
		"isbn: 0-316-76948-7",
		"---",
		"",
		"## Chapter 3 — The Turning Point",
		"",
		"> The quote text, which may span",
		"> multiple lines.",
		"- note: my thought about it",
		"- color: blue",
		"- tags: philosophy, memory",
		"- loc: p.142",
		"",
		"> Second quote.",
		"",
	}, "\n")

	rec := c.importFile("/import/markdown", "notes.md", []byte(md))
	if rec.Code != 200 {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	res := decode[importResult](t, rec)
	if res.Added != 2 || res.Skipped != 0 || res.BookID == 0 {
		t.Fatalf("first import: %+v", res)
	}

	// Book upserted with the normalized ISBN.
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(res.BookID), nil, 200))
	if b.Title != "The Book Title" || b.ISBN != "9780316769488" {
		t.Fatalf("imported book: %+v", b)
	}

	// Bindings landed: chapter, location, color, note, tags.
	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?tag=philosophy", nil, 200))
	if len(anns.Annotations) != 1 {
		t.Fatalf("tag filter after import: %+v", anns.Annotations)
	}
	a := anns.Annotations[0]
	if a.Color != "blue" || a.Chapter != "Chapter 3 — The Turning Point" ||
		a.Location != "p.142" || a.Note != "my thought about it" ||
		!sameStrings(a.Tags, []string{"memory", "philosophy"}) {
		t.Fatalf("imported annotation: %+v", a)
	}

	// Re-import is idempotent: same book, everything skipped.
	res2 := decode[importResult](t, c.importFile("/import/markdown", "notes.md", []byte(md)))
	if res2.BookID != res.BookID || res2.Added != 0 || res2.Skipped != 2 {
		t.Fatalf("re-import: %+v", res2)
	}

	// Invalid color aborts the whole import (transaction rolled back).
	bad := "---\ntitle: Other Book\n---\n\n> a quote\n- color: green\n"
	if rec := c.importFile("/import/markdown", "bad.md", []byte(bad)); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad color: %d %s", rec.Code, rec.Body)
	}
	// Missing file field / unparseable file -> 400.
	if rec := c.doRaw("POST", "/import/markdown", strings.NewReader("nope"), "text/plain"); rec.Code != http.StatusBadRequest {
		t.Fatalf("no multipart: %d", rec.Code)
	}
}

func TestImportBookcision(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	data, err := os.ReadFile(filepath.Join("..", "importer", "testdata", "bookcision_real.json"))
	if err != nil {
		t.Skip("real Bookcision fixture not present (gitignored — owner privacy)")
	}
	res := decode[importResult](t, c.importFile("/import/bookcision", "export.json", data))
	if res.Added != 11 || res.Skipped != 0 {
		t.Fatalf("first import: %+v", res)
	}
	// Idempotent re-import, matched via ASIN.
	res2 := decode[importResult](t, c.importFile("/import/bookcision", "export.json", data))
	if res2.BookID != res.BookID || res2.Added != 0 || res2.Skipped != 11 {
		t.Fatalf("re-import: %+v", res2)
	}
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(res.BookID), nil, 200))
	if b.ASIN != "B0031RS6PU" || b.Author != "Steven Erikson" {
		t.Fatalf("imported book: %+v", b)
	}
	count := decode[struct {
		Books []struct {
			AnnotationCount int `json:"annotation_count"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200))
	if count.Books[0].AnnotationCount != 11 {
		t.Fatalf("annotation_count: %+v", count.Books)
	}
}

// The Readest shape goes through the same endpoint via auto-detection
// (PLAN §5b); its annotations carry only quote/chapter/location.
func TestImportMarkdownReadestShape(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	data, err := os.ReadFile(filepath.Join("..", "importer", "testdata", "markdown_readest_synth.md"))
	if err != nil {
		t.Fatal(err)
	}
	res := decode[importResult](t, c.importFile("/import/markdown", "readest.md", data))
	if res.Added != 3 || res.Skipped != 0 {
		t.Fatalf("first import: %+v", res)
	}
	res2 := decode[importResult](t, c.importFile("/import/markdown", "readest.md", data))
	if res2.BookID != res.BookID || res2.Added != 0 || res2.Skipped != 3 {
		t.Fatalf("re-import: %+v", res2)
	}
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(res.BookID), nil, 200))
	if b.Title != "The Synthetic Compendium" || b.Author != "Ada Example" {
		t.Fatalf("imported book: %+v", b)
	}
	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(res.BookID), nil, 200))
	if len(anns.Annotations) != 3 {
		t.Fatalf("annotations: %+v", anns.Annotations)
	}
	for _, a := range anns.Annotations {
		if a.Chapter == "" || !strings.HasPrefix(a.Location, "p.") ||
			a.Color != "yellow" || a.Favorite || a.Rating != 0 { // defaults fill the gaps
			t.Fatalf("annotation: %+v", a)
		}
	}
}

func TestImportHardcoverHTML(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	data, err := os.ReadFile(filepath.Join("..", "importer", "testdata", "hardcover_synth.htm"))
	if err != nil {
		t.Fatal(err)
	}
	res := decode[importResult](t, c.importFile("/import/hardcover-html", "journal.htm", data))
	if res.Added != 2 || res.Skipped != 0 {
		t.Fatalf("first import: %+v", res)
	}
	// Idempotent re-import, matched via ISBN.
	res2 := decode[importResult](t, c.importFile("/import/hardcover-html", "journal.htm", data))
	if res2.BookID != res.BookID || res2.Added != 0 || res2.Skipped != 2 {
		t.Fatalf("re-import: %+v", res2)
	}
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(res.BookID), nil, 200))
	if b.Title != "The Synthetic Compendium" || b.Author != "Ada Example" ||
		b.ISBN != "9780000000002" || b.ASIN != "B00SYNTH42" {
		t.Fatalf("imported book: %+v", b)
	}
	// Parsed tags and the p.N location persisted (PLAN §5e).
	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?tag=wisdom", nil, 200))
	if len(anns.Annotations) != 1 || anns.Annotations[0].Location != "p.12" ||
		!sameStrings(anns.Annotations[0].Tags, []string{"craft", "night", "wisdom"}) {
		t.Fatalf("tagged annotation: %+v", anns.Annotations)
	}
	var src string
	if err := srv.Store.DB.QueryRow(`SELECT source FROM annotations WHERE id = ?`,
		anns.Annotations[0].ID).Scan(&src); err != nil || src != "hardcover_html" {
		t.Fatalf("source = %q (%v)", src, err)
	}
}

// Cross-source book identity (PLAN §3): one tool exports bare title/author,
// another carries the ISBN — both must land in the same book row, and the
// weaker-identity row gets its identifiers backfilled. Regression for the
// original switch-based lookup that stopped at the first present identity.
func TestImportCrossSourceBookIdentity(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	readest, err := os.ReadFile(filepath.Join("..", "importer", "testdata", "markdown_readest_synth.md"))
	if err != nil {
		t.Fatal(err)
	}
	hardcover, err := os.ReadFile(filepath.Join("..", "importer", "testdata", "hardcover_synth.htm"))
	if err != nil {
		t.Fatal(err)
	}

	// Readest first: no ISBN/ASIN, book keyed by title+author only.
	r1 := decode[importResult](t, c.importFile("/import/markdown", "readest.md", readest))
	// Hardcover second: same title+author, but carries ISBN + ASIN.
	r2 := decode[importResult](t, c.importFile("/import/hardcover-html", "journal.htm", hardcover))
	if r2.BookID != r1.BookID {
		t.Fatalf("cross-source imports split the book: %d vs %d", r1.BookID, r2.BookID)
	}

	// The title-matched row was backfilled, so an ISBN-keyed lookup now works.
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(r1.BookID), nil, 200))
	if b.ISBN != "9780000000002" || b.ASIN != "B00SYNTH42" {
		t.Fatalf("identifiers not backfilled: %+v", b)
	}
	res := decode[importResult](t, c.importFile("/import/hardcover-html", "journal.htm", hardcover))
	if res.BookID != r1.BookID {
		t.Fatalf("isbn re-match after backfill: %+v", res)
	}
}

// Backfill must happen on EVERY match path, not just title. Chain: ASIN-only
// import → ASIN+ISBN import (matches on ASIN, must backfill ISBN) → ISBN-only
// import with a different title (matches on the backfilled ISBN, not title).
// Regression for the original early-return that skipped backfill on ASIN match.
func TestImportBackfillAcrossIdentities(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// 1: Bookcision — ASIN only, long Kindle-style title.
	bc := `{"asin":"B000TEST01","title":"Deadhouse Gates: Malazan Book of the Fallen 2","authors":"Steven Erikson",` +
		`"highlights":[{"text":"quote one","isNoteOnly":false,"location":{"value":10},"note":null}]}`
	r1 := decode[importResult](t, c.importFile("/import/bookcision", "b.json", []byte(bc)))

	// 2: Hardcover — same ASIN plus an ISBN, short title. Matches on ASIN.
	hc := `{"props":{"book":{"title":"Deadhouse Gates","contributions":[{"author":{"name":"Steven Erikson"},"contribution":null}]},` +
		`"journals":[{"event":"quote","entry":"quote two","edition":{"isbn13":"9780553812176","asin":"B000TEST01"},"metadata":{"position":{"type":"pages","value":5}}}]}}`
	page := `<div id="app" data-page="` + html.EscapeString(hc) + `"></div>`
	r2 := decode[importResult](t, c.importFile("/import/hardcover-html", "j.htm", []byte(page)))
	if r2.BookID != r1.BookID {
		t.Fatalf("ASIN match split the book: %d vs %d", r2.BookID, r1.BookID)
	}
	b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(r1.BookID), nil, 200))
	if b.ISBN != "9780553812176" {
		t.Fatalf("ISBN not backfilled on ASIN match: %q", b.ISBN)
	}

	// 3: markdown — ISBN only, short title. Must match on the backfilled ISBN.
	md := "---\ntitle: Deadhouse Gates\nauthor: Steven Erikson\nisbn: 9780553812176\n---\n\n> quote three\n"
	r3 := decode[importResult](t, c.importFile("/import/markdown", "n.md", []byte(md)))
	if r3.BookID != r1.BookID {
		t.Fatalf("book split on ISBN-only import: landed in %d, want %d", r3.BookID, r1.BookID)
	}
}

type searchResp struct {
	Books       []bookHit       `json:"books"`
	Annotations []annotationHit `json:"annotations"`
	Movies      []movieHit      `json:"movies"`
	Dialogues   []dialogueHit   `json:"dialogues"`
}

func TestSearchScopes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dune", "author": "Frank Herbert", "genres": []string{"Science Fiction"},
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.",
	}, http.StatusCreated)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.",
		"character": "Rick Blaine", "actor": "Humphrey Bogart", "timestamp": "01:15:00",
	}, http.StatusCreated)

	// scope=all groups hits by type.
	res := decode[searchResp](t, c.mustDo("GET", "/search?q=herbert", nil, 200))
	if len(res.Books) != 1 || res.Books[0].ID != book.ID || len(res.Annotations)+len(res.Movies)+len(res.Dialogues) != 0 {
		t.Fatalf("q=herbert: %+v", res)
	}
	// Genre words match books via genre_text.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=science+fiction", nil, 200))
	if len(res.Books) != 1 {
		t.Fatalf("q=science fiction: %+v", res)
	}
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=fear", nil, 200))
	if len(res.Annotations) != 1 || res.Annotations[0].BookTitle != "Dune" {
		t.Fatalf("q=fear: %+v", res)
	}
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=curtiz&scope=movies", nil, 200))
	if len(res.Movies) != 1 || res.Movies[0].ID != movie.ID || res.Movies[0].ReleaseYear != 1942 {
		t.Fatalf("q=curtiz: %+v", res)
	}
	// Dialogues index character + actor too ("everything Bogart says").
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=bogart&scope=dialogues", nil, 200))
	if len(res.Dialogues) != 1 || res.Dialogues[0].MovieTitle != "Casablanca" ||
		res.Dialogues[0].Timestamp != "01:15:00" {
		t.Fatalf("q=bogart: %+v", res)
	}
	// Scopes not requested come back as empty arrays.
	res = decode[searchResp](t, c.mustDo("GET", "/search?q=fear&scope=books", nil, 200))
	if len(res.Books)+len(res.Annotations)+len(res.Movies)+len(res.Dialogues) != 0 {
		t.Fatalf("scope=books: %+v", res)
	}
	c.mustDo("GET", "/search", nil, http.StatusBadRequest) // q required
}

func TestCoversHandler(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Traversal and malformed names never reach the filesystem.
	for _, path := range []string{
		"/covers/..%2f..%2ftest.db",
		"/covers/..%5ctest.db",
		"/covers/short.jpg",
		"/covers/0123456789abcdef.exe",
		"/covers/0123456789ABCDEF.jpg", // uppercase hex is not ours
	} {
		if rec := c.do("GET", path, nil); rec.Code != http.StatusNotFound {
			t.Fatalf("%s: got %d want 404", path, rec.Code)
		}
	}

	// A stored cover is served with the immutable cache header.
	name := "0123456789abcdef.jpg"
	if err := os.WriteFile(filepath.Join(srv.coversDir(), name), []byte("fake image bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := c.mustDo("GET", "/covers/"+name, nil, 200)
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Fatalf("cache header: %q", cc)
	}
	// Well-formed but missing -> 404.
	if rec := c.do("GET", "/covers/deadbeefdeadbeef.png", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("missing file: %d", rec.Code)
	}
}
