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
// (srv.fetchImage) — because a test may not reach the real ones; and the chunked
// route's answer names (next_cursor, total, remaining), which are the route's
// contract with the screen that draws its progress bar.
//
// What each one guards, in a sentence a person would say: a pass that has walked
// every book still counts the films it has not reached.

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
