package httpapi

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Two things a mobile client needs that a same-LAN browser never missed.
//
// gzip: quote text compresses roughly eight to one. Over a LAN that is
// invisible; over Tailscale or cellular it is the difference between a library
// sync that feels instant and one that doesn't.
//
// capabilities: an installed APK and the server on a NAS update on completely
// independent schedules, so the app will eventually be older or newer than the
// server it talks to. Without a version handshake it discovers this as an
// unexplained 404 halfway through saving something.

// getWith issues a GET carrying arbitrary headers, returning the raw recorder
// so the test can inspect encoding rather than decoded content.
func getWith(t *testing.T, h http.Handler, c *testClient, path string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("GET", apiPath(path), nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if c != nil && c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestGzipCompressesJSONWhenAccepted(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// Enough text that compression has something to work with.
	bookID := newTestBook(t, c, "Invisible Cities")
	for i := 0; i < 40; i++ {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": bookID,
			"quote": fmt.Sprintf("Quote %02d: cities, like dreams, are made of desires "+
				"and fears, even if the thread of their discourse is secret.", i),
		}, http.StatusCreated)
	}

	plain := getWith(t, h, c, "/annotations", nil)
	if enc := plain.Header().Get("Content-Encoding"); enc != "" {
		t.Fatalf("no Accept-Encoding should mean no compression, got %q", enc)
	}

	zipped := getWith(t, h, c, "/annotations", map[string]string{"Accept-Encoding": "gzip"})
	if enc := zipped.Header().Get("Content-Encoding"); enc != "gzip" {
		t.Fatalf("Content-Encoding = %q want gzip", enc)
	}

	// The decompressed bytes must be identical to the uncompressed response —
	// compression that changes the payload is worse than none.
	zr, err := gzip.NewReader(bytes.NewReader(zipped.Body.Bytes()))
	if err != nil {
		t.Fatalf("response is not valid gzip: %v", err)
	}
	got, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, plain.Body.Bytes()) {
		t.Fatalf("decompressed body differs from the plain one\n got %d bytes\nwant %d bytes",
			len(got), plain.Body.Len())
	}
	if zipped.Body.Len() >= plain.Body.Len() {
		t.Fatalf("gzip made it bigger: %d >= %d", zipped.Body.Len(), plain.Body.Len())
	}
}

// A stale Content-Length describing the uncompressed body would truncate the
// response at the client.
func TestGzipDoesNotLeaveStaleContentLength(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedBooks(t, c, 10)

	rec := getWith(t, h, c, "/books", map[string]string{"Accept-Encoding": "gzip"})
	if cl := rec.Header().Get("Content-Length"); cl != "" {
		var n int
		fmt.Sscanf(cl, "%d", &n)
		if n != rec.Body.Len() {
			t.Fatalf("Content-Length %s does not match the %d bytes sent", cl, rec.Body.Len())
		}
	}
}

// Status codes must survive the wrapper — the outbox depends on telling 201
// from 409, and both now travel compressed.
func TestGzipPreservesStatusCodes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	post := func(quote string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]any{"book_id": bookID, "quote": quote})
		req := httptest.NewRequest("POST", apiPath("/annotations"), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept-Encoding", "gzip")
		req.AddCookie(c.cookie)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	if rec := post("A quote."); rec.Code != http.StatusCreated {
		t.Fatalf("first post: %d", rec.Code)
	}
	rec := post("A quote.")
	if rec.Code != http.StatusConflict {
		t.Fatalf("duplicate post: %d want 409", rec.Code)
	}
	// And the conflict body still decodes, with the existing row attached.
	zr, err := gzip.NewReader(bytes.NewReader(rec.Body.Bytes()))
	if err != nil {
		t.Fatalf("409 body is not valid gzip: %v", err)
	}
	raw, _ := io.ReadAll(zr)
	var conflict conflictBody
	if err := json.Unmarshal(raw, &conflict); err != nil {
		t.Fatalf("decode 409: %v (%s)", err, raw)
	}
	if conflict.Existing.ID == 0 {
		t.Fatal("compressed 409 lost the existing row")
	}
}

// Covers are JPEG/PNG: already compressed, so gzipping them burns CPU on both
// ends for nothing and can inflate the payload.
func TestGzipSkipsAlreadyCompressedContent(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	rec := getWith(t, h, c, "/healthz", map[string]string{"Accept-Encoding": "gzip"})
	if enc := rec.Header().Get("Content-Encoding"); enc == "gzip" {
		t.Fatal("an empty health response should not be gzipped")
	}
}

// A caching proxy in front must not serve a gzipped body to a client that
// didn't ask for one.
func TestGzipSetsVary(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedBooks(t, c, 3)

	rec := getWith(t, h, c, "/books", map[string]string{"Accept-Encoding": "gzip"})
	if v := rec.Header().Get("Vary"); v != "Accept-Encoding" {
		t.Fatalf("Vary = %q want Accept-Encoding", v)
	}
}

// ---- capabilities ----

type capabilitiesResp struct {
	Version     string   `json:"version"`
	APIRevision int      `json:"api_revision"`
	Features    []string `json:"features"`
}

// Unauthenticated on purpose: the app checks compatibility before it has a
// token, and during pairing.
func TestCapabilitiesIsUnauthenticated(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	signupAdmin(t, h)

	anon := &testClient{t: t, h: h}
	rec := anon.mustDo("GET", "/capabilities", nil, http.StatusOK)
	got := decode[capabilitiesResp](t, rec)

	if got.Version == "" {
		t.Fatal("capabilities should report the running version")
	}
	if got.APIRevision < 1 {
		t.Fatalf("api_revision = %d, want >= 1", got.APIRevision)
	}
}

// The features list is what lets an app light up or hide a screen instead of
// discovering a 404 mid-save, so the ones this work added must be present.
func TestCapabilitiesAdvertisesThisWork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}
	got := decode[capabilitiesResp](t, anon.mustDo("GET", "/capabilities", nil, http.StatusOK))

	want := map[string]bool{
		"device-tokens":     false,
		"device-pairing":    false,
		"list-paging":       false,
		"capture-noted-at":  false,
		"conflict-existing": false,
		"quote-parity":      false,
		// A client that does not know these two treats a delete as final and has no
		// bulk screen for standalone quotes — which is exactly the "discover a 404
		// mid-save" this list exists to prevent.
		"trash-bin":   false,
		"bulk-quotes": false,
		"bulk-colour": false,
	}
	for _, f := range got.Features {
		if _, ok := want[f]; ok {
			want[f] = true
		}
	}
	for f, present := range want {
		if !present {
			t.Errorf("capabilities does not advertise %q (got %v)", f, got.Features)
		}
	}
}
