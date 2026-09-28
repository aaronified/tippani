package httpapi

import (
	"fmt"
	"net/http"
	"slices"
	"testing"
)

// THE JOBS LIST, AS THE SCREENS READ IT (the wire contract's addendum).
//
// Settings › Jobs pages Past jobs by the smallest id it has, newest first; the
// Metadata and People screens ask Current jobs for one kind, to show a run
// already under way rather than start another; and Current jobs is read every
// two seconds while anything runs, so a job's JSON carries its params without
// the lists it was given. Everything is driven through the API as the screens
// drive it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue
// is given to the server as serve() gives it, with the test's kinds (queueing,
// jobs_api_test.go), and the fill kind's rules run under a test name with a run
// that holds (realKind), so its job can be read while it waits; the book
// supplier's seam (srv.searchBooks, duneSupplier) for the one real fill; the
// wire fields, which are the contract; and the table of the kinds a request is
// kept under (jobKinds) and the kinds a person can start (builtinJobKinds),
// held to the contract's list of the names the screens have words for, because
// a kind is data that no request lists.
//
// What each one guards, in a sentence a person would say: Past jobs pages from
// the newest, a page at a time, with nothing twice and nothing missed; asking
// Current jobs for one kind shows only that kind, each marked as mine or not; a
// job's JSON carries what it was asked in a word and not the lists it was given,
// wherever it is shown, and running it again still runs it over those lists;
// and every kind the server keeps a job under is one the screens can name.

func TestPastJobsPageFromTheNewestWithNothingTwice(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	var made []int64
	for i := 0; i < 5; i++ {
		made = append(made, alice.waitJob(alice.mustStart("test.lines", map[string]any{"tag": fmt.Sprint(i)}).ID, "succeeded").ID)
	}
	slices.Reverse(made)

	var seen []int64
	query := "view=past&kind=test.lines&limit=2"
	for page := 0; ; page++ {
		got := alice.jobs(query)
		ids := jobIDs(got.Jobs)
		if page > 3 || len(ids) == 0 {
			t.Fatalf("page %d: %v (more %t)", page, ids, got.More)
		}
		seen = append(seen, ids...)
		if !got.More {
			break
		}
		// The next page starts below the smallest id this one has.
		query = fmt.Sprintf("view=past&kind=test.lines&limit=2&before=%d", ids[len(ids)-1])
	}
	if !slices.Equal(seen, made) {
		t.Fatalf("paged past jobs %v, want every one newest first, once: %v", seen, made)
	}
}

func TestCurrentJobsForOneKindShowOnlyThatKind(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	held := alice.mustStart("test.hold", map[string]any{"tag": "a"})
	alice.waitJob(held.ID, "running")
	waiting := alice.mustStart("test.lines", map[string]any{"tag": "b"})
	bobs := bob.mustStart("test.hold", map[string]any{"tag": "c"})

	got := alice.jobs("view=current&kind=test.hold").Jobs
	if ids := jobIDs(got); !slices.Equal(ids, []int64{held.ID, bobs.ID}) {
		t.Fatalf("an admin's current test.hold jobs: %v, want %d and bob's %d and not %d", ids, held.ID, bobs.ID, waiting.ID)
	}
	if !got[0].Own || got[1].Own {
		t.Fatalf("own on the admin's current jobs: %+v", got)
	}
	if ids := jobIDs(bob.jobs("view=current&kind=test.hold").Jobs); !slices.Equal(ids, []int64{bobs.ID}) {
		t.Fatalf("bob's current test.hold jobs: %v", ids)
	}
	q.let()
	q.let()
}

func TestAJobsJSONCarriesNoListItWasGivenAndARerunStillRunsOverThem(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	srv.addJobKind(realKind(t, "fill", "test.fill", q.hold))
	duneSupplier(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	noLists := func(where string, j wireJob) {
		t.Helper()
		for k, v := range j.Params {
			if _, isList := v.([]any); isList {
				t.Errorf("%s: job #%d's params carry the list %s", where, j.ID, k)
			}
		}
	}
	held := alice.mustStart("test.fill", map[string]any{"book_ids": []int64{1, 2, 3}, "movie_ids": []int64{4}})
	alice.waitJob(held.ID, "running")
	check := alice.mustStart("reverify", map[string]any{"book_ids": []int64{9}, "fills_only": true})
	noLists("POST /jobs", held)
	noLists("POST /jobs", check)
	noLists("GET /jobs/{id}", alice.job(held.ID))
	for _, j := range alice.jobs("view=current").Jobs {
		noLists("GET /jobs?view=current", j)
	}
	summary := decode[struct {
		Running wireJob `json:"running"`
	}](t, alice.mustDo("GET", "/jobs/summary", nil, http.StatusOK))
	noLists("GET /jobs/summary", summary.Running)
	// What the screens read of params is still there, and the size of a list is
	// the job's total.
	if held.Total != 4 || check.Params["fills_only"] != true {
		t.Fatalf("the fill's total %d and the check's params %v", held.Total, check.Params)
	}
	q.let()
	alice.waitJob(check.ID, "succeeded")

	// Run again, a job still runs over the lists it was given: a fill of Dune,
	// its year taken away after, fills it again.
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	fill := alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": []int64{dune}}).ID, "succeeded")
	year := func() int {
		return decode[struct {
			Year int `json:"published_year"`
		}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)).Year
	}
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "published_year": 0, "pages": 0}, http.StatusOK)
	if year() != 0 {
		t.Fatalf("Dune's year after it was taken away: %d", year())
	}
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", fill.ID), nil, http.StatusAccepted)).Job
	alice.waitJob(again.ID, "succeeded")
	if year() != 1965 {
		t.Fatalf("Dune's year after the fill ran again: %d, want it filled again", year())
	}
}

// contractKinds is the addendum's list of the kinds the screens have words for;
// a job of any other kind shows as "Job".
var contractKinds = []string{
	"fill", "covers", "people", "reverify", "reverify-apply", "backup", "backup.safety", "import", "import.approve", "restore",
	"reset", "update.check", "update.apply", "metadata.test", "notify.test", "notify.daily", "signin.oidc",
	"work.save", "person.save", "character.save", "request", "lookup.book", "lookup.movie", "lookup.images",
	"lookup.portrait", "lookup.links", "lookup.person", "lookup.reverify", "lookup.cast-image",
	"lookup.cast-imdb", "lookup.cast-tvdb", "lookup.cast-art",
}

func TestEveryKindTheServerKeepsAJobUnderIsOneTheScreensCanName(t *testing.T) {
	for pattern, kind := range jobKinds {
		if !slices.Contains(contractKinds, kind) {
			t.Errorf("%s is kept as %q, which no screen has words for", pattern, kind)
		}
	}
	for _, k := range builtinJobKinds {
		if !slices.Contains(contractKinds, k.name) {
			t.Errorf("the queued kind %q is not one the screens have words for", k.name)
		}
		if k.run == nil {
			t.Errorf("the queued kind %q has no run, so POST /jobs refuses it", k.name)
		}
	}
}
