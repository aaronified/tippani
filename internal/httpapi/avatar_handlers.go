package httpapi

import (
	"io"
	"net/http"

	"tippani/internal/metadata"
)

// maxAvatarBytes caps the decoded avatar image; maxAvatarUpload bounds the whole
// multipart envelope (a little larger, for the form boundary overhead). Avatars
// render tiny, but the owner asked for a generous 5 MB ceiling.
const (
	maxAvatarBytes  = 5 << 20
	maxAvatarUpload = 6 << 20
)

// handleUploadAvatar: POST /auth/me/avatar, multipart form (field "file"). The
// image is stored beside covers (MediaCover, server-generated hex name) and
// served through GET /covers/{file}; the users row points at it. Replaces (and
// deletes) any previous avatar. Returns {avatar_path}.
func (s *Server) handleUploadAvatar(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	var old string
	_ = s.Store.DB.QueryRow(`SELECT avatar_path FROM users WHERE id = ?`, uid).Scan(&old)

	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarUpload)
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field (max 5 MB image)")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return
	}
	name, err := metadata.StoreImageMax(data, s.coversDir(), maxAvatarBytes)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "that file isn't an accepted image (JPG/PNG/WebP/GIF, under 5 MB)")
		return
	}
	if _, err := s.Store.DB.Exec(`UPDATE users SET avatar_path = ? WHERE id = ?`, name, uid); err != nil {
		s.removeCoverFile(name)
		internalError(w, r, "update avatar path", err)
		return
	}
	if old != name {
		s.removeCoverFile(old)
	}
	writeJSON(w, http.StatusOK, map[string]any{"avatar_path": name})
}

// handleDeleteAvatar: DELETE /auth/me/avatar — clears the avatar and removes the
// stored file. The UI falls back to the username initial.
func (s *Server) handleDeleteAvatar(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	var old string
	_ = s.Store.DB.QueryRow(`SELECT avatar_path FROM users WHERE id = ?`, uid).Scan(&old)
	if _, err := s.Store.DB.Exec(`UPDATE users SET avatar_path = '' WHERE id = ?`, uid); err != nil {
		internalError(w, r, "clear avatar path", err)
		return
	}
	s.removeCoverFile(old)
	writeJSON(w, http.StatusOK, map[string]any{"avatar_path": ""})
}
