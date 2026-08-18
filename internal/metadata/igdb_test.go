package metadata

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// igdbStub serves the Twitch token exchange and the /games endpoint. gamesBody
// is returned verbatim for every /games POST; the recorded query lets a test
// assert what was actually asked for.
type igdbStub struct {
	srv       *httptest.Server
	tokens    int    // token exchanges performed
	lastQuery string // the last Apicalypse body received
	queries   int
}

func newIGDBStub(t *testing.T, tokenStatus, gamesStatus int, tokenBody, gamesBody string) *igdbStub {
	t.Helper()
	s := &igdbStub{}
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth2/token":
			s.tokens++
			if r.Method != http.MethodPost {
				t.Errorf("token method = %s, want POST", r.Method)
			}
			if ct := r.Header.Get("Content-Type"); ct != "application/x-www-form-urlencoded" {
				t.Errorf("token content-type = %q", ct)
			}
			body, _ := io.ReadAll(r.Body)
			if !strings.Contains(string(body), "grant_type=client_credentials") {
				t.Errorf("token body = %q, want client_credentials", body)
			}
			w.WriteHeader(tokenStatus)
			w.Write([]byte(tokenBody))
		case "/games":
			s.queries++
			// Every IGDB call must carry BOTH credentials-derived headers. A
			// missing Client-ID is the failure that looks like a bad query.
			if got := r.Header.Get("Client-ID"); got != "cid" {
				t.Errorf("Client-ID = %q, want cid", got)
			}
			if got := r.Header.Get("Authorization"); got != "Bearer tok123" {
				t.Errorf("Authorization = %q, want Bearer tok123", got)
			}
			if got := r.Header.Get("User-Agent"); got != userAgent {
				t.Errorf("User-Agent = %q, want the shared agent", got)
			}
			body, _ := io.ReadAll(r.Body)
			s.lastQuery = string(body)
			w.WriteHeader(gamesStatus)
			w.Write([]byte(gamesBody))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.srv.Close)
	return s
}

func (s *igdbStub) client() *IGDB {
	return &IGDB{
		ClientID:     "cid",
		ClientSecret: "secret",
		BaseURL:      s.srv.URL,
		TokenURL:     s.srv.URL + "/oauth2/token",
	}
}

const okToken = `{"access_token":"tok123","expires_in":5184000,"token_type":"bearer"}`

// TestIGDBSearch exercises the token exchange → search flow and the mapping into
// MovieCandidate, and proves the token is fetched once rather than per call.
func TestIGDBSearch(t *testing.T) {
	games := `[{"id":1029,"name":"Elden Ring","slug":"elden-ring","summary":"A vast world.",
	            "first_release_date":1645747200,"cover":{"image_id":"co4jni"}}]`
	s := newIGDBStub(t, 200, 200, okToken, games)
	g := s.client()
	ctx := context.Background()

	cands, err := g.Search(ctx, "Elden Ring", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(cands) != 1 {
		t.Fatalf("got %d candidates, want 1: %+v", len(cands), cands)
	}
	c := cands[0]
	if c.Source != "igdb" {
		t.Errorf("Source = %q, want igdb", c.Source)
	}
	if c.SourceID != "1029" {
		t.Errorf("SourceID = %q, want 1029", c.SourceID)
	}
	if c.MediaType != "game" {
		t.Errorf("MediaType = %q, want game", c.MediaType)
	}
	if c.Title != "Elden Ring" {
		t.Errorf("Title = %q", c.Title)
	}
	// 1645747200 is 2022-02-25T00:00:00Z. Asserted as a value rather than "non
	// zero" because the bug this guards is a zone shifting it to 2021.
	if c.ReleaseYear != 2022 {
		t.Errorf("ReleaseYear = %d, want 2022", c.ReleaseYear)
	}
	if c.PosterURL != igdbImageBase+"co4jni.jpg" {
		t.Errorf("PosterURL = %q", c.PosterURL)
	}
	if !strings.Contains(s.lastQuery, `search "Elden Ring";`) {
		t.Errorf("query = %q, want a quoted search term", s.lastQuery)
	}

	// A second call must reuse the cached token.
	if _, err := g.Search(ctx, "Hades", 0); err != nil {
		t.Fatal(err)
	}
	if s.tokens != 1 {
		t.Fatalf("token exchanges = %d, want 1 (token should be cached)", s.tokens)
	}
	if s.queries != 2 {
		t.Fatalf("queries = %d, want 2", s.queries)
	}
}

// TestIGDBSearchYearFilter proves the year narrows the result set by VALUE — the
// wrong-year row is dropped and the right-year row survives.
func TestIGDBSearchYearFilter(t *testing.T) {
	games := `[{"id":1,"name":"Hades","slug":"hades","first_release_date":1600000000},
	           {"id":2,"name":"Hades II","slug":"hades-ii","first_release_date":1715000000}]`
	s := newIGDBStub(t, 200, 200, okToken, games)
	cands, err := s.client().Search(context.Background(), "Hades", 2020)
	if err != nil {
		t.Fatal(err)
	}
	if len(cands) != 1 || cands[0].Title != "Hades" || cands[0].SourceID != "1" {
		t.Fatalf("year filter kept the wrong rows: %+v", cands)
	}
}

// TestIGDBDetails maps a full games payload into MovieDetails, including the
// developer landing in Director and the collection winning over the franchise.
func TestIGDBDetails(t *testing.T) {
	games := `[{"id":1029,"name":"Elden Ring","slug":"elden-ring","summary":"A vast world.",
	   "first_release_date":1645747200,"cover":{"image_id":"co4jni"},
	   "genres":[{"name":"Role-playing (RPG)"},{"name":"Adventure"}],
	   "collection":{"name":"Elden Ring"},
	   "franchises":[{"name":"FromSoftware Games"}],
	   "involved_companies":[
	     {"developer":false,"publisher":true,"company":{"name":"Bandai Namco","logo":{"image_id":"publogo"}}},
	     {"developer":true,"publisher":false,"company":{"name":"FromSoftware","logo":{"image_id":"devlogo"}}}]}]`
	s := newIGDBStub(t, 200, 200, okToken, games)

	d, err := s.client().Details(context.Background(), "1029")
	if err != nil {
		t.Fatal(err)
	}
	if d.Source != "igdb" || d.MediaType != "game" {
		t.Errorf("source/media = %q/%q", d.Source, d.MediaType)
	}
	if d.IGDBID != 1029 {
		t.Errorf("IGDBID = %d, want 1029", d.IGDBID)
	}
	if d.Slug != "elden-ring" {
		t.Errorf("Slug = %q — this is the Wikidata join key, it must survive", d.Slug)
	}
	if d.Title != "Elden Ring" || d.ReleaseYear != 2022 {
		t.Errorf("title/year = %q/%d", d.Title, d.ReleaseYear)
	}
	// The developer, not the publisher — a studio is who made it.
	if d.Director != "FromSoftware" {
		t.Errorf("Director (studio) = %q, want FromSoftware", d.Director)
	}
	if d.StudioLogoURL != IGDBCoverURL("devlogo") {
		t.Errorf("StudioLogoURL = %q, want the DEVELOPER logo", d.StudioLogoURL)
	}
	// 0042 — and this is the assertion the old shape could not make: the
	// publisher is not lost, it is simply not the studio.
	if d.Publisher != "Bandai Namco" {
		t.Errorf("Publisher = %q, want Bandai Namco", d.Publisher)
	}
	// collection beats franchises: the tighter name is the one a reader typed.
	if d.Series != "Elden Ring" {
		t.Errorf("Series = %q, want the collection name", d.Series)
	}
	if len(d.Genres) != 2 || d.Genres[0] != "Role-playing (RPG)" || d.Genres[1] != "Adventure" {
		t.Errorf("Genres = %v", d.Genres)
	}
	if d.PosterURL != IGDBCoverURL("co4jni") {
		t.Errorf("PosterURL = %q, want the big variant", d.PosterURL)
	}
	if d.PosterThumbURL != igdbImageBase+"co4jni.jpg" {
		t.Errorf("PosterThumbURL = %q, want the small variant", d.PosterThumbURL)
	}
	if len(d.Raw) == 0 {
		t.Error("Raw is empty; source_metadata would cache nothing")
	}
	if !strings.Contains(s.lastQuery, "where id = 1029;") {
		t.Errorf("query = %q", s.lastQuery)
	}
}

// TestIGDBPublisherIsNotTheStudio replaces TestIGDBStudioFallsBackToPublisher,
// which asserted the behaviour 0042 removed.
//
// That test was right about its own design and the design was wrong: with one
// column to write a company into, "a publisher name beats a blank studio" was a
// reasonable trade. With two columns it is a field labelled STUDIO stating the
// name of a company that did not make the game — so the publisher goes in the
// publisher field and the studio stays empty, which is what IGDB actually said.
func TestIGDBPublisherIsNotTheStudio(t *testing.T) {
	games := `[{"id":7,"name":"Some Game","slug":"some-game",
	   "involved_companies":[{"developer":false,"publisher":true,
	     "company":{"name":"Sony Interactive","logo":{"image_id":"sonylogo"}}}]}]`
	s := newIGDBStub(t, 200, 200, okToken, games)
	d, err := s.client().Details(context.Background(), "7")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "" {
		t.Errorf("Director = %q — a publisher must never be reported as the studio", d.Director)
	}
	if d.StudioLogoURL != "" {
		t.Errorf("StudioLogoURL = %q — no developer means no studio logo", d.StudioLogoURL)
	}
	if d.Publisher != "Sony Interactive" {
		t.Errorf("Publisher = %q, want Sony Interactive", d.Publisher)
	}
}

// TestIGDBPrefersTheDeveloperThatOnlyDevelops is the reported bug, in the shape
// it was reported: Mass Effect Legendary Edition came back crediting Electronic
// Arts as its studio.
//
// EA is entered as developer AND publisher on that record, and BioWare — which
// actually made it — sits later in the same array flagged developer alone.
// involved_companies has no meaningful order, so "the first row flagged
// developer" was picking EA by luck. The company with the narrower claim wins.
func TestIGDBPrefersTheDeveloperThatOnlyDevelops(t *testing.T) {
	games := `[{"id":126459,"name":"Mass Effect Legendary Edition","slug":"mass-effect-legendary-edition",
	   "involved_companies":[
	     {"developer":true,"publisher":true,"company":{"name":"Electronic Arts","logo":{"image_id":"ealogo"}}},
	     {"developer":true,"publisher":false,"company":{"name":"BioWare","logo":{"image_id":"biowarelogo"}}}]}]`
	s := newIGDBStub(t, 200, 200, okToken, games)
	d, err := s.client().Details(context.Background(), "126459")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "BioWare" {
		t.Errorf("Director (studio) = %q, want BioWare — EA published it, BioWare made it", d.Director)
	}
	if d.StudioLogoURL != IGDBCoverURL("biowarelogo") {
		t.Errorf("StudioLogoURL = %q — the logo must follow the studio the name came from", d.StudioLogoURL)
	}
	if d.Publisher != "Electronic Arts" {
		t.Errorf("Publisher = %q, want Electronic Arts", d.Publisher)
	}
}

// TestIGDBEveryDeveloperAlsoPublishes guards the tie-break against the failure
// it would be easy to introduce: narrowing an answer must never blank one. A
// self-published studio is flagged both and is still the studio.
func TestIGDBEveryDeveloperAlsoPublishes(t *testing.T) {
	games := `[{"id":9,"name":"Self Published","slug":"self-published",
	   "involved_companies":[{"developer":true,"publisher":true,
	     "company":{"name":"Lantern Works","logo":{"image_id":"lanternlogo"}}}]}]`
	s := newIGDBStub(t, 200, 200, okToken, games)
	d, err := s.client().Details(context.Background(), "9")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "Lantern Works" || d.StudioLogoURL != IGDBCoverURL("lanternlogo") {
		t.Fatalf("studio = %q / %q — a studio that publishes itself is still the studio", d.Director, d.StudioLogoURL)
	}
	if d.Publisher != "Lantern Works" {
		t.Errorf("Publisher = %q — it is both, and both fields say so", d.Publisher)
	}
}

// TestIGDBNoCompaniesLeavesStudioBlank — a game with no involved_companies gets
// an empty studio rather than a wrong one.
func TestIGDBNoCompaniesLeavesStudioBlank(t *testing.T) {
	s := newIGDBStub(t, 200, 200, okToken, `[{"id":8,"name":"Indie","slug":"indie"}]`)
	d, err := s.client().Details(context.Background(), "8")
	if err != nil {
		t.Fatal(err)
	}
	if d.Director != "" || d.StudioLogoURL != "" {
		t.Fatalf("expected a blank studio, got %q / %q", d.Director, d.StudioLogoURL)
	}
	if d.Publisher != "" {
		t.Errorf("Publisher = %q, want empty", d.Publisher)
	}
}

// TestIGDBAuthFailure covers Twitch's actual rejection shape: a wrong id or
// secret answers 400, not 401.
func TestIGDBAuthFailure(t *testing.T) {
	s := newIGDBStub(t, 400, 200, `{"status":400,"message":"invalid client"}`, `[]`)
	_, err := s.client().Search(context.Background(), "anything", 0)
	if !errors.Is(err, ErrIGDBAuth) {
		t.Fatalf("err = %v, want ErrIGDBAuth", err)
	}
}

// TestIGDBMissingCredentials fails closed without spending a request.
func TestIGDBMissingCredentials(t *testing.T) {
	s := newIGDBStub(t, 200, 200, okToken, `[]`)
	g := s.client()
	g.ClientSecret = ""
	if _, err := g.Search(context.Background(), "x", 0); !errors.Is(err, ErrIGDBAuth) {
		t.Fatalf("err = %v, want ErrIGDBAuth", err)
	}
	if s.tokens != 0 || s.queries != 0 {
		t.Fatalf("made %d token + %d game calls with no secret; want none", s.tokens, s.queries)
	}
}

// TestIGDBReauthOn401 proves an expired token is refreshed exactly once and the
// query retried, rather than looping.
func TestIGDBReauthOn401(t *testing.T) {
	tokens, queries := 0, 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth2/token":
			tokens++
			w.Write([]byte(okToken))
		case "/games":
			queries++
			if queries == 1 { // the cached token has expired server-side
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Write([]byte(`[{"id":5,"name":"Retried","slug":"retried"}]`))
		}
	}))
	defer srv.Close()

	g := &IGDB{ClientID: "cid", ClientSecret: "s", BaseURL: srv.URL, TokenURL: srv.URL + "/oauth2/token"}
	cands, err := g.Search(context.Background(), "x", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(cands) != 1 || cands[0].Title != "Retried" {
		t.Fatalf("candidates after retry: %+v", cands)
	}
	if tokens != 2 {
		t.Fatalf("token exchanges = %d, want 2 (initial + one refresh)", tokens)
	}
	if queries != 2 {
		t.Fatalf("game queries = %d, want 2 (original + one retry)", queries)
	}
}

// TestApicalypseString is the FTS5 rule applied to a second query language:
// a term with a quote in it must not be able to close the string and add syntax.
func TestApicalypseString(t *testing.T) {
	cases := []struct{ in, want string }{
		{`Elden Ring`, `"Elden Ring"`},
		{`Assassin's Creed`, `"Assassin's Creed"`}, // an apostrophe is harmless
		{`say "hi"`, `"say \"hi\""`},
		{`back\slash`, `"back\\slash"`},
		{"line\nbreak", `"line break"`},
		{`  padded  `, `"padded"`},
		// The injection this exists for: closing the string and appending a clause.
		{`x"; where id = 1; search "y`, `"x\"; where id = 1; search \"y"`},
	}
	for _, c := range cases {
		if got := apicalypseString(c.in); got != c.want {
			t.Errorf("apicalypseString(%q) = %s, want %s", c.in, got, c.want)
		}
	}
}

// TestIGDBYearIsUTC pins the zone. A release at midnight UTC on 1 January must
// not become the previous year for a reader west of Greenwich.
//
// THE OBVIOUS VERSION OF THIS TEST ASSERTS NOTHING, and it was written that way
// first. Calling igdbYear(1704067200) and wanting 2024 passes on any machine at
// or east of Greenwich whether the code says .UTC() or not — this one is
// UTC+5:30, so dropping .UTC() left it green. The zone has to be moved WEST for
// the difference to exist at all.
//
// time.Local is a global, which is acceptable here only because these tests are
// not parallel; the restore is deferred rather than left to the end of the
// function so a failed assertion cannot leak the fake zone into another test.
func TestIGDBYearIsUTC(t *testing.T) {
	const newYearUTC = 1704067200 // 2024-01-01T00:00:00Z — 2023-12-31 in the Americas

	orig := time.Local
	t.Cleanup(func() { time.Local = orig })
	time.Local = time.FixedZone("UTC-8", -8*60*60)

	if got := igdbYear(newYearUTC); got != 2024 {
		t.Errorf("igdbYear = %d in a UTC-8 process, want 2024 — the release date is a "+
			"calendar fact about the game, not about the reader", got)
	}
	// Prove the fake zone is actually in effect, so this test cannot silently
	// stop testing anything if time.Local assignment is ever ignored.
	if y := time.Unix(newYearUTC, 0).Year(); y != 2023 {
		t.Fatalf("local-zone year = %d, want 2023: the UTC-8 zone did not take effect, "+
			"so this test proves nothing", y)
	}
	if got := igdbYear(0); got != 0 {
		t.Errorf("igdbYear(0) = %d, want 0 (unknown release date)", got)
	}
}
