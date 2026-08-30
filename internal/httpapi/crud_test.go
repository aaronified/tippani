package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"tippani/internal/metadata"
	"tippani/internal/store"
)

// apiPath mirrors the frontend's apiURL: the whole API now lives under /api, so
// tests that request bare paths ("/books") are routed to "/api/books". /healthz
// and the SPA stay at the root, and already-prefixed paths pass through.
func apiPath(p string) string {
	if p == "/healthz" || p == "/" || strings.HasPrefix(p, "/api/") || !strings.HasPrefix(p, "/") {
		return p
	}
	return "/api" + p
}

// ---- harness (extends the admin_test.go pattern for multi-request suites) ----

// newTestServer builds a Server against a temp-dir store. Callers grab
// srv.Handler() themselves so tests can set seams (TMDB.BaseURL) first.
func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "MediaCover"), 0o700); err != nil {
		t.Fatal(err)
	}
	srv := New(st, fstest.MapFS{}, dir, false, false)
	srv.SeedNewUsers = false // keep tag assertions deterministic; TestSeedDefaultTags flips this on

	// NO TEST IN THIS PACKAGE MAY REACH THE REAL WIKIPEDIA, and one silently did.
	//
	// The picture ladder's Wikimedia rung needs no key, which is the point of it —
	// and it means the rung fires on every portrait and character search rather
	// than only when somebody has configured something. Three tests that had
	// nothing to do with Wikimedia therefore started fetching live articles: the
	// run came back holding photographs of Viola Davis and Ursula Le Guin, each
	// URL stamped with Wikimedia's own utm_source, downloaded from their servers
	// during `go test`. Green, offline-hostile, and measuring somebody else's
	// uptime.
	//
	// The keyless rung is the reason the guard belongs HERE rather than in the
	// handful of tests that noticed. Every keyed supplier is off by default in a
	// test — no key, no call — so the package has never needed this; a rung that
	// needs no key has no such default and a test has to opt OUT. Doing that per
	// test means the next one written forgets, and forgetting looks like a pass.
	//
	// A test that actually wants Wikimedia calls SetWikipediaBaseForTest again
	// with its own stub; the later call wins and both cleanups unwind in order.
	metadata.SetWikipediaBaseForTest(t, deadWikipedia(t))
	// FANDOM IS KEYLESS FOR THE SAME REASON AND NEEDS THE SAME GUARD. Its rung
	// fires on any character search that knows the work's title, and it addresses
	// a host derived from that title — so an unstubbed test would send requests to
	// whatever <slug>.fandom.com the fixture happens to name. The scrape base is
	// pinned alongside it: that rung is off unless a setting says otherwise, but
	// pinning it costs nothing and means no test can reach google.com by setting
	// one boolean.
	metadata.SetFandomAndScrapeBasesForTest(t, deadWikipedia(t), deadWikipedia(t))
	// LETTERBOXD IS KEYLESS TOO, and its rung fires on any re-verify of a pinned
	// film. Pointed at a server that 404s everything: a missing film page is the
	// ordinary case for a guessed slug, so that is the honest silent stub here
	// rather than an empty-but-200 one.
	metadata.SetLetterboxdBaseForTest(t, notFoundServer(t))
	return srv
}

// notFoundServer answers everything with a 404 — the shape a guessed-wrong slug
// really produces.
func notFoundServer(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

// deadWikipedia is a server that answers every MediaWiki call with "no results".
// It stands in for Wikipedia AND for Fandom, which is not a shortcut: both are
// MediaWiki, both are asked the same action=query&prop=pageimages question, and
// "this wiki has nothing" is the same answer in both.
// Not a closed port: a refused connection is an error path, and a test asserting
// "no pictures" should be exercising the empty-answer path a real quiet search
// takes, not a network failure that happens to look the same from outside.
func deadWikipedia(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("list") == "search" {
			_, _ = w.Write([]byte(`{"query":{"search":[]}}`))
			return
		}
		_, _ = w.Write([]byte(`{"query":{"pages":[{}]}}`))
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

// testClient sends requests through the full handler chain as one user, via
// either credential the server accepts: a browser session cookie, or the
// Authorization: Bearer device token a native client carries. Set at most one.
type testClient struct {
	t      *testing.T
	h      http.Handler
	cookie *http.Cookie
	bearer string
}

func (c *testClient) do(method, path string, body any) *httptest.ResponseRecorder {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	return c.doRaw(method, path, &buf, "")
}

func (c *testClient) doRaw(method, path string, body io.Reader, contentType string) *httptest.ResponseRecorder {
	c.t.Helper()
	req := httptest.NewRequest(method, apiPath(path), body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	if c.bearer != "" {
		req.Header.Set("Authorization", "Bearer "+c.bearer)
	}
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	return rec
}

func (c *testClient) mustDo(method, path string, body any, want int) *httptest.ResponseRecorder {
	c.t.Helper()
	rec := c.do(method, path, body)
	if rec.Code != want {
		c.t.Fatalf("%s %s: got %d want %d: %s", method, path, rec.Code, want, rec.Body)
	}
	return rec
}

func (c *testClient) importFile(path, name string, content []byte) *httptest.ResponseRecorder {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", name)
	if err != nil {
		c.t.Fatal(err)
	}
	if _, err := fw.Write(content); err != nil {
		c.t.Fatal(err)
	}
	_ = mw.Close()
	return c.doRaw("POST", path, &buf, mw.FormDataContentType())
}

// importApprove uploads a file to an import endpoint and then approves exactly
// what that upload staged, returning the APPROVE recorder — whose body carries
// the added/skipped/enriched counters an import endpoint answered with directly
// before staging landed (ROADMAP 1.2.0). So a test that asserts "re-importing a
// library's own export is a no-op" goes on asserting exactly that, one step later.
//
// Scoping the approval by batch_id rather than approving everything matters: a
// test that imports the same file twice must approve each upload separately, or
// the second approval would find the first one's rows already gone.
//
// Use importFile directly when the assertion is about the import step itself — a
// 400 for an unparseable file, or the staged count before approval.
func (c *testClient) importApprove(path, name string, content []byte) *httptest.ResponseRecorder {
	c.t.Helper()
	rec := c.importFile(path, name, content)
	if rec.Code != http.StatusOK {
		return rec // hand the failure back so the caller can assert on it
	}
	var staged struct {
		BatchID int64 `json:"batch_id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &staged); err != nil {
		c.t.Fatalf("decode staged reply %s: %v", rec.Body, err)
	}
	if staged.BatchID == 0 {
		c.t.Fatalf("import did not answer a batch id: %s", rec.Body)
	}
	return c.do("POST", "/import/staged/approve", map[string]any{"batch_id": staged.BatchID})
}

// signupAdmin creates the first (admin) user via onboarding and logs them in.
func signupAdmin(t *testing.T, h http.Handler) *testClient {
	t.Helper()
	c := &testClient{t: t, h: h}
	rec := c.do("POST", "/auth/signup", map[string]string{"username": "alice", "password": "supersecret"})
	if rec.Code != 200 {
		t.Fatalf("signup: %d %s", rec.Code, rec.Body)
	}
	c.cookie = cookieOf(t, rec)
	return c
}

// addUser has the admin create a regular user, then logs that user in.
func addUser(t *testing.T, h http.Handler, admin *testClient, name string) *testClient {
	t.Helper()
	admin.mustDo("POST", "/admin/users",
		map[string]string{"username": name, "password": "supersecret"}, http.StatusCreated)
	c := &testClient{t: t, h: h}
	rec := c.do("POST", "/auth/login", map[string]string{"username": name, "password": "supersecret"})
	if rec.Code != 200 {
		t.Fatalf("login %s: %d %s", name, rec.Code, rec.Body)
	}
	c.cookie = cookieOf(t, rec)
	return c
}

func cookieOf(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie {
			return c
		}
	}
	t.Fatal("no session cookie set")
	return nil
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %s: %v", rec.Body, err)
	}
	return v
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

type namesResp struct {
	Genres []string `json:"genres"`
}

// tagsResp is the §10 GET /tags shape (objects with colour/style + usage).
type tagsResp struct {
	Tags []tagRow `json:"tags"`
}

func tagNames(tags []tagRow) []string {
	names := make([]string, len(tags))
	for i, t := range tags {
		names[i] = t.Name
	}
	return names
}

// ---- books ----

func TestBookCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Create: ISBN-10 normalized, genres cleaned/deduped, off-allowlist
	// cover_url is non-fatal (book saved without a cover).
	rec := c.mustDo("POST", "/books", map[string]any{
		"title":          "  The Catcher in the Rye ",
		"author":         "J. D. Salinger",
		"isbn":           "0-316-76948-7",
		"published_year": 1951,
		"genres":         []string{"Fiction", "Classics", "fiction", " "},
		"cover_url":      "https://not-allowlisted.example/x.jpg",
	}, http.StatusCreated)
	b := decode[bookDetail](t, rec)
	if b.Title != "The Catcher in the Rye" || b.ISBN != "9780316769488" {
		t.Fatalf("created book: %+v", b)
	}
	if b.CoverPath != "" {
		t.Fatalf("cover fetch should have failed silently, got %q", b.CoverPath)
	}
	if !sameStrings(b.Genres, []string{"Classics", "Fiction"}) {
		t.Fatalf("genres: %v", b.Genres)
	}

	// Same ISBN again -> 409; validation -> 400.
	c.mustDo("POST", "/books", map[string]any{"title": "Dup", "isbn": "9780316769488"}, http.StatusConflict)
	c.mustDo("POST", "/books", map[string]any{"title": " "}, http.StatusBadRequest)
	c.mustDo("POST", "/books", map[string]any{"title": "X", "isbn": "junk"}, http.StatusBadRequest)
	// The bound moved from 1000..3000 to -4000..3000, so 99 is now a year rather
	// than a rejection. Only the new edges are asserted here; that the first
	// millennium and BCE actually round-trip is ancient_years_test.go's job, and
	// creating rows for it here would move the list assertions below.
	c.mustDo("POST", "/books", map[string]any{"title": "X", "published_year": -4001}, http.StatusBadRequest)
	c.mustDo("POST", "/books", map[string]any{"title": "X", "published_year": 3001}, http.StatusBadRequest)

	// List.
	type bookItem struct {
		ID              int64    `json:"id"`
		Title           string   `json:"title"`
		ISBN            string   `json:"isbn"`
		Genres          []string `json:"genres"`
		AnnotationCount int      `json:"annotation_count"`
	}
	list := decode[struct {
		Books []bookItem `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200))
	if len(list.Books) != 1 || list.Books[0].ID != b.ID || list.Books[0].AnnotationCount != 0 ||
		!sameStrings(list.Books[0].Genres, []string{"Classics", "Fiction"}) {
		t.Fatalf("list: %+v", list.Books)
	}

	// Get.
	got := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(b.ID), nil, 200))
	if got.Author != "J. D. Salinger" || got.PublishedYear != 1951 {
		t.Fatalf("get: %+v", got)
	}

	// Update: genre change is reflected and the dropped genre is GC'd.
	upd := decode[bookDetail](t, c.mustDo("PUT", "/books/"+itoa(b.ID), map[string]any{
		"title": "The Catcher in the Rye", "author": "J.D. Salinger",
		"isbn": "9780316769488", "published_year": 1951, "genres": []string{"Classics"},
	}, 200))
	if upd.Author != "J.D. Salinger" || !sameStrings(upd.Genres, []string{"Classics"}) {
		t.Fatalf("update: %+v", upd)
	}
	if g := decode[namesResp](t, c.mustDo("GET", "/genres", nil, 200)); !sameStrings(g.Genres, []string{"Classics"}) {
		t.Fatalf("genres after update (GC): %v", g.Genres)
	}
	c.mustDo("PUT", "/books/"+itoa(b.ID), map[string]any{"title": ""}, http.StatusBadRequest)

	// Delete; orphaned genres are gone with it.
	c.mustDo("DELETE", "/books/"+itoa(b.ID), nil, 200)
	c.mustDo("GET", "/books/"+itoa(b.ID), nil, http.StatusNotFound)
	if g := decode[namesResp](t, c.mustDo("GET", "/genres", nil, 200)); len(g.Genres) != 0 {
		t.Fatalf("genres after delete: %v", g.Genres)
	}
}

// ---- annotations ----

func TestAnnotationCRUD(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))

	a1 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.",
		"chapter": "Litany", "location": "p.12",
		"tags": []string{"philosophy", "fear", "Philosophy"},
	}, http.StatusCreated))
	if a1.Color != "yellow" || !sameStrings(a1.Tags, []string{"fear", "philosophy"}) ||
		a1.Chapter != "Litany" || a1.Location != "p.12" {
		t.Fatalf("a1: %+v", a1)
	}

	// Duplicate detection folds case/whitespace (store.DedupeHash).
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "  fear is   the mind-killer.",
	}, http.StatusConflict)

	a2 := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "note": "a note about sandworms", "color": "blue",
		"tags": []string{"worms"},
	}, http.StatusCreated))

	// Validation.
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID}, http.StatusBadRequest)
	// "chartreuse", not "green": green became a real colour in 0029, and an
	// invalid-input test whose input quietly turned valid asserts nothing.
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "x", "color": "chartreuse"}, http.StatusBadRequest)

	// List + filters.
	type annList struct {
		Annotations []annotationRow `json:"annotations"`
	}
	all := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	if len(all.Annotations) != 2 || all.Annotations[0].ID != a2.ID { // newest first
		t.Fatalf("list: %+v", all.Annotations)
	}
	byBook := decode[annList](t, c.mustDo("GET", "/annotations?book_id="+itoa(book.ID), nil, 200))
	if len(byBook.Annotations) != 2 {
		t.Fatalf("book_id filter: %+v", byBook.Annotations)
	}
	byTag := decode[annList](t, c.mustDo("GET", "/annotations?tag=philosophy", nil, 200))
	if len(byTag.Annotations) != 1 || byTag.Annotations[0].ID != a1.ID {
		t.Fatalf("tag filter: %+v", byTag.Annotations)
	}
	byColor := decode[annList](t, c.mustDo("GET", "/annotations?color=blue", nil, 200))
	if len(byColor.Annotations) != 1 || byColor.Annotations[0].ID != a2.ID {
		t.Fatalf("color filter: %+v", byColor.Annotations)
	}
	// A colour outside the set is a 400 on the FILTER too, not an empty list —
	// silently returning nothing would read as "you have no purple quotes"
	// rather than "purple is not a colour". (Was "purple", which the 0029
	// widening turned into a real one.)
	c.mustDo("GET", "/annotations?color=chartreuse", nil, http.StatusBadRequest)

	// annotation_count shows up on the book list.
	count := decode[struct {
		Books []struct {
			AnnotationCount int `json:"annotation_count"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200))
	if count.Books[0].AnnotationCount != 2 {
		t.Fatalf("annotation_count: %+v", count.Books)
	}

	// Update is full state: tags replaced. The detached "worms" persists in
	// the managed vocabulary with zero usage (§10 — no auto-GC).
	upd := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(a2.ID), map[string]any{
		"quote": "He who controls the spice controls the universe.",
		"note":  "", "color": "pink", "tags": []string{"dune"},
	}, 200))
	if upd.Color != "pink" || !sameStrings(upd.Tags, []string{"dune"}) {
		t.Fatalf("update: %+v", upd)
	}
	if tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200)); !sameStrings(tagNames(tg.Tags), []string{"dune", "fear", "philosophy", "worms"}) {
		t.Fatalf("tags after update: %+v", tg.Tags)
	}

	// An edit colliding with a sibling's dedupe hash -> 409.
	c.mustDo("PUT", "/annotations/"+itoa(a2.ID), map[string]any{
		"quote": "FEAR IS THE MIND-KILLER.", "color": "pink", "tags": []string{},
	}, http.StatusConflict)

	// Delete; the vocabulary keeps every name, usage counts drop instead.
	c.mustDo("DELETE", "/annotations/"+itoa(a1.ID), nil, 200)
	c.mustDo("DELETE", "/annotations/"+itoa(a1.ID), nil, http.StatusNotFound)
	tg := decode[tagsResp](t, c.mustDo("GET", "/tags", nil, 200))
	if !sameStrings(tagNames(tg.Tags), []string{"dune", "fear", "philosophy", "worms"}) {
		t.Fatalf("tags after delete: %+v", tg.Tags)
	}
	for _, tag := range tg.Tags {
		want := 0
		if tag.Name == "dune" {
			want = 1
		}
		if tag.Annotations != want || tag.Dialogues != 0 {
			t.Fatalf("tag usage after delete: %+v", tag)
		}
	}
}

// ---- ownership isolation ----

func TestOwnershipIsolation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	book := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "genres": []string{"SF"}}, http.StatusCreated))
	ann := decode[annotationRow](t, alice.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": "Fear is the mind-killer."}, http.StatusCreated))
	movie := decode[movieDetail](t, alice.mustDo("POST", "/movies",
		map[string]any{"title": "Casablanca"}, http.StatusCreated))
	dlg := decode[dialogueRow](t, alice.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": movie.ID, "quote": "Here's looking at you, kid."}, http.StatusCreated))

	// Bob sees empty lists — never Alice's rows.
	if l := decode[struct {
		Books []bookDetail `json:"books"`
	}](t, bob.mustDo("GET", "/books", nil, 200)); len(l.Books) != 0 {
		t.Fatalf("bob books: %+v", l.Books)
	}
	if l := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, bob.mustDo("GET", "/annotations", nil, 200)); len(l.Annotations) != 0 {
		t.Fatalf("bob annotations: %+v", l.Annotations)
	}
	if l := decode[struct {
		Movies []movieDetail `json:"movies"`
	}](t, bob.mustDo("GET", "/movies", nil, 200)); len(l.Movies) != 0 {
		t.Fatalf("bob movies: %+v", l.Movies)
	}
	if g := decode[namesResp](t, bob.mustDo("GET", "/genres", nil, 200)); len(g.Genres) != 0 {
		t.Fatalf("bob genres: %v", g.Genres)
	}

	// Alice's rows exist but answer 404 to Bob (no existence leak).
	bob.mustDo("GET", "/books/"+itoa(book.ID), nil, http.StatusNotFound)
	bob.mustDo("PUT", "/books/"+itoa(book.ID), map[string]any{"title": "Hijack"}, http.StatusNotFound)
	bob.mustDo("DELETE", "/books/"+itoa(book.ID), nil, http.StatusNotFound)
	bob.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "sneak"}, http.StatusNotFound)
	bob.mustDo("PUT", "/annotations/"+itoa(ann.ID), map[string]any{"quote": "hijack", "color": "yellow", "tags": []string{}}, http.StatusNotFound)
	bob.mustDo("DELETE", "/annotations/"+itoa(ann.ID), nil, http.StatusNotFound)
	bob.mustDo("GET", "/movies/"+itoa(movie.ID), nil, http.StatusNotFound)
	bob.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie.ID, "quote": "sneak"}, http.StatusNotFound)
	bob.mustDo("PUT", "/dialogues/"+itoa(dlg.ID), map[string]any{"quote": "hijack"}, http.StatusNotFound)
	bob.mustDo("DELETE", "/dialogues/"+itoa(dlg.ID), nil, http.StatusNotFound)

	// Search is scoped too — every section comes back empty for Bob.
	res := decode[searchResults](t, bob.mustDo("GET", "/search?q=dune", nil, 200))
	if len(res.Books)+len(res.Annotations)+len(res.Movies)+len(res.Dialogues)+
		len(res.Authors)+len(res.Directors)+len(res.Actors)+
		len(res.Notes.Annotations)+len(res.Notes.Dialogues)+len(res.Tags)+len(res.Genres) != 0 ||
		res.Decade != nil || res.DateAdded != nil {
		t.Fatalf("bob search: %+v", res)
	}

	// Alice still owns everything.
	alice.mustDo("GET", "/books/"+itoa(book.ID), nil, 200)
	alice.mustDo("GET", "/movies/"+itoa(movie.ID), nil, 200)
}
