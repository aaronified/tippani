package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"tippani/internal/metadata"
)

// One on-demand IMDb pass, against a server that is not IMDb.
//
// WHAT IS ACTUALLY UNDER TEST is the three promises this path makes and nothing
// about IMDb's markup: **one request per press**, an id and never a search, and the
// 0048 provenance rule surviving a source it was not written for. The page fixture
// below is the shape the real page carries; if IMDb changes it, the parse degrades
// to "no cast" and these cases say which promise broke.

// imdbPage builds a title page carrying the embedded JSON document the parser
// reads. Written as a template rather than pasted from a real page: what matters
// is the field path, and 300KB of real markup in a test file is 300KB nobody will
// re-read.
func imdbPage(title, kind string, pairs [][2]string) string {
	var b strings.Builder
	b.WriteString(`<!DOCTYPE html><html><body><h1>` + title + `</h1>`)
	b.WriteString(`<script id="__NEXT_DATA__" type="application/json">`)
	b.WriteString(`{"props":{"pageProps":{"mainColumnData":{`)
	b.WriteString(`"titleText":{"text":` + strconv.Quote(title) + `},`)
	b.WriteString(`"titleType":{"id":` + strconv.Quote(kind) + `},`)
	b.WriteString(`"cast":{"edges":[`)
	for i, p := range pairs {
		if i > 0 {
			b.WriteString(",")
		}
		fmt.Fprintf(&b, `{"node":{"name":{"id":"nm%07d","nameText":{"text":%s},"primaryImage":{"url":"https://m.media-amazon.com/images/x.jpg"}},"characters":[{"name":%s}]}}`,
			i+1, strconv.Quote(p[1]), strconv.Quote(p[0]))
	}
	b.WriteString(`]}}}}}`)
	b.WriteString(`</script></body></html>`)
	return b.String()
}

// imdbStub stands in for www.imdb.com and COUNTS ITS REQUESTS, which is the whole
// point: "IMDb once" is a promise about how many times this is called, so the test
// has to be able to fail when a second call appears.
type imdbStub struct {
	hits  int
	paths []string
	page  string
	code  int
}

func newIMDbStub(t *testing.T, page string) (*imdbStub, func()) {
	t.Helper()
	st := &imdbStub{page: page, code: http.StatusOK}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		st.hits++
		st.paths = append(st.paths, r.URL.Path)
		if st.code != http.StatusOK {
			w.WriteHeader(st.code)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(st.page))
	}))
	metadata.IMDbBaseURL = srv.URL
	return st, func() {
		metadata.IMDbBaseURL = ""
		srv.Close()
	}
}

func gameFixture(t *testing.T, c *testClient, title string) int64 {
	t.Helper()
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": title, "media_type": "game"}, http.StatusCreated))
	return m.ID
}

type imdbReply struct {
	Title struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		Kind  string `json:"kind"`
	} `json:"title"`
	Added int `json:"added"`
	Cast  []struct {
		Character string `json:"character"`
		Actor     string `json:"actor"`
		Origin    string `json:"origin"`
		Source    string `json:"source"`
	} `json:"cast"`
}

func TestIMDbCastFillsAGameThatWikidataHasNothingFor(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := gameFixture(t, c, "The Witcher 3: Wild Hunt")
	stub, done := newIMDbStub(t, imdbPage("The Witcher 3: Wild Hunt", "videoGame", [][2]string{
		{"Geralt of Rivia", "Doug Cockle"},
		{"Yennefer of Vengerberg", "Denise Gough"},
	}))
	defer done()

	got := decode[imdbReply](t, c.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/imdb",
		map[string]any{"imdb": "https://www.imdb.com/title/tt1073668/?ref_=ttfc_ov_i"}, http.StatusOK))

	// ONE REQUEST. The promise the whole design rests on.
	if stub.hits != 1 {
		t.Fatalf("made %d requests to IMDb (%v), want exactly one", stub.hits, stub.paths)
	}
	// And it asked for the title page of the id inside the URL — the id was
	// extracted, the URL was not followed.
	if stub.paths[0] != "/title/tt1073668/" {
		t.Errorf("asked for %q, want /title/tt1073668/", stub.paths[0])
	}
	// The reply names what was attached, which is the reader's only check against a
	// cast landing on the wrong work.
	if got.Title.Title != "The Witcher 3: Wild Hunt" || got.Title.Kind != "videoGame" || got.Title.ID != "tt1073668" {
		t.Errorf("title came back as %+v", got.Title)
	}
	// Values, not counts: pairs, in the page's billing order.
	if len(got.Cast) != 2 {
		t.Fatalf("stored %+v", got.Cast)
	}
	if got.Cast[0].Character != "Geralt of Rivia" || got.Cast[0].Actor != "Doug Cockle" {
		t.Errorf("first row is %+v", got.Cast[0])
	}
	// Marked as the provider's, and named as IMDb's, so a later refetch from
	// somewhere else can tell whose row it is.
	if got.Cast[0].Origin != "provider" || got.Cast[0].Source != "imdb" {
		t.Errorf("provenance is %+v, want provider/imdb", got.Cast[0])
	}
}

// The provenance rule, over a source it was not written for. This is the case that
// would let IMDb quietly become the exception to 0048.
func TestIMDbCastLeavesTheReadersOwnRowsAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := gameFixture(t, c, "Disco Elysium")
	path := "/movies/" + strconv.FormatInt(id, 10) + "/cast"

	// A row the reader typed by hand, and a row they will correct.
	c.mustDo("POST", path, map[string]any{"character": "Kim Kitsuragi", "actor": "Jullian Champenois"}, http.StatusCreated)
	seeded := decode[struct {
		Cast []struct {
			ID        int64  `json:"id"`
			Character string `json:"character"`
		} `json:"cast"`
	}](t, c.mustDo("GET", path, nil, http.StatusOK))
	if len(seeded.Cast) != 1 {
		t.Fatalf("fixture: %+v", seeded.Cast)
	}

	stub, done := newIMDbStub(t, imdbPage("Disco Elysium", "videoGame", [][2]string{
		// IMDb spells the reader's character the same and its actor differently.
		{"Kim Kitsuragi", "SOMEBODY ELSE"},
		{"The Detective", "Lenval Brown"},
	}))
	defer done()
	got := decode[imdbReply](t, c.mustDo("POST", path+"/imdb", map[string]any{"imdb": "tt7566812"}, http.StatusOK))
	if stub.hits != 1 {
		t.Fatalf("made %d requests, want one", stub.hits)
	}

	// Keyed by the PAIR and not by the character, because the pair is what a cast
	// row is: two rows naming one character with two different actors is a supplier
	// disagreeing with the reader about who plays them, which is a real state (0048's
	// pair unique allows exactly it) and which every provider path produces. What
	// must not happen is the reader's row CHANGING.
	pairs := map[string]string{}
	for _, row := range got.Cast {
		pairs[row.Character+" / "+row.Actor] = row.Origin
	}
	// THE READER'S ROW SURVIVES, NAMES AND ORIGIN INTACT. This is the rule, and IMDb
	// does not get to be the exception to it.
	if pairs["Kim Kitsuragi / Jullian Champenois"] != "reader" {
		t.Errorf("the hand-typed row did not survive as the reader's: %v", pairs)
	}
	// The credit IMDb adds beside it is added, marked as the provider's.
	if pairs["The Detective / Lenval Brown"] != "provider" {
		t.Errorf("the new credit was not added as the provider's: %v", pairs)
	}
	// And IMDb's disagreement about who plays Kim is stored as its own row rather
	// than as an edit to the reader's — visible, deletable, and not a silent rewrite.
	if pairs["Kim Kitsuragi / SOMEBODY ELSE"] != "provider" {
		t.Errorf("IMDb's own version of the row is missing or mislabelled: %v", pairs)
	}
}

func TestIMDbCastRefusesAnythingThatIsNotATitleID(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := gameFixture(t, c, "Hades")
	stub, done := newIMDbStub(t, imdbPage("Hades", "videoGame", nil))
	defer done()

	path := "/movies/" + strconv.FormatInt(id, 10) + "/cast/imdb"
	for _, bad := range []string{"", "Hades", "nm0000123", "https://www.imdb.com/find?q=hades", "tt12", "../../etc/passwd"} {
		c.mustDo("POST", path, map[string]any{"imdb": bad}, http.StatusBadRequest)
	}
	// NOTHING WENT OUT for any of them. A rejected id must be rejected before a
	// request is built, or this endpoint becomes a way to make the server fetch a
	// URL somebody else chose.
	if stub.hits != 0 {
		t.Errorf("made %d outbound request(s) for input the guard rejected (%v)", stub.hits, stub.paths)
	}
}

func TestIMDbCastIsScopedToItsOwner(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	id := gameFixture(t, alice, "Elden Ring")
	bob := addUser(t, h, alice, "bob")
	stub, done := newIMDbStub(t, imdbPage("Elden Ring", "videoGame", [][2]string{{"Melina", "Aoife Wilson"}}))
	defer done()

	bob.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/imdb",
		map[string]any{"imdb": "tt6819232"}, http.StatusNotFound)
	// And the ownership check ran BEFORE the fetch: an outbound request for a
	// foreign id would make this endpoint an existence oracle.
	if stub.hits != 0 {
		t.Errorf("fetched IMDb for a work the caller does not own (%v)", stub.paths)
	}
}

// A title IMDb lists with nobody in it is a normal answer — the same rule the
// Wikidata path follows — and it must not read as a failure.
func TestIMDbCastWithNoCastIsNotAnError(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := gameFixture(t, c, "Obscure Indie")
	_, done := newIMDbStub(t, imdbPage("Obscure Indie", "videoGame", nil))
	defer done()
	got := decode[imdbReply](t, c.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/imdb",
		map[string]any{"imdb": "tt9999999"}, http.StatusOK))
	if got.Added != 0 || len(got.Cast) != 0 {
		t.Errorf("expected an empty cast, got %+v", got)
	}
}

// A page that is not a title page — IMDb answering 404, or answering something
// without the embedded document — is one failed pass and NOT a retry.
func TestIMDbCastDoesNotRetryAPageItCannotRead(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	id := gameFixture(t, c, "Mystery")
	stub, done := newIMDbStub(t, "<html><body>no document here</body></html>")
	defer done()
	c.mustDo("POST", "/movies/"+strconv.FormatInt(id, 10)+"/cast/imdb",
		map[string]any{"imdb": "tt1234567"}, http.StatusNotFound)
	if stub.hits != 1 {
		t.Errorf("made %d requests for an unreadable page, want exactly one", stub.hits)
	}
}
