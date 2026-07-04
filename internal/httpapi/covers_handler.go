package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

// coverFile matches server-generated cover/poster names (metadata.FetchImage:
// 16 lowercase hex chars + a sniffed image extension). Anything else 404s —
// no path traversal, nothing served that we didn't store ourselves.
var coverFile = regexp.MustCompile(`^[0-9a-f]{16}\.(jpg|png|webp|gif)$`)

// coversDir: all downloaded metadata images (covers + posters) live in
// <DataDir>/MediaCover — *arr-style (§9). serve() migrates a legacy covers/
// directory on startup.
func (s *Server) coversDir() string { return filepath.Join(s.DataDir, "MediaCover") }

func (s *Server) handleCover(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	if !coverFile.MatchString(name) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	path := filepath.Join(s.coversDir(), name)
	if _, err := os.Stat(path); err != nil {
		writeErr(w, http.StatusNotFound, "not found") // JSON 404, not ServeFile's plain text
		return
	}
	// Names are random and never reused: cache forever (PLAN §6).
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}

// removeCoverFile best-effort deletes a stored cover/poster (row delete, or
// cleanup when an insert loses to a duplicate). The name is validated first so
// a bad DB value can never point outside the MediaCover directory.
func (s *Server) removeCoverFile(name string) {
	if coverFile.MatchString(name) {
		_ = os.Remove(filepath.Join(s.coversDir(), name))
	}
}
