package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
)

// One-shot quote-image downloads: stage a PNG, download it exactly once by
// token (session-free by design), and reject everything that isn't a PNG.
func TestShareImageOneShot(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	anon := &testClient{t: t, h: h} // no cookie — DownloadManager fetches outside the jar

	png := append(append([]byte{}, pngHeader...), []byte("fake png body")...)
	rec := c.importFile("/share/image", "tippani-quote.png", png)
	if rec.Code != 200 {
		t.Fatalf("stage: %d %s", rec.Code, rec.Body)
	}
	var got struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.URL == "" {
		t.Fatalf("no url in %s", rec.Body)
	}

	rec2 := anon.doRaw("GET", got.URL, nil, "")
	if rec2.Code != 200 {
		t.Fatalf("download: %d %s", rec2.Code, rec2.Body)
	}
	if ct := rec2.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type = %q", ct)
	}
	if cd := rec2.Header().Get("Content-Disposition"); cd != `attachment; filename="tippani-quote.png"` {
		t.Fatalf("content-disposition = %q", cd)
	}
	if !bytes.Equal(rec2.Body.Bytes(), png) {
		t.Fatalf("bytes differ: got %d bytes, want %d", rec2.Body.Len(), len(png))
	}

	// One-shot: the same token is gone.
	if rec3 := anon.doRaw("GET", got.URL, nil, ""); rec3.Code != http.StatusNotFound {
		t.Fatalf("second download: got %d, want 404", rec3.Code)
	}
}

func TestShareImageValidation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	anon := &testClient{t: t, h: h}

	// Not a PNG → 400 (the one-shot GET is session-free, so nothing that a
	// canvas didn't produce may be staged).
	if rec := c.importFile("/share/image", "x.txt", []byte("plain text")); rec.Code != http.StatusBadRequest {
		t.Fatalf("non-png: got %d, want 400", rec.Code)
	}

	// Anonymous staging is rejected.
	if rec := anon.importFile("/share/image", "q.png", pngHeader); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anon stage: got %d, want 401", rec.Code)
	}

	// Unknown token → 404.
	if rec := anon.doRaw("GET", "/share/image/deadbeefdeadbeefdeadbeefdeadbeef", nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("bogus token: got %d, want 404", rec.Code)
	}
}
