package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// A RE-VERIFY'S APPLY, WHEN THE LIBRARY MOVED BETWEEN THE REVIEW AND THE PRESS.
//
// The review shows each field as stored and what the suppliers say; the reader
// ticks and presses Apply, and the apply carries, per field, the stored value
// they were shown (expect). Everything is driven through the API as the review
// drives it, and the library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the apply's
// wire shape (items of {type, id | kind+name, set, source, expect}, answered with
// results of {ok, error, note}), which is the contract the review is built to;
// the words of the note an item whose field was left carries, which is what the
// review's result line shows the reader; for the job, the queue given to the
// server as serve() gives it (queueing, jobs_api_test.go), the book supplier's
// seam for the check the review decides on (srv.searchBooks), the picture
// download's seam held mid-answer so that Stop is pressed with an item in hand
// (srv.fetchImage), and the job's counts' names, which jobs.js reads.
//
// What each one guards, in a sentence a person would say: a field somebody
// changed after the review is left as they wrote it, with a note saying so, while
// the item's other fields are written; an item every field of which changed
// writes nothing and is not a failure; an item that says nothing about what it
// was shown is applied as it always was; a row that is gone is still not found;
// the review's Apply, as a job, does the same, says in its log what it wrote on
// each item, counts written, skipped and failed under the names the screens
// read, and marks the check it came from applied; and Stop ends it after the
// item in hand.

type applyAnswer struct {
	Applied int `json:"applied"`
	Failed  int `json:"failed"`
	Results []struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Note  string `json:"note"`
	} `json:"results"`
}

func TestAnApplyLeavesAFieldThatChangedSinceTheReview(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	messiah := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})
	gone := createdID(t, alice, "/books", map[string]any{"title": "Children of Dune", "author": "Frank Herbert"})
	emperor := createdID(t, alice, "/books", map[string]any{"title": "God Emperor of Dune", "author": "Frank Herbert"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert"}, http.StatusOK)

	// The review showed Dune and God Emperor with no description, Dune with no
	// year, and Frank Herbert with no bio. Then, before the press: alice writes
	// both descriptions and the author's bio herself, and deletes a book.
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "description": "My own words."}, http.StatusOK)
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", emperor), map[string]any{"title": "God Emperor of Dune",
		"author": "Frank Herbert", "description": "Leto's."}, http.StatusOK)
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Frank Herbert", "bio": "Wrote Dune."}, http.StatusOK)
	alice.mustDo("DELETE", fmt.Sprintf("/books/%d", gone), nil, http.StatusOK)

	got := decode[applyAnswer](t, alice.mustDo("POST", "/metadata/reverify/apply", map[string]any{"items": []any{
		map[string]any{"type": "book", "id": dune, "source": "google",
			"set":    map[string]any{"description": "A desert planet.", "published_year": 1965},
			"expect": map[string]any{"description": nil, "published_year": 0}},
		map[string]any{"type": "person", "kind": "author", "name": "Frank Herbert",
			"set": map[string]any{"bio": "An American author."}, "expect": map[string]any{"bio": ""}},
		// Sent by a client that says nothing about what it showed.
		map[string]any{"type": "book", "id": messiah, "source": "google", "set": map[string]any{"description": "The sequel."}},
		map[string]any{"type": "book", "id": gone, "source": "google",
			"set": map[string]any{"published_year": 1976}, "expect": map[string]any{"published_year": 0}},
		map[string]any{"type": "book", "id": emperor, "source": "google",
			"set": map[string]any{"description": "The fourth novel."}, "expect": map[string]any{"description": ""}},
	}}, http.StatusOK))

	if len(got.Results) != 5 || got.Applied != 4 || got.Failed != 1 {
		t.Fatalf("the apply: %+v", got)
	}
	left := changedSinceTheCheck
	if r := got.Results[0]; !r.OK || r.Note != left+"description" {
		t.Errorf("Dune's result: %+v, want ok with the note %q", r, left+"description")
	}
	if r := got.Results[1]; !r.OK || r.Note != left+"bio" {
		t.Errorf("the author's result: %+v, want ok (nothing failed) with the note %q", r, left+"bio")
	}
	if r := got.Results[2]; !r.OK || r.Note != "" {
		t.Errorf("an item sent without expect: %+v", r)
	}
	if r := got.Results[3]; r.OK || !strings.Contains(r.Error, "not found") {
		t.Errorf("a deleted book's result: %+v, want not found", r)
	}
	if r := got.Results[4]; !r.OK || r.Note != left+"description" {
		t.Errorf("God Emperor's result: %+v, want ok (nothing failed) with the note %q", r, left+"description")
	}

	type book struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)); b.Description != "My own words." || b.Year != 1965 {
		t.Errorf("Dune after the apply: %+v, want her own description kept and the year written", b)
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", messiah), nil, http.StatusOK)); b.Description != "The sequel." {
		t.Errorf("Dune Messiah after the apply: %+v", b)
	}
	if b := decode[book](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", emperor), nil, http.StatusOK)); b.Description != "Leto's." {
		t.Errorf("God Emperor after the apply: %+v, want her own description kept", b)
	}
	author := decode[struct {
		Bio string `json:"bio"`
	}](t, alice.mustDo("GET", "/people/id/"+itoa(recordID(t, alice, "Frank Herbert")), nil, http.StatusOK))
	if author.Bio != "Wrote Dune." {
		t.Errorf("the author's bio after the apply: %q, want hers", author.Bio)
	}
}

func TestAnApplyJobWritesWhatWasTickedAndMarksItsCheckApplied(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneAsTheSupplierHasIt(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	gone := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})
	check := alice.waitJob(alice.mustStart("reverify", map[string]any{"book_ids": []int64{dune, gone}}).ID, "succeeded")

	// The review, as the screen builds its Apply from it: every difference
	// ticked, the supplier's value to write and the stored value it showed.
	review := decode[struct {
		Result []struct {
			Type   string `json:"type"`
			ID     int64  `json:"id"`
			Source string `json:"source"`
			Diffs  []struct {
				Field  string          `json:"field"`
				Stored json.RawMessage `json:"stored"`
				Fresh  json.RawMessage `json:"fresh"`
			} `json:"diffs"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", check.ID), nil, http.StatusOK))
	var items []any
	for _, it := range review.Result {
		set, expect := map[string]json.RawMessage{}, map[string]json.RawMessage{}
		for _, d := range it.Diffs {
			set[d.Field], expect[d.Field] = d.Fresh, d.Stored
		}
		items = append(items, map[string]any{"type": it.Type, "id": it.ID, "source": it.Source, "set": set, "expect": expect})
	}
	// Before the press, alice writes Dune's description herself and deletes the
	// other book.
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "description": "My own words."}, http.StatusOK)
	alice.mustDo("DELETE", fmt.Sprintf("/books/%d", gone), nil, http.StatusOK)

	apply := alice.waitJob(alice.mustStart("reverify-apply", map[string]any{"items": items, "from_job": check.ID}).ID, "succeeded")
	countsAre(t, apply, map[string]any{"applied": float64(1), "skipped": float64(1), "failed": float64(1)})
	if apply.FromJob == nil || *apply.FromJob != check.ID || !alice.job(check.ID).Applied {
		t.Fatalf("the apply names check %v and the check reads applied %t; want #%d and true",
			apply.FromJob, alice.job(check.ID).Applied, check.ID)
	}
	log := strings.Join(logOf(t, alice, apply.ID), "\n")
	for _, want := range []string{
		"info «Dune» — wrote pages, year; " + changedSinceTheCheck + "description",
		fmt.Sprintf("warn book #%d — failed: not found", gone),
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the apply's log has no %q:\n%s", want, log)
		}
	}
	res := decode[struct {
		Result []struct {
			Type  string `json:"type"`
			ID    int64  `json:"id"`
			OK    bool   `json:"ok"`
			Error string `json:"error"`
			Note  string `json:"note"`
		} `json:"result"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", apply.ID), nil, http.StatusOK)).Result
	if len(res) != 2 || !res[0].OK || res[0].ID != dune || res[0].Note != changedSinceTheCheck+"description" ||
		res[1].OK || res[1].Error != "not found" {
		t.Fatalf("the apply's results, as the review reads them: %+v", res)
	}
	b := decode[struct {
		Description string `json:"description"`
		Year        int    `json:"published_year"`
		Pages       int    `json:"pages"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK))
	if b.Description != "My own words." || b.Year != 1965 || b.Pages != 412 {
		t.Fatalf("Dune after the apply: %+v, want her description kept and the year and pages written", b)
	}
}

func TestAnApplyJobStopsAfterTheItemInHand(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	var holding atomic.Bool
	holding.Store(true)
	asked, release := make(chan struct{}, 1), make(chan struct{})
	downloads(t, srv)
	download := srv.fetchImage
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		if holding.CompareAndSwap(true, false) {
			asked <- struct{}{}
			<-release // the first item's cover is slow to arrive
		}
		return download(ctx, rawURL, dir)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"})
	second := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert"})

	job := alice.mustStart("reverify-apply", map[string]any{"items": []any{
		map[string]any{"type": "book", "id": first, "source": "openlibrary",
			"set": map[string]any{"cover": "https://covers.openlibrary.org/b/id/1-L.jpg"}, "expect": map[string]any{"cover": ""}},
		map[string]any{"type": "book", "id": second, "source": "openlibrary",
			"set": map[string]any{"published_year": 1969}, "expect": map[string]any{"published_year": 0}},
	}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the apply never fetched the cover")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	close(release)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d items, want the one in hand", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"applied": float64(1), "skipped": float64(0), "failed": float64(0)})
	year := decode[struct {
		Year int `json:"published_year"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", second), nil, http.StatusOK)).Year
	cover := decode[struct {
		Cover string `json:"cover_path"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", first), nil, http.StatusOK)).Cover
	if cover == "" || year != 0 {
		t.Fatalf("after the stop: the first book's cover %q, the second's year %d; want the first written and the second untouched", cover, year)
	}
}
