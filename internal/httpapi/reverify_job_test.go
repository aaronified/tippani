package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/metadata"
)

// A RE-VERIFY'S CHECK, AS A JOB: started as the review starts it
// (POST /jobs {kind: "reverify"}), its findings read back as the review reads
// them (GET /jobs/{id}/result), and the library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue
// is given to the server as serve() gives it (queueing, jobs_api_test.go); the
// suppliers are the server's seams (srv.searchBooks for books, srv.resolveAuthor
// for an author), because a test may not reach the real ones, and one test holds
// the book supplier mid-answer so that Stop is pressed with an item in hand; and
// the wire fields of a job, its counts and the preview's items (type, title,
// status, diffs, field, stored, fresh), which are the contract the review is
// built to.
//
// What each one guards, in a sentence a person would say: a check asks about
// every work and person it was given, says in its log what differs on each, keeps
// its findings for the review, counts the items and those with something to
// review under the names the screens read, and writes nothing; asked for empty
// fields only, it keeps only the differences that would fill one; and Stop ends
// it after the item in hand, keeping what it found up to there.

// duneAsTheSupplierHasIt is a book supplier that knows every ISBN as Dune with a
// description, a year and a page count.
func duneAsTheSupplierHasIt(srv *Server) {
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn,
			Description: "A desert planet.", PublishedYear: 1965, Pages: 412}}, nil
	}
}

type checkItem struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Diffs  []struct {
		Field string `json:"field"`
	} `json:"diffs"`
}

// checkFindings is a finished check's items as the review reads them, each as
// its title and the fields it found different.
func checkFindings(t *testing.T, c *testClient, id int64) map[string]string {
	t.Helper()
	res := decode[struct {
		Kind   string      `json:"kind"`
		Result []checkItem `json:"result"`
	}](t, c.mustDo("GET", fmt.Sprintf("/jobs/%d/result", id), nil, http.StatusOK))
	out := map[string]string{}
	for _, it := range res.Result {
		var fields []string
		for _, d := range it.Diffs {
			fields = append(fields, d.Field)
		}
		out[it.Title] = it.Status + " " + strings.Join(fields, ",")
	}
	return out
}

func TestACheckJobKeepsWhatDiffersForTheReviewAndWritesNothing(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	leGuinResolves(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN,
		"description": "My own words."})
	bare := createdID(t, alice, "/books", map[string]any{"title": "No ISBN", "author": "Someone"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	params := map[string]any{"book_ids": []int64{dune, bare},
		"people": []map[string]string{{"kind": "author", "name": "Ursula K. Le Guin"}}}

	job := alice.waitJob(alice.mustStart("reverify", params).ID, "succeeded")
	if job.Done != 3 || job.Total != 3 {
		t.Fatalf("the check's progress: %d of %d", job.Done, job.Total)
	}
	// Dune and Le Guin have something to review; the book with no ISBN does not.
	countsAre(t, job, map[string]any{"items": float64(3), "changes": float64(2)})
	found := checkFindings(t, alice, job.ID)
	if found["Dune"] != "ok description,published_year,pages" || found["No ISBN"] != "unpinned " ||
		!strings.HasPrefix(found["Ursula K. Le Guin"], "ok identity,") {
		t.Fatalf("the check's findings: %v", found)
	}
	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info «Dune» — 3 differences: description, year, pages",
		"info «No ISBN» — unpinned, so there is nothing to ask",
		"info «Ursula K. Le Guin» — ",
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the check's log has no %q:\n%s", want, log)
		}
	}

	// Asked for the empty fields only: the description the reader wrote is not
	// on offer to be overwritten, and the year and the page count still are.
	params["fills_only"] = true
	fills := alice.waitJob(alice.mustStart("reverify", params).ID, "succeeded")
	if got := checkFindings(t, alice, fills.ID)["Dune"]; got != "ok published_year,pages" {
		t.Fatalf("a fills-only check of Dune found %q, want its year and pages alone", got)
	}
	if log := strings.Join(logOf(t, alice, fills.ID), "\n"); !strings.Contains(log, "«Dune» — 2 differences: year, pages") {
		t.Errorf("the fills-only check's log:\n%s", log)
	}

	// A check writes nothing: that is the review's to decide.
	book := decode[struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK))
	if book.Description != "My own words." || book.Year != 0 {
		t.Fatalf("Dune after two checks: %+v", book)
	}
}

func TestACheckJobStopsAfterTheItemInHandAndKeepsWhatItFound(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	answer := srv.searchBooks
	var holding atomic.Bool
	holding.Store(true)
	asked, release := make(chan struct{}, 1), make(chan struct{})
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		if holding.CompareAndSwap(true, false) {
			asked <- struct{}{}
			<-release // the first book's lookup is slow
		}
		return answer(ctx, isbn, title, author, key)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	second := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})

	job := alice.mustStart("reverify", map[string]any{"book_ids": []int64{first, second}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the check never asked the supplier")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	close(release)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d items, want the one in hand", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"items": float64(1), "changes": float64(1)})
	if found := checkFindings(t, alice, job.ID); len(found) != 1 || found["Dune"] == "" {
		t.Fatalf("a check stopped after its first book kept %v", found)
	}
}
