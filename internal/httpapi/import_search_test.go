package httpapi

import (
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type importResult struct {
	BookID   int64   `json:"book_id"`
	BookIDs  []int64 `json:"book_ids"`
	Added    int     `json:"added"`
	Skipped  int     `json:"skipped"`
	Enriched int     `json:"enriched"`
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

// TestImportMarkdownMultiBook covers the export round-trip: one .md holding two
// "---" frontmatter blocks imports as two distinct books, and the first must not
// absorb the second's quotes.
func TestImportMarkdownMultiBook(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	md := "---\ntitle: Alpha\nauthor: A. One\n---\n\n> First alpha quote.\n\n> Second alpha quote.\n\n" +
		"---\ntitle: Beta\nauthor: B. Two\n---\n\n> Only beta quote.\n"

	res := decode[importResult](t, c.importFile("/import/markdown", "both.md", []byte(md)))
	if res.Added != 3 || res.Skipped != 0 {
		t.Fatalf("multi-book import: %+v", res)
	}
	if len(res.BookIDs) != 2 {
		t.Fatalf("want 2 book_ids, got %v", res.BookIDs)
	}
	// Alpha keeps its two quotes; Beta keeps its one (no leakage).
	counts := map[string]int{}
	for _, id := range res.BookIDs {
		b := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, 200))
		anns := decode[struct {
			Annotations []annotationRow `json:"annotations"`
		}](t, c.mustDo("GET", "/annotations?book_id="+itoa(id), nil, 200))
		counts[b.Title] = len(anns.Annotations)
	}
	if counts["Alpha"] != 2 || counts["Beta"] != 1 {
		t.Fatalf("per-book annotation counts = %v (want Alpha:2 Beta:1)", counts)
	}

	// Idempotent: re-importing the same multi-book file adds nothing.
	res2 := decode[importResult](t, c.importFile("/import/markdown", "both.md", []byte(md)))
	if res2.Added != 0 || res2.Skipped != 3 {
		t.Fatalf("re-import: %+v", res2)
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
			a.Color != "yellow" || a.Favorite { // defaults fill the gaps
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

// A skipped duplicate enriches the existing row: empty fields fill from the
// incoming copy, tags union, and already-set values are never overwritten
// (PLAN §5 duplicate enrichment).
func TestImportDuplicateEnrichment(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Import 1: bare quote — no chapter/location/note/tags, default color.
	bare := "---\ntitle: Enrich Me\nauthor: A\n---\n\n> The same passage, twice imported.\n"
	r1 := decode[importResult](t, c.importFile("/import/markdown", "bare.md", []byte(bare)))
	if r1.Added != 1 || r1.Enriched != 0 {
		t.Fatalf("first import: %+v", r1)
	}

	// Import 2: same text (typographic variant exercises the fold) + rich metadata.
	rich := strings.Join([]string{
		"---", "title: Enrich Me", "author: A", "---", "",
		"## Chapter 9", "",
		"> The same passage — twice imported.", // curly dash folds to the same hash? (— vs ,) no: text must hash equal
		"- note: filled by the second import",
		"- loc: p.42",
		"- colour: blue",
		"- tags: alpha, beta",
		"- favorite: true",
		"",
	}, "\n")
	// Keep the quote text hash-identical to import 1 (comma version).
	rich = strings.Replace(rich, "The same passage — twice imported.", "The same passage, twice imported.", 1)
	r2 := decode[importResult](t, c.importFile("/import/markdown", "rich.md", []byte(rich)))
	if r2.BookID != r1.BookID || r2.Added != 0 || r2.Skipped != 1 || r2.Enriched != 1 {
		t.Fatalf("enriching import: %+v", r2)
	}
	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(r1.BookID), nil, 200))
	if len(anns.Annotations) != 1 {
		t.Fatalf("want 1 annotation, got %d", len(anns.Annotations))
	}
	a := anns.Annotations[0]
	if a.Chapter != "Chapter 9" || a.Location != "p.42" || a.Note != "filled by the second import" ||
		a.Color != "blue" || !a.Favorite || !sameStrings(a.Tags, []string{"alpha", "beta"}) {
		t.Fatalf("not enriched: %+v", a)
	}

	// Import 3: same text again with DIFFERENT metadata — must not overwrite,
	// only union the new tag; identical re-import counts as skipped, not enriched.
	clobber := "---\ntitle: Enrich Me\nauthor: A\n---\n\n## Chapter 1\n\n> The same passage, twice imported.\n- note: should NOT replace\n- loc: p.999\n- colour: pink\n- tags: gamma\n"
	r3 := decode[importResult](t, c.importFile("/import/markdown", "clobber.md", []byte(clobber)))
	if r3.Added != 0 || r3.Skipped != 1 || r3.Enriched != 0 {
		t.Fatalf("clobber import: %+v", r3)
	}
	anns = decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(r1.BookID), nil, 200))
	a = anns.Annotations[0]
	if a.Chapter != "Chapter 9" || a.Location != "p.42" || a.Note != "filled by the second import" ||
		a.Color != "blue" {
		t.Fatalf("existing values were clobbered: %+v", a)
	}
	if !sameStrings(a.Tags, []string{"alpha", "beta", "gamma"}) { // union
		t.Fatalf("tags not unioned: %v", a.Tags)
	}
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

	// Results are faceted by WHAT matched: an author-name query lands in the
	// Authors section (name + books), not as bare book rows.
	res := decode[searchResults](t, c.mustDo("GET", "/search?q=herbert", nil, 200))
	if len(res.Authors) != 1 || res.Authors[0].Name != "Frank Herbert" ||
		len(res.Authors[0].Books) != 1 || res.Authors[0].Books[0].ID != book.ID {
		t.Fatalf("q=herbert: %+v", res)
	}
	if len(res.Books)+len(res.Annotations)+len(res.Movies)+len(res.Dialogues) != 0 {
		t.Fatalf("q=herbert leaked into plain sections: %+v", res)
	}
	// Enriched grouping fields ride along on the faceted hits too.
	if b := res.Authors[0].Books[0]; len(b.Genres) != 1 || b.Genres[0] != "Science Fiction" {
		t.Fatalf("author book hit genres: %+v", b)
	}
	// A title query lands in Books.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=dune", nil, 200))
	if len(res.Books) != 1 || res.Books[0].ID != book.ID || len(res.Authors) != 0 {
		t.Fatalf("q=dune: %+v", res)
	}
	// Genre names land in the Genres section with the works attached.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=science+fiction", nil, 200))
	if len(res.Genres) != 1 || res.Genres[0].Name != "Science Fiction" || len(res.Genres[0].Books) != 1 {
		t.Fatalf("q=science fiction: %+v", res)
	}
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=fear", nil, 200))
	if len(res.Annotations) != 1 || res.Annotations[0].BookTitle != "Dune" {
		t.Fatalf("q=fear: %+v", res)
	}
	// Parent-book fields carried on the annotation hit so an annotation-only
	// group still buckets by author/genre.
	if a := res.Annotations[0]; a.BookAuthor != "Frank Herbert" || len(a.BookGenres) != 1 || a.BookGenres[0] != "Science Fiction" {
		t.Fatalf("annotation parent fields: %+v", a)
	}
	// Director names land in Directors.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=curtiz&scope=movies", nil, 200))
	if len(res.Directors) != 1 || res.Directors[0].Name != "Michael Curtiz" ||
		len(res.Directors[0].Movies) != 1 || res.Directors[0].Movies[0].ReleaseYear != 1942 {
		t.Fatalf("q=curtiz: %+v", res)
	}
	// Actor names land in Actors ("everything Bogart says").
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=bogart&scope=dialogues", nil, 200))
	if len(res.Actors) != 1 || res.Actors[0].Name != "Humphrey Bogart" ||
		len(res.Actors[0].Dialogues) != 1 || res.Actors[0].Dialogues[0].Timestamp != "01:15:00" {
		t.Fatalf("q=bogart: %+v", res)
	}
	// A character query stays a dialogue hit.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=blaine&scope=dialogues", nil, 200))
	if len(res.Dialogues) != 1 || res.Dialogues[0].MovieTitle != "Casablanca" {
		t.Fatalf("q=blaine: %+v", res)
	}
	// Prefix search (typeahead): every token matches by prefix, so a partial
	// word still finds the row — "herb"→Herbert, "casab"→Casablanca.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=herb", nil, 200))
	if len(res.Authors) != 1 || res.Authors[0].Books[0].ID != book.ID {
		t.Fatalf("prefix q=herb: %+v", res)
	}
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=casab&scope=movies", nil, 200))
	if len(res.Movies) != 1 || res.Movies[0].ID != movie.ID {
		t.Fatalf("prefix q=casab: %+v", res)
	}
	// Multi-word prefix ACROSS columns: no single facet holds both tokens, so
	// the cross-column fallback finds "Casablanca" (title) by "Michael"
	// (director) — the pre-facet behaviour, kept as a second pass.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=casab+mich&scope=movies", nil, 200))
	if len(res.Movies) != 1 || res.Movies[0].ID != movie.ID {
		t.Fatalf("multi-word prefix q=casab mich: %+v", res)
	}

	// Scopes not requested come back as empty arrays.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=fear&scope=books", nil, 200))
	if len(res.Books)+len(res.Annotations)+len(res.Movies)+len(res.Dialogues)+
		len(res.Authors)+len(res.Directors)+len(res.Actors) != 0 {
		t.Fatalf("scope=books: %+v", res)
	}
	c.mustDo("GET", "/search", nil, http.StatusBadRequest) // q required
}

// TestSearchFacets exercises the sections beyond the credit facets: tags,
// notes, decade and date-added.
func TestSearchFacets(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dune", "author": "Frank Herbert", "published_year": 1965,
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.",
		"note": "litany against fear", "tags": []string{"wisdom"},
	}, http.StatusCreated)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Casablanca", "director": "Michael Curtiz", "release_year": 1942,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Here's looking at you, kid.",
		"note": "the toast", "tags": []string{"wisdom"},
	}, http.StatusCreated)

	// Tags: name match returns the tag with its quotes (both media) and count.
	res := decode[searchResults](t, c.mustDo("GET", "/search?q=wisdom", nil, 200))
	if len(res.Tags) != 1 || res.Tags[0].Name != "wisdom" || res.Tags[0].Count != 2 ||
		len(res.Tags[0].Annotations) != 1 || len(res.Tags[0].Dialogues) != 1 {
		t.Fatalf("q=wisdom tags: %+v", res.Tags)
	}

	// Notes: a note-field match lands in Notes, not Annotations/Dialogues.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=litany", nil, 200))
	if len(res.Notes.Annotations) != 1 || res.Notes.Annotations[0].Note != "litany against fear" ||
		len(res.Annotations) != 0 {
		t.Fatalf("q=litany notes: %+v", res)
	}
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=toast", nil, 200))
	if len(res.Notes.Dialogues) != 1 || len(res.Dialogues) != 0 {
		t.Fatalf("q=toast notes: %+v", res)
	}

	// Decade: "1960s" → books published then; "40s" → the 1940s film.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=1960s", nil, 200))
	if res.Decade == nil || res.Decade.Label != "1960s" || len(res.Decade.Books) != 1 || res.Decade.Books[0].ID != book.ID {
		t.Fatalf("q=1960s: %+v", res.Decade)
	}
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=40s", nil, 200))
	if res.Decade == nil || res.Decade.Label != "1940s" || len(res.Decade.Movies) != 1 {
		t.Fatalf("q=40s: %+v", res.Decade)
	}
	// An empty decade must NOT fall through to the fuzzy pass and get "corrected"
	// into a nearby year's hits — a decade query is never a typo. "1980s" (with
	// nothing from the 80s) stays empty and uncorrected, not nudged to 1960s/1940s.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=1980s", nil, 200))
	if res.Decade != nil || res.Corrected != "" ||
		len(res.Books)+len(res.Movies)+len(res.Annotations)+len(res.Dialogues) != 0 {
		t.Fatalf("empty decade should stay empty + uncorrected: %+v", res)
	}

	// Date added: everything above was created today (UTC).
	day := time.Now().UTC().Format("2006-01-02")
	res = decode[searchResults](t, c.mustDo("GET", "/search?q="+day, nil, 200))
	if res.DateAdded == nil || res.DateAdded.Date != day ||
		len(res.DateAdded.Books) != 1 || len(res.DateAdded.Movies) != 1 ||
		len(res.DateAdded.Annotations) != 1 || len(res.DateAdded.Dialogues) != 1 {
		t.Fatalf("q=%s date added: %+v", day, res.DateAdded)
	}
	// A quiet day yields no section (and no fuzzy mangling of the date).
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=1999-01-01", nil, 200))
	if res.DateAdded != nil || res.Corrected != "" {
		t.Fatalf("quiet day: %+v", res)
	}
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
