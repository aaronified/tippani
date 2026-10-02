package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"tippani/internal/metadata"
)

// EVERY ASK A SUPPLIER ANSWERS IS ON ITS ROW. The owner chose "Every path", whose
// option read "… and every ask updates the row's last answer". A row's last
// answer moved only after a lookup, a picture search or a Test; a Rescan, a fill,
// Fetch missing or a person's links asked the same suppliers and left the row
// saying nothing had. These drive the API a reader's press drives and read the
// row back from GET /metadata/status.
//
// SETUP KNOWS the book search seam (srv.searchBooks), as the re-verify tests do:
// the offline test server has no supplier to ask; the TheTVDB, Letterboxd, IGDB
// and TMDB fakes other tests in this package use; and emptyRunFault, the length
// of run a fault needs, so the reader's lookups match it rather than a copy.

func rowLast(t *testing.T, c *testClient, source string) *sourceLast {
	t.Helper()
	return sourceNamed(t, decode[sourcesResp](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK)).Sources, source).Last
}

func TestARescansBookSearchIsOnBothSuppliersRows(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", ISBN13: isbn},
			{Source: "openlibrary", Title: "Dune", ISBN13: isbn}}, nil
	}
	c := signupAdmin(t, srv.Handler())
	b := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books", map[string]any{"title": "Dune", "isbn": "9780441013593"}, http.StatusCreated))
	for _, s := range []string{"google", "openlibrary"} {
		if last := rowLast(t, c, s); last != nil {
			t.Fatalf("%s's row has an answer before anything asked it: %+v", s, last)
		}
	}
	c.mustDo("POST", "/metadata/reverify", map[string]any{"book_ids": []int64{b.ID}}, http.StatusOK)
	for _, s := range []string{"google", "openlibrary"} {
		if last := rowLast(t, c, s); last == nil || !last.OK || last.Found != 1 {
			t.Errorf("after a Rescan, %s's row reads %+v, want answered with 1 found", s, last)
		}
	}
}

// A STOP IS NOT THE SUPPLIER'S ANSWER. A fill is stopped while its TheTVDB read
// is in flight, as a reader's press on Stop does, and TheTVDB's row must still
// say nothing has asked it, not that it failed.
func TestAStoppedAskLeavesTheRowAsItWas(t *testing.T) {
	srv := newTestServer(t)
	asked := make(chan struct{}, 1)
	tvdb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			_, _ = w.Write([]byte(`{"status":"success","data":{"token":"tok"}}`))
			return
		}
		select {
		case asked <- struct{}{}:
		default:
		}
		<-r.Context().Done()
	}))
	t.Cleanup(tvdb.Close)
	srv.TVDB = &metadata.TVDB{Key: "k", BaseURL: tvdb.URL}
	c := signupAdmin(t, srv.Handler())
	m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{"title": "The Matrix", "media_type": "movie", "tvdb_id": 70}, http.StatusOK)
	j := c.mustStart("fill", map[string]any{"movie_ids": []int64{m.ID}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the fill never asked TheTVDB")
	}
	c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", j.ID), nil, http.StatusOK)
	c.waitJob(j.ID, "stopped")
	if last := rowLast(t, c, "tvdb"); last != nil {
		t.Errorf("a Stop was recorded as TheTVDB's answer: %+v", last)
	}
}

// LETTERBOXD UNREACHED IS NOT LETTERBOXD ANSWERING. It is silent on every miss,
// an unreachable host included, so a fill that could not reach it must leave its
// row alone rather than write "answered, found nothing"; a page it returned is
// on the row.
func TestAnUnreachedLetterboxdIsNotRecordedAsAnswering(t *testing.T) {
	for _, reachable := range []bool{false, true} {
		srv := newTestServer(t)
		lb := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`<html><script type="application/ld+json">
				{"@type":"Movie","name":"The Matrix","description":"Letterboxd's synopsis."}
				</script></html>`))
		}))
		if !reachable {
			lb.Close()
		} else {
			t.Cleanup(lb.Close)
		}
		metadata.SetLetterboxdBaseForTest(t, lb.URL)
		srv.TVDB = newTVDBStub(t, `{"data":{"id":70,"name":"The Matrix","year":"1999","overview":"x","characters":[]}}`)
		c := signupAdmin(t, srv.Handler())
		m := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies", map[string]any{"title": "The Matrix", "media_type": "movie"}, http.StatusCreated))
		c.mustDo("PUT", "/movies/"+strconv.FormatInt(m.ID, 10), map[string]any{"title": "The Matrix", "media_type": "movie", "tvdb_id": 70}, http.StatusOK)
		c.mustDo("POST", "/metadata/reverify", map[string]any{"movie_ids": []int64{m.ID}}, http.StatusOK)
		last := rowLast(t, c, "letterboxd")
		switch {
		case !reachable && last != nil:
			t.Errorf("an unreachable Letterboxd is recorded as answering: %+v", last)
		case reachable && (last == nil || last.Found != 1):
			t.Errorf("a page Letterboxd returned is not on its row: %+v", last)
		}
	}
}

// A READER'S EMPTY ANSWERS ARE A RUN; A JOB'S WALK IS NOT. Every request carries
// a log of its own, so "is this a job" was answered yes for every request, and no
// reader's lookup that found nothing ever lengthened a supplier's run: three book
// searches with nothing in them raised no fault.
func TestAReadersEmptyAnswersStillRaiseAFault(t *testing.T) {
	srv := newTestServer(t)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}
	c := signupAdmin(t, srv.Handler())
	for i := 0; i < emptyRunFault; i++ {
		c.do("POST", "/books/lookup", map[string]any{"title": "A Book Nobody Has"})
	}
	st := decode[struct {
		Faults []faultRow `json:"faults"`
	}](t, c.mustDo("GET", "/metadata/status", nil, http.StatusOK))
	for _, f := range st.Faults {
		if f.Source == "google" && f.Kind == "empty" {
			return
		}
	}
	t.Errorf("%d empty book searches by a reader raised no fault: %+v", emptyRunFault, st.Faults)
}

// A PERSON SEARCH THAT FINDS NOBODY IS STILL AN ANSWER. An actor with no pinned
// id is looked up by name, and when TMDB had nobody of that name the search
// returned before anything was recorded, so the row went on saying nothing had
// asked it.
func TestATMDBPersonSearchThatFindsNobodyIsOnItsRow(t *testing.T) {
	srv := newTestServer(t)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"results":[]}`))
	}))
	t.Cleanup(fake.Close)
	srv.TMDB.Key = "testkey"
	srv.TMDB.BaseURL = fake.URL
	c := signupAdmin(t, srv.Handler())
	c.do("POST", "/people/portrait", map[string]any{"kind": "actor", "name": "Nobody Of This Name"})
	if last := rowLast(t, c, "tmdb"); last == nil || !last.OK || last.Found != 0 {
		t.Errorf("TMDB's empty person search is not on its row: %+v", last)
	}
}
