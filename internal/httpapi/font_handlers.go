package httpapi

// Bring your own font.
//
// Settings → Type offers three bundled faces per role; this is the fourth
// option. One multipart upload, one row, one file beside the covers.
//
// THE SERVER STORES BYTES AND NEVER PARSES THEM. It checks the first four bytes
// against the four font-container magics and writes the rest verbatim. Font
// parsers are a famously bad attack surface and the dependency budget here is
// three direct Go modules; the only thing that needs to read this file is the
// browser that asked for it, which has a hardened parser and is going to run it
// whatever this package concludes.
//
// FORMAT BY MAGIC BYTES, NOT BY EXTENSION, which is the whole reason the check
// exists at all. A .woff2 that is really a ZIP is exactly the case an extension
// test misses, and the browser would refuse it later with nothing on screen to
// say why.
//
// THE SCRIPT CHECK IS NOT HERE. "A verifier will verify if the language / script
// is the same" was asked for, and it runs in the BROWSER, by measurement — see
// fontVerify in fonts.js. Doing it here would mean reaching the cmap table, and
// woff2 is Brotli-compressed, so that means a font parser and a decompressor for
// a check whose answer is advisory either way.

import (
	"bytes"
	"database/sql"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"crypto/rand"

	"tippani/internal/olog"
)

// maxFontUpload — generous, on purpose. A CJK font with a full glyph set is
// genuinely several megabytes, and refusing somebody's Devanagari face because
// it is bigger than a sticker would be the cap doing the opposite of its job.
// It is still a cap: this is one row and one file per press of a button.
const maxFontUpload = 12 << 20

// fontMagics maps the four container signatures to the format name and the
// media type the file is later served with. TrueType's is a version number
// rather than a word, which is why this is a table of bytes and not of strings.
var fontMagics = []struct {
	magic  []byte
	format string
	mime   string
}{
	{[]byte("wOF2"), "woff2", "font/woff2"},
	{[]byte("wOFF"), "woff", "font/woff"},
	{[]byte("OTTO"), "otf", "font/otf"},
	{[]byte{0x00, 0x01, 0x00, 0x00}, "ttf", "font/ttf"},
	{[]byte("true"), "ttf", "font/ttf"}, // the older Apple TrueType tag
	{[]byte("ttcf"), "ttf", "font/collection"},
}

func fontFormat(data []byte) (format, mime string, ok bool) {
	if len(data) < 4 {
		return "", "", false
	}
	for _, m := range fontMagics {
		if bytes.HasPrefix(data, m.magic) {
			return m.format, m.mime, true
		}
	}
	return "", "", false
}

// fontMime answers what to serve a stored format as. Unknown formats cannot
// exist — the upload refused them — but a row written by a future version
// should not be served as something the browser will execute.
func fontMime(format string) string {
	for _, m := range fontMagics {
		if m.format == format {
			return m.mime
		}
	}
	return "application/octet-stream"
}

// fontName cleans the name shown in the picker. It comes from the FILENAME,
// because a font's real family name lives inside the file and reading it would
// mean parsing one.
func fontName(filename string) string {
	base := filepath.Base(strings.TrimSpace(filename))
	base = strings.TrimSuffix(base, filepath.Ext(base))
	base = strings.NewReplacer("-", " ", "_", " ").Replace(base)
	base = strings.Join(strings.Fields(base), " ")
	if base == "" {
		return "Uploaded font"
	}
	if r := []rune(base); len(r) > 48 {
		base = string(r[:48])
	}
	return base
}

type fontRow struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Format    string `json:"format"`
	CreatedAt string `json:"created_at"`
	// Token is what a preference stores, composed here so no client has to know
	// how the two halves are joined. `upload:12`.
	Token string `json:"token"`
}

func (s *Server) fontsDir() string { return s.coversDir() }

// storeFontFile writes the bytes under a random name, the same shape covers and
// stickers use. The name carries the format so the file is self-describing on
// disk, which matters the one time somebody is looking at a backup by hand.
func (s *Server) storeFontFile(data []byte, format string) (string, error) {
	if err := os.MkdirAll(s.fontsDir(), 0o755); err != nil {
		return "", err
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	name := "font-" + hex.EncodeToString(b[:]) + "." + format
	if err := os.WriteFile(filepath.Join(s.fontsDir(), name), data, 0o644); err != nil {
		return "", err
	}
	return name, nil
}

// handleUploadFont: POST /fonts, multipart with a "file".
func (s *Server) handleUploadFont(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[font] handleUploadFont uid=%v", uid)
	r.Body = http.MaxBytesReader(w, r.Body, maxFontUpload)
	f, hdr, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field (max 12 MB font)")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return
	}
	format, _, ok := fontFormat(data)
	if !ok {
		// Names the four containers rather than the four extensions, because the
		// check is on the bytes and a renamed file is the case it exists for.
		writeErr(w, http.StatusBadRequest, "that file isn't a font (expected WOFF2, WOFF, OpenType or TrueType)")
		return
	}
	stored, err := s.storeFontFile(data, format)
	if err != nil {
		internalError(w, r, "store font", err)
		return
	}
	name := fontName(hdr.Filename)
	res, err := s.Store.DB.Exec(
		`INSERT INTO user_fonts (user_id, name, path, format) VALUES (?, ?, ?, ?)`, uid, name, stored, format)
	if err != nil {
		_ = os.Remove(filepath.Join(s.fontsDir(), stored))
		internalError(w, r, "insert font", err)
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, fontRow{ID: id, Name: name, Format: format, Token: fontToken(id)})
}

func fontToken(id int64) string { return "upload:" + strconv.FormatInt(id, 10) }

// handleListFonts: GET /fonts.
func (s *Server) handleListFonts(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	rows, err := s.Store.DB.Query(
		`SELECT id, name, format, created_at FROM user_fonts WHERE user_id = ? ORDER BY id`, uid)
	if err != nil {
		internalError(w, r, "list fonts", err)
		return
	}
	defer rows.Close()
	out := []fontRow{}
	for rows.Next() {
		var f fontRow
		if err := rows.Scan(&f.ID, &f.Name, &f.Format, &f.CreatedAt); err != nil {
			internalError(w, r, "scan font", err)
			return
		}
		f.Token = fontToken(f.ID)
		out = append(out, f)
	}
	writeJSON(w, http.StatusOK, map[string]any{"fonts": out})
}

// handleFontFile: GET /fonts/{id}/file — the bytes, for @font-face.
//
// AUTHENTICATED like every other route, and scoped to the owner: a font is a
// file somebody uploaded to their own account, and serving it to anyone with the
// id would make this the one endpoint that leaks across accounts.
func (s *Server) handleFontFile(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid font id")
		return
	}
	uid := userID(r)
	var path, format string
	err := s.Store.DB.QueryRow(
		`SELECT path, format FROM user_fonts WHERE id = ? AND user_id = ?`, id, uid).Scan(&path, &format)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "font not found")
		return
	case err != nil:
		internalError(w, r, "load font", err)
		return
	}
	full := filepath.Join(s.fontsDir(), filepath.Base(path))
	data, err := os.ReadFile(full)
	if err != nil {
		writeErr(w, http.StatusNotFound, "font not found")
		return
	}
	w.Header().Set("Content-Type", fontMime(format))
	// Immutable: the bytes behind an id never change — an edit is a new upload.
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	// The one header that matters here. A font is served to be parsed by the
	// browser's font engine and by nothing else; without this a crafted file
	// could be re-interpreted as something a sniffer likes better.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(data)
}

// handleDeleteFont: DELETE /fonts/{id}.
//
// A PREFERENCE STILL POINTING AT IT IS NOT AN ERROR, and nothing is rewritten.
// The client falls back to the built-in for any token it cannot resolve — the
// same rule that covers a typo, an older client and a newer one — so a deleted
// font shows as the default rather than as nothing. Chasing twelve preference
// fields across every user would be a write to fix a case the read already
// handles.
func (s *Server) handleDeleteFont(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid font id")
		return
	}
	uid := userID(r)
	var path string
	err := s.Store.DB.QueryRow(
		`SELECT path FROM user_fonts WHERE id = ? AND user_id = ?`, id, uid).Scan(&path)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "font not found")
		return
	case err != nil:
		internalError(w, r, "load font", err)
		return
	}
	if _, err := s.Store.DB.Exec(`DELETE FROM user_fonts WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete font", err)
		return
	}
	// The row is gone; a leftover file is untidy, not broken.
	_ = os.Remove(filepath.Join(s.fontsDir(), filepath.Base(path)))
	w.WriteHeader(http.StatusNoContent)
}
