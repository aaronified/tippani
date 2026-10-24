package httpapi

import (
	"bytes"
	"encoding/json"
	"testing"
)

// Quote-image downloads: stage a PNG, then fetch it by token (session-free by
// design) — repeatably within its TTL, since a phone's DownloadManager may hit
// the URL more than once — and reject everything that isn't a PNG.
func TestShareImageDownload(t *testing.T) {
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

	// NOT single-use: a phone's DownloadManager can fetch the URL more than
	// once, so a second fetch within the TTL must still serve the PNG.
	rec3 := anon.doRaw("GET", got.URL, nil, "")
	if rec3.Code != 200 {
		t.Fatalf("second download: got %d, want 200", rec3.Code)
	}
	if !bytes.Equal(rec3.Body.Bytes(), png) {
		t.Fatalf("second download bytes differ: got %d, want %d", rec3.Body.Len(), len(png))
	}
}
