package httpapi

import (
	"database/sql"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// maxUploadBytes bounds the whole multipart envelope; the image itself is
// re-capped at 10 MB by metadata.StoreImage after decoding, so the envelope
// leaves headroom for multipart framing around a cap-sized image.
const maxUploadBytes = 12 << 20

// coverFile matches server-generated cover/poster/sticker names
// (metadata.FetchImage / StoreImage: 16 lowercase hex chars + a sniffed image
// extension). Anything else 404s — no path traversal, nothing served that we
// didn't store ourselves. svg is included for uploaded stickers.
var coverFile = regexp.MustCompile(`^[0-9a-f]{16}\.(jpg|png|webp|gif|svg)$`)

// coversDir: all downloaded metadata images (covers + posters) live in
// <DataDir>/MediaCover — *arr-style (§9). serve() migrates a legacy covers/
// directory on startup.
func (s *Server) coversDir() string { return filepath.Join(s.DataDir, "MediaCover") }

func (s *Server) handleCover(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	olog.Tracef("[cover] handleCover name=%v", name)
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
	// Uploaded SVG stickers are served with a hard sandbox so that even a direct
	// navigation to the file can't execute embedded script (upload also rejects
	// <script>, but this is the authoritative barrier). Fix the type explicitly
	// rather than trust the platform mime table.
	if strings.HasSuffix(name, ".svg") {
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	}
	http.ServeFile(w, r, path)
}

// handleUploadBookCover / handleUploadMoviePoster: POST /{books|movies}/{id}/cover
// multipart form (field "file") — the "upload from disk" cover source. Both
// funnel into uploadCover with the owning table/column.
func (s *Server) handleUploadBookCover(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[cover] handleUploadBookCover")
	s.uploadCover(w, r, "books", "cover_path")
}
func (s *Server) handleUploadMoviePoster(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[cover] handleUploadMoviePoster")
	s.uploadCover(w, r, "movies", "poster_path")
}

// uploadCover stores an uploaded image, points the row's cover column at it,
// and deletes the previously stored file. table/column are package constants,
// never client input, so the SQL interpolation is safe.
func (s *Server) uploadCover(w http.ResponseWriter, r *http.Request, table, column string) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	uid := userID(r)
	var old sql.NullString
	err := s.Store.DB.QueryRow(
		`SELECT `+column+` FROM `+table+` WHERE id = ? AND user_id = ?`, id, uid).Scan(&old)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "not found")
		return
	case err != nil:
		internalError(w, r, "load cover path", err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field (max 10 MB image)")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return
	}
	name, err := metadata.StoreImage(data, s.coversDir())
	if err != nil {
		writeErr(w, http.StatusBadRequest, "that file isn't an accepted image (JPG/PNG/WebP/GIF, under 10 MB)")
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE `+table+` SET `+column+` = ? WHERE id = ? AND user_id = ?`, name, id, uid); err != nil {
		s.removeCoverFile(name)
		internalError(w, r, "update cover", err)
		return
	}
	if old.String != name {
		s.removeCoverFile(old.String)
	}
	if table == "books" {
		b, err := s.fetchBook(uid, id)
		if err != nil {
			codedError(w, r, olog.CodeCoverFetch, "refetch cover", err)
			return
		}
		writeJSON(w, http.StatusOK, b)
		return
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		codedError(w, r, olog.CodeCoverFetch, "refetch cover", err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// removeCoverFile best-effort deletes a stored cover/poster (row delete, or
// cleanup when an insert loses to a duplicate). The name is validated first so
// a bad DB value can never point outside the MediaCover directory.
func (s *Server) removeCoverFile(name string) {
	if coverFile.MatchString(name) {
		_ = os.Remove(filepath.Join(s.coversDir(), name))
	}
}
