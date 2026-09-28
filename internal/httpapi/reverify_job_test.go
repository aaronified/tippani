package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"strings"
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
// status, diffs, field, stored, fresh, alts), which are the contract the review
// is built to; and how much one job may keep (jobs.MaxResult), which one test
// fills with descriptions a supplier would never send, because what it guards is
// what happens at that size.
//
// What each one guards, in a sentence a person would say: a check asks about
// every work and person it was given, says in its log what differs on each, keeps
// its findings for the review, counts the items and those with something to
// review under the names the screens read, and writes nothing; asked for empty
// fields only, it keeps only the differences that would fill one; Stop ends it at
// once, keeping what it found before the item in hand and nothing of that one;
// and a check that
// finds more than one job can keep keeps what fits, says which items it left,
// and still opens its review, each diff whole — its fresh value as the preview
// gave it even where that is not quite the first supplier's.

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

// A Stop pressed while the second book is being looked up ends the check there:
// it keeps what it found on the first, and nothing on the second, whose lookup the
// Stop cut off — half an answer is not a finding.
func TestACheckJobStoppedWithAnItemInHandKeepsWhatItFoundBeforeIt(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	answer := srv.searchBooks
	asked := make(chan struct{}, 1)
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		if isbn == messiahISBN {
			asked <- struct{}{}
			<-ctx.Done() // the second book's supplier never answers
			return nil, ctx.Err()
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
		t.Fatal("the check never asked about the second book")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d items, want the one checked before the Stop", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"items": float64(1), "changes": float64(1)})
	if found := checkFindings(t, alice, job.ID); len(found) != 1 || found["Dune"] == "" {
		t.Fatalf("a check stopped on its second book kept %v", found)
	}
}

// A CHECK THAT FINDS MORE THAN ONE JOB CAN KEEP. Two suppliers answer for every
// book, each with a description the size of a novel, so each book's findings are
// about a third of what one job may keep. The check keeps the books whose
// findings fit, says in its log which it left, and ends succeeded with its
// review — rather than failing at the end with nothing kept. And the review
// reads each kept diff whole: the supplier's value the check did not store
// twice is back in fresh.
func TestACheckThatFindsMoreThanAJobCanKeepKeepsWhatFits(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	google, openLibrary := strings.Repeat("g", 1_500_000), strings.Repeat("o", 1_500_000)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{
			{Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn, Description: google},
			{Source: "openlibrary", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn, Description: openLibrary},
		}, nil
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	var ids []int64
	for i, isbn := range []string{duneISBN, messiahISBN, "9780441005901", "9780441017607"} {
		ids = append(ids, createdID(t, alice, "/books", map[string]any{"title": fmt.Sprintf("Book %d", i+1), "author": "Frank Herbert", "isbn": isbn}))
	}

	job := alice.waitJob(alice.mustStart("reverify", map[string]any{"book_ids": ids}).ID, "succeeded")
	if job.Done != 2 || job.Total != 4 {
		t.Fatalf("the check's progress: %d of %d, want the two whose findings fit", job.Done, job.Total)
	}
	countsAre(t, job, map[string]any{"items": float64(2), "changes": float64(2)})
	want := "warn the findings reached what one check can keep (8 MB), so the last 2 of its 4 items, from «Book 3» on, are not in them"
	if log := strings.Join(logOf(t, alice, job.ID), "\n"); !strings.Contains(log, want) {
		t.Errorf("the check's log has no %q:\n%s", want, log)
	}

	review := decode[struct {
		Result []struct {
			Title string `json:"title"`
			Diffs []struct {
				Field string `json:"field"`
				Fresh string `json:"fresh"`
				Alts  []struct {
					Source string `json:"source"`
					Value  string `json:"value"`
				} `json:"alts"`
			} `json:"diffs"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", job.ID), nil, http.StatusOK)).Result
	if len(review) != 2 || review[0].Title != "Book 1" || review[1].Title != "Book 2" {
		t.Fatalf("the review has %d items, want Book 1 and Book 2", len(review))
	}
	for _, it := range review {
		for _, d := range it.Diffs {
			if d.Field != "description" {
				continue
			}
			if d.Fresh != google || len(d.Alts) != 2 || d.Alts[0].Value != google || d.Alts[1].Value != openLibrary {
				t.Fatalf("%s's description in the review: fresh of %d bytes, %d alternatives; want Google's as fresh and both suppliers'",
					it.Title, len(d.Fresh), len(d.Alts))
			}
		}
	}
}

// FRESH IS NOT ALWAYS THE FIRST SUPPLIER'S VALUE TO THE LETTER. The preview trims
// the preferred supplier's text before offering it, and the alternatives carry
// each supplier's as sent — so a description with a stray space at its end is
// fresh without it and alts[0] with it. The check keeps both, and the review
// offers the trimmed one, as the preview did.
func TestACheckKeepsAFreshValueTheFirstSupplierSaidOtherwise(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{
			{Source: "google", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn, Description: "A desert planet. "},
			{Source: "openlibrary", Title: "Dune", Author: "Frank Herbert", ISBN13: isbn, Description: "Arrakis."},
		}, nil
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})

	job := alice.waitJob(alice.mustStart("reverify", map[string]any{"book_ids": []int64{dune}}).ID, "succeeded")
	review := decode[struct {
		Result []struct {
			Diffs []struct {
				Field string `json:"field"`
				Fresh string `json:"fresh"`
			} `json:"diffs"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", job.ID), nil, http.StatusOK)).Result
	if len(review) != 1 || len(review[0].Diffs) != 1 || review[0].Diffs[0].Fresh != "A desert planet." {
		t.Fatalf("the review of Dune: %+v, want its description offered as the preview offered it, trimmed", review)
	}
}
