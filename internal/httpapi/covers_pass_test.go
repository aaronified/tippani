package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/metadata"
)

// THE COVERS PASS, OVER A LIBRARY MADE THROUGH THE APP.
//
// Books are added as a reader adds them (POST /books) and films as the add-from-
// a-supplier path adds them (POST /movies {tmdb_id}), which is what caches the
// supplier's payload a covers pass reads its poster address from. The pass is
// driven as Metadata drives it: the chunked route, or the covers job.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the
// suppliers are the server's own seams — TMDB (srv.TMDB, pointed at a stub of its
// /movie/{id} answer), the book search (srv.searchBooks) and the picture download
// (srv.fetchImage) — because a test may not reach the real ones, and the tests
// that press Stop hold one of them mid-answer, as a slow supplier would, so that
// a work is in hand; Pushover is a stub of its API (newFakePushover); the queue
// is given to the server as serve() gives it (queueing, jobs_api_test.go); and
// the chunked route's answer names (next_cursor, total, remaining) and the job's
// counts' names, which are the contracts with the screens that draw them (the
// SPA's jobs.js reads counts by those names).
//
// What each one guards, in a sentence a person would say: a pass that has walked
// every book still counts the films it has not reached; a covers job fetches what
// is missing, says what it did to each work, and counts fetched, enriched,
// failed and skipped under the names the screens read, the reader's own library
// only; Stop ends it after the work in hand; and a long one tells the phone when
// it reaches its end, not when it is stopped.

// filmsTMDB answers TMDB's /movie/{id} for any id, each film with a poster.
func filmsTMDB(t *testing.T, srv *Server) {
	t.Helper()
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var id int
		if _, err := fmt.Sscanf(r.URL.Path, "/movie/%d", &id); err != nil {
			http.NotFound(w, r)
			return
		}
		_, _ = fmt.Fprintf(w, `{"id":%d,"title":"Film %d","poster_path":"/p%d.jpg","release_date":"2001-01-01"}`, id, id, id)
	}))
	t.Cleanup(stub.Close)
	srv.TMDB.Key = "test-key"
	srv.TMDB.BaseURL = stub.URL
}

// coversLibrary gives c books and films with no cover or poster: the films'
// posters fail to download when they are added, as a supplier's image host
// sometimes does, so each is left for a covers pass to fetch. From then on every
// download works; the count of them is returned.
func coversLibrary(t *testing.T, srv *Server, c *testClient, books []string, films []int) *atomic.Int64 {
	t.Helper()
	filmsTMDB(t, srv)
	srv.searchBooks = func(context.Context, string, string, string, string) ([]metadata.BookCandidate, error) {
		return nil, nil
	}
	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "", errors.New("the image host is not answering")
	}
	for _, title := range books {
		c.mustDo("POST", "/books", map[string]any{"title": title, "author": "Someone"}, http.StatusCreated)
	}
	for _, id := range films {
		c.mustDo("POST", "/movies", map[string]any{"tmdb_id": id}, http.StatusCreated)
	}
	var n atomic.Int64
	srv.fetchImage = func(_ context.Context, rawURL, _ string) (string, error) {
		if !strings.Contains(rawURL, "image.tmdb.org") {
			return "", errors.New("no such picture")
		}
		return fmt.Sprintf("%016x.jpg", n.Add(1)), nil
	}
	return &n
}

func TestACoversPassThatHasWalkedEveryBookStillCountsTheFilmsAhead(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	// Three books and one film: the film's row is numbered 1 and the last book's
	// 3, which is the library in which the pass lost count.
	coversLibrary(t, srv, admin, []string{"One", "Two", "Three"}, []int{603})

	first := decode[refetchResp](t, admin.mustDo("POST", "/covers/refetch", map[string]any{}, http.StatusOK))
	if first.Total != 4 || first.NextCursor != "movies:0" || first.Remaining != 1 {
		t.Fatalf("after every book: %+v, want the one film still to come of four", first)
	}
	last := decode[refetchResp](t, admin.mustDo("POST", "/covers/refetch", map[string]any{"cursor": first.NextCursor}, http.StatusOK))
	if !last.Done || last.Remaining != 0 || last.Fetched != 1 {
		t.Fatalf("after the film: %+v, want done with its poster fetched", last)
	}
}

func TestACoversJobFetchesWhatIsMissingAndSaysWhatItDidToEachWork(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	bob.mustDo("POST", "/books", map[string]any{"title": "Bob's own", "author": "Someone"}, http.StatusCreated)
	fetched := coversLibrary(t, srv, admin, []string{"Only a title"}, []int{603, 604})
	withISBN := createdID(t, admin, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})

	job := admin.waitJob(admin.mustStart("covers", map[string]any{"missing_only": true}).ID, "succeeded")
	if job.Done != 4 || job.Total != 4 {
		t.Fatalf("the covers pass walked %d of %d, want the admin's 4 works", job.Done, job.Total)
	}
	// Two posters; Dune's cover was asked for at every address an ISBN gives and
	// none answered; a book with only a title had nowhere to look.
	countsAre(t, job, map[string]any{"fetched": float64(2), "enriched": float64(0), "failed": float64(1), "skipped": float64(1)})
	if fetched.Load() != 2 {
		t.Fatalf("%d pictures downloaded, want the two posters", fetched.Load())
	}

	log := strings.Join(logOf(t, admin, job.ID), "\n")
	for _, want := range []string{
		"info «Only a title» — no cover to look for",
		"warn «Dune» — no cover could be fetched (2 places tried)",
		"info «Film 603» — poster fetched",
		"info «Film 604» — poster fetched",
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the covers pass's log has no %q:\n%s", want, log)
		}
	}
	if strings.Contains(log, "Bob's own") {
		t.Errorf("the admin's pass walked bob's library:\n%s", log)
	}
	for _, film := range filmsOf(t, admin) {
		if film.Poster == "" {
			t.Errorf("%s has no poster after the pass", film.Title)
		}
	}
	if b := decode[struct {
		Cover string `json:"cover_path"`
	}](t, admin.mustDo("GET", fmt.Sprintf("/books/%d", withISBN), nil, http.StatusOK)); b.Cover != "" {
		t.Errorf("Dune has a cover none of its addresses gave: %q", b.Cover)
	}
}

type filmRow struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Poster string `json:"poster_path"`
}

// filmsOf is the reader's films as their Films shelf lists them.
func filmsOf(t *testing.T, c *testClient) []filmRow {
	t.Helper()
	return decode[struct {
		Movies []filmRow `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, http.StatusOK)).Movies
}

func TestACoversJobStopsAfterTheWorkInHand(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	coversLibrary(t, srv, admin, nil, []int{603, 604})
	download := srv.fetchImage
	asked, release := make(chan struct{}, 1), make(chan struct{})
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		select {
		case asked <- struct{}{}:
			<-release // the first poster is slow to arrive
		default:
		}
		return download(ctx, rawURL, dir)
	}

	job := admin.mustStart("covers", map[string]any{"missing_only": true})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the covers pass never asked for a poster")
	}
	admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	close(release)
	stopped := admin.waitJob(job.ID, "stopped")
	if stopped.Done != 1 || stopped.Total != 2 {
		t.Fatalf("stopped at %d of %d, want after the film in hand", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"fetched": float64(1), "enriched": float64(0), "failed": float64(0), "skipped": float64(0)})
	posters := map[string]bool{}
	for _, f := range filmsOf(t, admin) {
		posters[f.Title] = f.Poster != ""
	}
	if !posters["Film 603"] || posters["Film 604"] {
		t.Fatalf("posters after the stop: %v, want the first film's and not the second's", posters)
	}
}

func TestALongCoversJobTellsThePhoneWhenItReachesItsEnd(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	push := newFakePushover(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, http.StatusOK)
	var titles []string
	for i := 0; i < notifyFetchMin; i++ {
		titles = append(titles, fmt.Sprintf("Book %02d", i))
	}
	coversLibrary(t, srv, admin, titles, nil)
	search := srv.searchBooks
	var holding atomic.Bool
	holding.Store(true)
	asked, hold := make(chan struct{}, 1), make(chan struct{})
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		if holding.Load() {
			asked <- struct{}{}
			<-hold
		}
		return search(ctx, isbn, title, author, key)
	}

	cut := admin.mustStart("covers", map[string]any{"missing_only": true})
	<-asked
	admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", cut.ID), nil, http.StatusOK)
	holding.Store(false)
	close(hold)
	admin.waitJob(cut.ID, "stopped")
	if msgs := push.sent(); len(msgs) != 0 {
		t.Fatalf("a stopped covers pass sent %+v", msgs)
	}

	admin.waitJob(admin.mustStart("covers", map[string]any{"missing_only": true}).ID, "succeeded")
	msgs := push.sent()
	want := fmt.Sprintf("Covers and details checked for %d works.", notifyFetchMin)
	if len(msgs) != 1 || msgs[0]["title"] != "Metadata fetch finished" || msgs[0]["message"] != want {
		t.Fatalf("a covers pass over %d works sent %+v, want one saying %q", notifyFetchMin, msgs, want)
	}
}
