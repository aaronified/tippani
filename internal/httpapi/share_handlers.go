package httpapi

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"time"
)

// One-shot quote-image downloads (§ share). Phones inside WebView wrappers
// (Native Alpha and kin) have no Web Share API, and their blob:-URL download
// bridges mangle both the filename (the blob UUID) and the bytes (base64
// bridge truncation). The panel POSTs the rendered PNG here and navigates to
// the returned one-shot URL instead — a real request that the wrapper's
// DownloadListener/DownloadManager handles natively, with the filename
// carried by Content-Disposition.
//
// The GET is deliberately session-free: Android's DownloadManager fetches
// outside the WebView's cookie jar. The token is the credential — 128-bit
// crypto-random, single-use, expiring in minutes, and the store is capped.

const (
	maxShareImage   = 12 << 20 // matches the cover upload cap
	shareTTL        = 3 * time.Minute
	maxShareEntries = 16
)

var pngHeader = []byte("\x89PNG\r\n\x1a\n")

type shareEntry struct {
	data    []byte
	expires time.Time
}

// handleShareImageUpload: POST /share/image, multipart form (field "file",
// PNG only). Returns {url} — a bare API path the client resolves via apiURL.
func (s *Server) handleShareImageUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxShareImage)
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field (max 12 MB PNG)")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return
	}
	// PNG only: the one-shot GET serves bytes without a session, so never
	// reflect arbitrary uploaded content — only what a canvas produced.
	if !bytes.HasPrefix(data, pngHeader) {
		writeErr(w, http.StatusBadRequest, "only PNG images can be staged for download")
		return
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		internalError(w, r, "share token", err)
		return
	}
	token := hex.EncodeToString(buf)

	now := time.Now()
	s.shareMu.Lock()
	if s.shareImages == nil {
		s.shareImages = map[string]shareEntry{}
	}
	for t, e := range s.shareImages {
		if now.After(e.expires) {
			delete(s.shareImages, t)
		}
	}
	// Cap the staging area: evict the entry closest to expiry rather than
	// refusing — the owner re-tapping Share must never dead-end.
	for len(s.shareImages) >= maxShareEntries {
		oldest, oldestExp := "", now.Add(shareTTL+time.Minute)
		for t, e := range s.shareImages {
			if e.expires.Before(oldestExp) {
				oldest, oldestExp = t, e.expires
			}
		}
		delete(s.shareImages, oldest)
	}
	s.shareImages[token] = shareEntry{data: data, expires: now.Add(shareTTL)}
	s.shareMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"url": "/share/image/" + token})
}

// handleShareImageDownload: GET /share/image/{token} — serves the staged PNG
// once (the entry is consumed even on a mid-flight token) and 404s otherwise.
func (s *Server) handleShareImageDownload(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	s.shareMu.Lock()
	e, ok := s.shareImages[token]
	delete(s.shareImages, token)
	s.shareMu.Unlock()
	if !ok || time.Now().After(e.expires) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Disposition", `attachment; filename="tippani-quote.png"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(e.data)
}
