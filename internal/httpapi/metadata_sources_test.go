package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"tippani/internal/metadata"
)

type sourcesResp struct {
	Sources []sourceRow `json:"sources"`
}

// stubHostsOnlyATestReaches points the three hosts a Test press asks with no key
// (IMDb, Wikidata, Amazon's cover address) at stubs, for a case that presses one.
// newTestServer already stubs the other keyless hosts. NOT THERE TOO: several
// tests set one of these three before calling newTestServer, and a stub set
// inside it would overwrite theirs.
func stubHostsOnlyATestReaches(t *testing.T) {
	t.Helper()
	metadata.SetWikidataBaseForTest(t, deadWikipedia(t))
	metadata.SetAmazonCDNBaseForTest(t, notFoundServer(t))
	orig := metadata.IMDbBaseURL
	metadata.IMDbBaseURL = notFoundServer(t)
	t.Cleanup(func() { metadata.IMDbBaseURL = orig })
}

func sourceNamed(t *testing.T, rows []sourceRow, slug string) sourceRow {
	t.Helper()
	for _, r := range rows {
		if r.Source == slug {
			return r
		}
	}
	t.Fatalf("no row for %q in %+v", slug, rows)
	return sourceRow{}
}

// WHAT THE CONSOLE'S HEADING ACTUALLY ASKS: who can this app ask, and can it.
//
// A LIST OF KEY FIELDS COULD NOT ANSWER IT. The screen drew one row per
// credential — a TheTVDB key, a TheTVDB pin — so a supplier that needs no key at
// all appeared nowhere, and a reader could not tell "nothing is stored because
// nothing is needed" from "nothing is stored and nothing will answer". The state
// is the whole point of the row, so it is what this case asserts, in each of the
// three transitions a film key can make.
func TestEverySourceSaysWhetherItCanBeAsked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	got := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if len(got.Sources) < 4 {
		t.Fatalf("want a row per supplier, got %+v", got.Sources)
	}

	// NO KEY AND NO BUILT-IN IS THE RED ONE, because a film lookup will 503.
	if st := sourceNamed(t, got.Sources, "tmdb").State; st != srcStateNeeded {
		t.Errorf("with no TMDB key at all the row says %q", st)
	}
	// A SUPPLIER THAT NEEDS NOTHING FROM THE READER IS BUILT IN: not red (it needs no
	// key), not green ("key saved" would be a light about a key that does not exist), and
	// not "optional", which promises a key to add. The owner asked for exactly this of
	// Wikimedia and the rest.
	for _, slug := range []string{"openlibrary", "wikimedia", "fandom", "wikidata", "imdb", "letterboxd", "google-images"} {
		if st := sourceNamed(t, got.Sources, slug).State; st != srcStateBuiltin {
			t.Errorf("%s needs nothing from the reader and says %q, want built in", slug, st)
		}
	}
	// The two with something to add keep "optional": a key or a cookie improves them.
	for _, slug := range []string{"google", "amazon"} {
		if st := sourceNamed(t, got.Sources, slug).State; st != srcStateOptional {
			t.Errorf("%s can be improved by a credential and says %q, want optional", slug, st)
		}
	}

	srv.TMDBBuiltin = "builtin-key"
	got = decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if st := sourceNamed(t, got.Sources, "tmdb").State; st != srcStateBuiltin {
		t.Errorf("running on the app's own key, the row says %q", st)
	}
	// AND THE WORD IS THE ONE THE SCREEN ALREADY DRAWS. The state is a class name
	// (`.is-src-builtin`) and a locale key (`SRC_STATE_WORD`) on the other side of
	// the wire, so a fifth spelling of it is a mark with no colour and a label
	// with a hole in it — on official builds only, which is where nobody looks.
	// The rating that found this had both halves green: the wire said "bundled"
	// and the browser world had no built-in key.
	if st := sourceNamed(t, got.Sources, "tmdb").State; st != "builtin" {
		t.Errorf("the built-in state reaches the screen as %q, which it cannot draw", st)
	}
	srv.TMDBBuiltin = ""

	c.mustDo("PUT", "/admin/metadata-keys", map[string]string{"tmdb_key": "mine"}, http.StatusOK)
	got = decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if st := sourceNamed(t, got.Sources, "tmdb").State; st != srcStateSaved {
		t.Errorf("with a key of my own, the row says %q", st)
	}
}

// HOW MUCH OF THIS LIBRARY CAME FROM EACH SUPPLIER: the fields it wrote and the
// works they are in. The owner, 30 September: "not just the count of works and
// peoples, but of fields. \"Fields | works\"". An API journey: books added from a
// supplier, read back on the console, one put in the bin.
//
// AND IT IS THEIRS, NOT THE SERVER'S: every query on this console is scoped by
// user. And only what the library still holds counts: the provenance table
// outlives a binned work.
func TestASourceRowCountsTheFieldsAndWorksItSupplied(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	mine := signupAdmin(t, h)
	other := addUser(t, h, mine, "someone")

	add := func(c *testClient, title string) int64 {
		return decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{
			"title": title, "author": "Eliot", "description": "A study.", "source": "google", "source_id": title,
		}, http.StatusCreated)).ID
	}
	first := add(mine, "Middlemarch")
	add(mine, "Romola")
	add(other, "Silas Marner")

	row := func(c *testClient) sourceRow {
		return sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "google")
	}
	if got := row(mine); got.Fields != 6 || got.Works != 2 {
		t.Errorf("two books of three fields each from Google read %d fields | %d works", got.Fields, got.Works)
	}
	if got := sourceNamed(t, decode[sourcesResp](t, mine.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, "tmdb"); got.Fields != 0 || got.Works != 0 {
		t.Errorf("a supplier that wrote nothing reads %d | %d", got.Fields, got.Works)
	}
	if got := row(other); got.Fields != 3 || got.Works != 1 {
		t.Errorf("another account is shown %d | %d, not its own one book", got.Fields, got.Works)
	}
	mine.mustDo("DELETE", "/books/"+itoa(first), nil, http.StatusOK)
	if got := row(mine); got.Fields != 3 || got.Works != 1 {
		t.Errorf("a binned book still counts: %d | %d", got.Fields, got.Works)
	}
}

// A TEST ASKS THE SUPPLIER THE SAME WAY EVERYTHING ELSE DOES, and the reason is
// the failure it would otherwise invite: a bespoke health check is a second way of
// asking, and a green Test over a broken lookup is worse than no Test at all. So
// this drives the same seam a book lookup drives, and asserts the answer reaches
// the same place a book lookup's answer reaches.
func TestTestingASourceAsksItAndReportsWhatItSaid(t *testing.T) {
	stubHostsOnlyATestReaches(t)
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	asked := ""
	// A CANDIDATE CARRIES THE SUPPLIER THAT FOUND IT, because the search asks two
	// of them and hands back one merged list — which is the whole reason the
	// answers are recorded per source rather than lumped under Google's name.
	srv.searchBooks = func(_ context.Context, _, title, _, _ string) ([]metadata.BookCandidate, error) {
		asked = title
		return []metadata.BookCandidate{
			{Title: "Dune", Source: "google"},
			{Title: "Dune", Source: "openlibrary"},
			{Title: "Dune (again)", Source: "openlibrary"},
		}, nil
	}
	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "google"}, http.StatusOK))
	if asked == "" {
		t.Fatal("pressing Test asked the supplier nothing at all")
	}
	if len(got.Sources) != 1 || got.Sources[0].Source != "google" {
		t.Fatalf("want the tested source back: %+v", got.Sources)
	}
	last := got.Sources[0].Last
	if last == nil || !last.OK || last.Found != 1 {
		t.Fatalf("the row does not carry what the supplier said: %+v", last)
	}

	// AND OPEN LIBRARY GETS ITS OWN ANSWER FROM THE SAME SEARCH. It used to get
	// none: the total went under "google", so Open Library's row read "nothing has
	// asked it yet" for ever, in an app that asks it on every book lookup.
	both := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	ol := sourceNamed(t, both.Sources, "openlibrary").Last
	if ol == nil || ol.Found != 2 {
		t.Errorf("Open Library was asked and its row says: %+v", ol)
	}

	// AND A FAILURE IS REPORTED AS ONE, on the row and in the fault list — which
	// is the same registry, deliberately: two places that could disagree about
	// whether a supplier works is the thing this design avoids.
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, errors.New("google books: status 500")
	}
	got = decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "google"}, http.StatusOK))
	if last := got.Sources[0].Last; last == nil || last.OK || last.Error == "" {
		t.Fatalf("a failed test reads as: %+v", last)
	}
	status := decode[struct {
		Faults []faultRow `json:"faults"`
	}](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if len(status.Faults) == 0 {
		t.Error("a test that failed left nothing on the fault list")
	}
}

// EVERY SOURCE ON THE LIST CAN BE ASKED FROM IT. The owner, looking at eight rows
// with no Test beside them: "why can i not test all the metadata sources?" So each
// row's Test asks its supplier and the row comes back carrying the answer, and the
// two that cannot be asked as things stand say so: IGDB with no pair, and Google's
// image results before the instance has said yes to reading them.
//
// A FRESH SERVER PER SOURCE, because the answers are kept per server. On one server
// Google's Test also answered for Open Library — one search asks both — so Open
// Library's own press could have asked nothing and its row still carried an
// answer. A rating broke that press and this case stayed green.
//
// NOTHING HERE LEAVES THE MACHINE: newTestServer stubs the keyless hosts, and
// stubHostsOnlyATestReaches the three only a Test press reaches.
func TestEverySourceOnTheListCanBeTested(t *testing.T) {
	stubHostsOnlyATestReaches(t)
	cannot := map[string]bool{"igdb": true, "google-images": true}
	for _, src := range sourceAreas {
		srv := newTestServer(t)
		c := signupAdmin(t, srv.Handler())
		srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
			return []metadata.BookCandidate{{Title: "Dune", GoogleID: "g1", OpenLibraryID: "OL1W"}}, nil
		}
		srv.TMDBBuiltin = "builtin-key"
		srv.TVDBBuiltin = "builtin-key"
		body := map[string]string{"source": src.slug}
		if cannot[src.slug] {
			c.mustDo("POST", "/admin/metadata/test", body, http.StatusConflict)
			continue
		}
		got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", body, http.StatusOK))
		if len(got.Sources) != 1 || got.Sources[0].Source != src.slug {
			t.Errorf("testing %s answered with %+v", src.slug, got.Sources)
			continue
		}
		if got.Sources[0].Last == nil {
			t.Errorf("testing %s asked it and its row still has no answer on record", src.slug)
		}
	}

	// AND GOOGLE'S IMAGE RESULTS, ONCE SWITCHED ON, ARE ASKED LIKE THE REST.
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	if err := srv.Store.SetSetting(settingGoogleScrape, "1"); err != nil {
		t.Fatal(err)
	}
	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "google-images"}, http.StatusOK))
	if len(got.Sources) != 1 || got.Sources[0].Last == nil {
		t.Errorf("Google image results, switched on, were tested and say: %+v", got.Sources)
	}
}

// A SUPPLIER THAT COULD NOT BE REACHED DID NOT ANSWER, and its row says so.
//
// Five rungs report "nothing" for a refused connection exactly as for a page with
// no picture on it, which is right inside a lookup and wrong in a Test: on a server
// that could reach nothing, Amazon, Letterboxd, Wikimedia and Fandom each said
// "answered · found nothing" while IMDb beside them said it could not be asked. So
// each is pointed at a closed port and must come back as a failure. The second half
// is the control: the same five, reachable and holding nothing, still answered.
func TestASupplierThatCannotBeReachedSaysSoRatherThanFoundNothing(t *testing.T) {
	stubHostsOnlyATestReaches(t)
	closed := httptest.NewServer(http.NotFoundHandler())
	closed.Close()
	rungs := []string{"amazon", "letterboxd", "wikimedia", "fandom", "google-images"}

	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	if err := srv.Store.SetSetting(settingGoogleScrape, "1"); err != nil {
		t.Fatal(err)
	}
	for _, slug := range rungs {
		got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": slug}, http.StatusOK))
		if last := got.Sources[0].Last; last == nil || !last.OK || last.Error != "" {
			t.Errorf("%s is reachable and empty, and its row says: %+v", slug, last)
		}
	}

	metadata.SetAmazonCDNBaseForTest(t, closed.URL)
	metadata.SetLetterboxdBaseForTest(t, closed.URL)
	metadata.SetWikipediaBaseForTest(t, closed.URL)
	metadata.SetFandomAndScrapeBasesForTest(t, closed.URL, closed.URL)
	for _, slug := range rungs {
		got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": slug}, http.StatusOK))
		if last := got.Sources[0].Last; last == nil || last.OK || last.Error == "" {
			t.Errorf("%s could not be reached, and its row says: %+v", slug, last)
		}
	}

	// AND A HOST THAT ANSWERS 5xx IS DOWN, not empty, and says so in the house
	// form, by host rather than by the slug a reader never sees.
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(down.Close)
	metadata.SetLetterboxdBaseForTest(t, down.URL)
	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "letterboxd"}, http.StatusOK))
	want := strings.TrimPrefix(down.URL, "http://") + ": status 503"
	if last := got.Sources[0].Last; last == nil || last.OK || last.Error != want {
		t.Errorf("a host answering 503 reads: %+v, want the error %q", last, want)
	}
}

// ONE SUPPLIER'S FAILURE IS NOT THE OTHER'S. A book search that finds nothing
// because Google failed used to hand back Google's error alone, and it was
// recorded against both rows, so Open Library read "did not answer — google
// books: …" while it had answered.
func TestABookSearchRecordsEachSuppliersOwnFailure(t *testing.T) {
	stubHostsOnlyATestReaches(t)
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, &metadata.BookSearchError{Google: errors.New("google books: status 500")}
	}
	c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "google"}, http.StatusOK)
	rows := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources
	if g := sourceNamed(t, rows, "google").Last; g == nil || g.OK || g.Error != "google books: status 500" {
		t.Errorf("Google failed, and its row says: %+v", g)
	}
	if ol := sourceNamed(t, rows, "openlibrary").Last; ol == nil || !ol.OK || ol.Error != "" {
		t.Errorf("Open Library answered with nothing, and its row says: %+v", ol)
	}
}

// TEST ALL ASKS EVERY SUPPLIER AT ONCE, AND ONE THAT HANGS DOES NOT HOLD THE REST.
//
// It asked them one after another inside one request, under a 60-second write
// timeout, with each outbound call allowed ten — so a network that drops traffic
// silently could cut the reply off before any answer reached the screen. Here
// Letterboxd never answers. Asked in turn, every supplier after it would be asked
// with a spent deadline and fail too; asked together, Wikimedia (after it on the
// list) answers, and Letterboxd's row names the deadline rather than a raw
// transport error.
func TestTestAllIsBoundedAndOneQuietSupplierHoldsNothingElse(t *testing.T) {
	stubHostsOnlyATestReaches(t)
	hang := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(hang.Close)
	orig := testDeadline
	testDeadline = 2 * time.Second
	t.Cleanup(func() { testDeadline = orig })

	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	metadata.SetLetterboxdBaseForTest(t, hang.URL)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}

	began := time.Now()
	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]any{}, http.StatusOK))
	if took := time.Since(began); took > 8*time.Second {
		t.Errorf("Test all took %v with a %v deadline", took, testDeadline)
	}
	lb := sourceNamed(t, got.Sources, "letterboxd").Last
	if lb == nil || lb.OK || lb.Error != "no answer within 2s" {
		t.Errorf("the supplier that never answered reads: %+v", lb)
	}
	if wm := sourceNamed(t, got.Sources, "wikimedia").Last; wm == nil || !wm.OK {
		t.Errorf("a supplier listed after the quiet one was held by it: %+v", wm)
	}
}

// IT SPENDS THE INSTANCE'S QUOTA, so it is the owner's button. Every other thing
// on this console is a read.
func TestOnlyAnAdminCanSpendTheInstancesQuota(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	reader := addUser(t, h, admin, "reader")

	reader.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "google"}, http.StatusForbidden)
	// AND THE LIST ITSELF IS NOT ADMIN-ONLY: a reader looking at a book with no
	// cover needs to see which suppliers can answer, even though only the owner
	// can give one a key.
	reader.mustDo("GET", "/metadata/status", nil, http.StatusOK)
}

// EVERY SUPPLIER THAT CAN WRITE A FIELD HAS A ROW THAT COUNTS IT.
//
// `knownBookSource` and `knownMovieSource` are the whitelists that decide what may
// be recorded in `work_field_source`, which is the column this console counts. A
// slug they accept with no row here is a supplier that filled in part of a reader's
// library and appears nowhere on the screen whose whole subject is suppliers — and
// nothing else in the tree would notice, because each list is right about itself.
// A rating found four such suppliers; this is the guard that stops the fifth.
func TestEverySupplierThatCanWriteAFieldIsOnTheList(t *testing.T) {
	rowed := map[string]bool{}
	for _, src := range sourceAreas {
		rowed[src.slug] = true
	}
	// THE SLUGS ARE READ OUT OF THE WHITELISTS' OWN SOURCE, not typed here. The
	// first version of this case listed them by hand and therefore could not see a
	// slug somebody added to the switch — a rating proved it by adding one and
	// watching this stay green, which is the second time in this change a guard
	// has been claimed for something it did not guard. A list typed into a test is
	// a list typed by whoever got the other one wrong.
	src, err := os.ReadFile("reverify_handlers.go")
	if err != nil {
		t.Fatal(err)
	}
	accepted := map[string]bool{}
	for _, fn := range []string{"knownBookSource", "knownMovieSource"} {
		body := regexp.MustCompile(`(?s)func ` + fn + `\(source string\) string \{(.*?)\n\}`).FindSubmatch(src)
		if body == nil {
			t.Fatalf("no %s in reverify_handlers.go — it was renamed, and this case is checking nothing", fn)
		}
		for _, m := range regexp.MustCompile(`"([a-z-]+)"`).FindAllSubmatch(body[1], -1) {
			accepted[string(m[1])] = true
		}
	}
	if len(accepted) < 10 {
		t.Fatalf("read only %d slugs out of the whitelists — the scan is broken: %v", len(accepted), accepted)
	}

	missing := []string{}
	for slug := range accepted {
		if sourceRowExempt[slug] || rowed[slug] {
			continue
		}
		missing = append(missing, slug)
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		t.Errorf("these suppliers can write a field and have no row to count it: %v", missing)
	}
}

// THE NEWEST ANSWER WINS WHEN A SUPPLIER ANSWERS IN TWO AREAS.
//
// TheTVDB answers film lookups AND picture searches, and the row shows one line —
// what the reader is asking is "did this thing answer me recently", not "how is its
// posters division". The two outcomes land milliseconds apart on a "test
// everything" press, and the first version of this compared RFC3339 strings
// truncated to the second, so they compared equal and the OLDER one won. A rating
// coarsened the comparison to an hour and every case still passed, because nothing
// recorded two areas for one supplier.
func TestARowShowsTheNewestOfASuppliersTwoAreas(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Films first and pictures second, in the same second.
	srv.recordLookup(faultAreaFilms, "tvdb", 7, "", nil)
	srv.recordLookup(faultAreaPictures, "tvdb", 3, "", nil)

	got := decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	last := sourceNamed(t, got.Sources, "tvdb").Last
	if last == nil {
		t.Fatal("a supplier that answered twice reports nothing")
	}
	if last.Found != 3 {
		t.Errorf("the row shows %d found — the older of the two answers won", last.Found)
	}
}

// EVERY ROW CAN SAY ITS SUPPLIER'S NAME.
//
// The screen resolves a slug through `vocab.source.<slug>.label` and falls back to
// the slug itself when the app has never named that supplier — which is right for
// a fault list, which is open-ended by design, and wrong for this list, which this
// file writes by hand. A rating found `hardcover` drawing the word "hardcover" in
// lower case next to "Open Library".
func TestEverySourceRowHasANameToDraw(t *testing.T) {
	en, err := os.ReadFile("../i18n/en.txt")
	if err != nil {
		t.Fatal(err)
	}
	bn, err := os.ReadFile("../i18n/bn.txt")
	if err != nil {
		t.Fatal(err)
	}
	for _, src := range sourceAreas {
		key := "vocab.source." + src.slug + ".label"
		for name, file := range map[string][]byte{"en.txt": en, "bn.txt": bn} {
			if !regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(key) + ` = \S`).Match(file) {
				t.Errorf("%s has no %s, so the row draws the slug", name, key)
			}
		}
	}
}

