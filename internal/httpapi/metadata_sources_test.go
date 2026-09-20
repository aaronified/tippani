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
	if st := sourceNamed(t, got.Sources, "tmdb").State; st != srcStateBundled {
		t.Errorf("running on the app's own key, the row says %q", st)
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
	srv.searchBooks = func(_ context.Context, _, title, _, _ string) ([]metadata.BookCandidate, error) {
		asked = title
		return []metadata.BookCandidate{{Title: "Dune"}}, nil
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

	got := decode[sourcesResp](t, c.mustDo("POST", "/admin/metadata/test", map[string]any{}, http.StatusOK))
	if len(got.Sources) != len(testableSources) {
		t.Fatalf("want a row per testable source, got %d", len(got.Sources))
	}

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
