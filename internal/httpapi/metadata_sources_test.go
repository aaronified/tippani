package httpapi

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"tippani/internal/metadata"
)

type sourcesResp struct {
	Sources []sourceRow `json:"sources"`
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
	// A KEYLESS SUPPLIER IS NOT RED AND IS NOT GREEN. Open Library answers
	// without a credential, so "key saved" would be a light about a key that does
	// not exist and "needs a key" would be false.
	if st := sourceNamed(t, got.Sources, "openlibrary").State; st != srcStateOptional {
		t.Errorf("a keyless supplier says %q", st)
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

// HOW MUCH OF THIS LIBRARY CAME FROM EACH SUPPLIER — the pack's "records
// supplied", and the number that tells a reader which of these rows they actually
// depend on.
//
// AND IT IS THEIRS, NOT THE SERVER'S. Every query on this console is scoped by
// user; a count that summed the whole table would tell one reader how much
// somebody else's shelf owes to TMDB, which is both wrong and none of their
// business.
func TestASourceRowCountsOnlyYourOwnRecords(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	mine := signupAdmin(t, h)
	other := addUser(t, h, mine, "someone")

	book := createBook(t, mine, "A Book")
	// Written directly: what is under test is the count this console reports, and
	// the path that fills the table is a provider fetch.
	for _, field := range []string{"description", "cover", "published_year"} {
		if _, err := srv.Store.DB.Exec(
			`INSERT INTO work_field_source (user_id, kind, work_id, field, source) VALUES (1, 'book', ?, ?, 'google')`,
			book, field); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_field_source (user_id, kind, work_id, field, source) VALUES (2, 'book', 99, 'description', 'google')`); err != nil {
		t.Fatal(err)
	}

	got := decode[sourcesResp](t, mine.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if n := sourceNamed(t, got.Sources, "google").Records; n != 3 {
		t.Errorf("my three fields from Google count as %d", n)
	}
	if n := sourceNamed(t, got.Sources, "tmdb").Records; n != 0 {
		t.Errorf("a supplier that wrote nothing counts %d", n)
	}

	// THE OTHER ACCOUNT SEES ITS OWN ONE, not my three.
	got = decode[sourcesResp](t, other.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	if n := sourceNamed(t, got.Sources, "google").Records; n != 1 {
		t.Errorf("another account is shown %d of my records", n)
	}
}

// A TEST ASKS THE SUPPLIER THE SAME WAY EVERYTHING ELSE DOES, and the reason is
// the failure it would otherwise invite: a bespoke health check is a second way of
// asking, and a green Test over a broken lookup is worse than no Test at all. So
// this drives the same seam a book lookup drives, and asserts the answer reaches
// the same place a book lookup's answer reaches.
func TestTestingASourceAsksItAndReportsWhatItSaid(t *testing.T) {
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

// TESTING EVERY SOURCE IS THE SAME ACT AT ANOTHER WIDTH — the pack's "Test every
// source" above the list and "Test TMDB" on the row — so it is one handler, and
// an empty body means all of them.
func TestTestingEverySourceCoversTheOnesThatCanBeAsked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}

	// EVERY SUPPLIER THAT COULD ACTUALLY BE ASKED. With a built-in film key in
	// place that is TMDB as well as Google Books — the keyless ones are skipped
	// rather than failed, which is what makes this press useful on a new install.
	srv.TMDBBuiltin = "builtin-key"
	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]any{}, http.StatusOK))
	back := map[string]bool{}
	for _, row := range got.Sources {
		back[row.Source] = true
	}
	if !back["google"] || !back["tmdb"] {
		t.Fatalf("want the suppliers that had a key: %+v", got.Sources)
	}
	if back["igdb"] {
		t.Error("a supplier with no key was reported as asked")
	}
	srv.TMDBBuiltin = ""

	// A SCRAPER IS NOT TESTABLE AND SAYS SO. Asking Fandom a synthetic question on
	// a button press is how an install earns a rate limit; the refusal is named
	// rather than silently returning a row that was never asked.
	c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "fandom"}, http.StatusBadRequest)
	c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "nonsense"}, http.StatusBadRequest)
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

// A SUPPLIER WITH NO KEY CANNOT BE ASKED, AND SAYS SO RATHER THAN SAYING NOTHING.
//
// It used to fall through: no client, no call, no record, and a row handed back
// with nothing on it — so pressing Test on a keyless TMDB was a button that did
// absolutely nothing, which is the one thing a button must never do. The screen
// disables that press; this is the other half, for the race where a key is
// cleared between the render and the press.
func TestTestingASourceWithNoKeyIsRefusedRatherThanIgnored(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	srv.TMDB.Key = ""
	srv.TMDBBuiltin = ""

	c.mustDo("POST", "/admin/metadata/test", map[string]string{"source": "tmdb"}, http.StatusConflict)

	// AND "TEST EVERYTHING" STILL WORKS OVER AN INSTANCE WITH ONE KEY. Skipping
	// the keyless ones is not the same as failing: a new install has exactly one
	// supplier that can answer, and a press that refused the lot would be the
	// card crying wolf about its ordinary state.
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}
	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]any{}, http.StatusOK))
	if len(got.Sources) != 1 || got.Sources[0].Source != "google" {
		t.Fatalf("want only the supplier that could be asked: %+v", got.Sources)
	}
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
	// The whitelists are switch statements, so they are asked rather than parsed:
	// every slug either side accepts is offered to them and kept if it comes back.
	candidates := []string{
		"google", "openlibrary", "amazon", "hardcover",
		"tmdb", "tvdb", "igdb", "wikidata", "imdb", "letterboxd", "fandom",
		"manual", "nonsense",
	}
	missing := []string{}
	accepted := 0
	for _, slug := range candidates {
		if knownBookSource(slug) == "" && knownMovieSource(slug) == "" {
			continue
		}
		accepted++
		if sourceRowExempt[slug] || rowed[slug] {
			continue
		}
		missing = append(missing, slug)
	}
	if accepted < 10 {
		t.Fatalf("the whitelists accepted only %d of the slugs offered — this case is checking almost nothing", accepted)
	}
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
