package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

// The service worker controls the whole site only from the root, and a cached
// copy of it would keep an old shell alive after an upgrade. The SPA handler is
// what serves it: any file at the top level of the build, with no-cache, and not
// the hashed /assets/ rule.
func TestServiceWorkerIsServedFromTheRootUncached(t *testing.T) {
	srv := newTestServer(t)
	srv.Static = fstest.MapFS{
		"index.html": {Data: []byte("<!doctype html>")},
		"sw.js":      {Data: []byte("self.addEventListener('fetch', () => {})")},
	}
	h := srv.Handler()

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sw.js", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /sw.js = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want no-cache", got)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Errorf("Content-Type = %q, want a JavaScript type", ct)
	}
	if !strings.Contains(rec.Body.String(), "addEventListener") {
		t.Errorf("body is not the worker: %q", rec.Body.String())
	}
}
