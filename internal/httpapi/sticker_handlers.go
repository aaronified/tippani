package httpapi

import (
	"database/sql"
	"errors"
	"io"
	"net/http"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// Stickers are a user's library of uploaded transparent images (PNG/SVG/…),
// managed on the Tags page and attachable one-per-annotation/dialogue (the
// real sticker feature — see migration 0011). Files reuse the MediaCover store
// and the cover serve route; only the DB shape is new here.

// maxStickerUpload bounds the whole multipart envelope; the image itself is
// re-capped inside metadata.StoreImage.
const maxStickerUpload = 3 << 20

// stickerRow is the GET/POST/PUT /stickers response shape. annotations/dialogues
// are usage counts across the two reference columns (mirrors tagRow).
type stickerRow struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Path        string `json:"path"` // filename under MediaCover/, served via /covers/{file}
	Annotations int    `json:"annotations"`
	Dialogues   int    `json:"dialogues"`
}

const stickerSelect = `
	SELECT s.id, s.name, s.path,
	       (SELECT count(*) FROM annotations a WHERE a.sticker_id = s.id),
	       (SELECT count(*) FROM dialogues d WHERE d.sticker_id = s.id)
	FROM stickers s`

func (s *Server) fetchSticker(uid, id int64) (*stickerRow, error) {
	var st stickerRow
	err := s.Store.DB.QueryRow(stickerSelect+` WHERE s.id = ? AND s.user_id = ?`, id, uid).
		Scan(&st.ID, &st.Name, &st.Path, &st.Annotations, &st.Dialogues)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// stickerOwned reports whether id is nil (no sticker) or names a sticker owned
// by uid. Guards annotation/dialogue writes against attaching another user's
// sticker by guessing its integer id (the FK alone isn't user-scoped).
func (s *Server) stickerOwned(uid int64, id *int64) bool {
	if id == nil {
		return true
	}
	var ok bool
	err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM stickers WHERE id = ? AND user_id = ?)`, *id, uid).Scan(&ok)
	return err == nil && ok
}

func (s *Server) handleListStickers(w http.ResponseWriter, r *http.Request) {
	olog.Tracef("[sticker] handleListStickers uid=%v", userID(r))
	rows, err := s.Store.DB.Query(stickerSelect+` WHERE s.user_id = ? ORDER BY s.created_at DESC, s.id DESC`, userID(r))
	if err != nil {
		internalError(w, r, "list stickers", err)
		return
	}
	defer rows.Close()
	stickers := []stickerRow{}
	for rows.Next() {
		var st stickerRow
		if err := rows.Scan(&st.ID, &st.Name, &st.Path, &st.Annotations, &st.Dialogues); err != nil {
			olog.Warnf(olog.CodeStickerRowScan, "[sticker] list stickers row scan failed: %v", err)
			continue
		}
		stickers = append(stickers, st)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeStickerRowScan, "[sticker] list stickers row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"stickers": stickers})
}

// handleUploadSticker: POST /stickers, multipart form with a "file" image and
// an optional "name". Stores the image and inserts a sticker row.
func (s *Server) handleUploadSticker(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[sticker] handleUploadSticker uid=%v", uid)
	r.Body = http.MaxBytesReader(w, r.Body, maxStickerUpload)
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "expected a multipart form with a 'file' field (max 3 MB image)")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large or malformed")
		return
	}
	stored, err := metadata.StoreImage(data, s.coversDir())
	if err != nil {
		writeErr(w, http.StatusBadRequest, "that file isn't an accepted image (PNG/SVG/JPG/WebP/GIF, under 2 MB, no scripts)")
		return
	}
	name := cleanTagName(r.FormValue("name")) // reuse the 64-rune trim/cap rule
	res, err := s.Store.DB.Exec(
		`INSERT INTO stickers (user_id, name, path) VALUES (?, ?, ?)`, uid, name, stored)
	if err != nil {
		s.removeCoverFile(stored)
		internalError(w, r, "insert sticker", err)
		return
	}
	id, _ := res.LastInsertId()
	st, err := s.fetchSticker(uid, id)
	if err != nil {
		internalError(w, r, "fetch sticker", err)
		return
	}
	writeJSON(w, http.StatusCreated, st)
}

// handleUpdateSticker renames a sticker (PUT /stickers/{id}, JSON {name}).
func (s *Server) handleUpdateSticker(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid sticker id")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	olog.Tracef("[sticker] handleUpdateSticker uid=%v id=%v", uid, id)
	res, err := s.Store.DB.Exec(
		`UPDATE stickers SET name = ? WHERE id = ? AND user_id = ?`, cleanTagName(req.Name), id, uid)
	if err != nil {
		internalError(w, r, "update sticker", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "sticker not found")
		return
	}
	st, err := s.fetchSticker(uid, id)
	if err != nil {
		internalError(w, r, "fetch sticker", err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// handleDeleteSticker removes a sticker and its file. annotations.sticker_id /
// dialogues.sticker_id clear to NULL via ON DELETE SET NULL (0011), so the
// quotes that used it just lose the seal.
func (s *Server) handleDeleteSticker(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid sticker id")
		return
	}
	uid := userID(r)
	olog.Tracef("[sticker] handleDeleteSticker uid=%v id=%v", uid, id)
	var path string
	err := s.Store.DB.QueryRow(`SELECT path FROM stickers WHERE id = ? AND user_id = ?`, id, uid).Scan(&path)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "sticker not found")
		return
	case err != nil:
		internalError(w, r, "delete sticker", err)
		return
	}
	if _, err := s.Store.DB.Exec(`DELETE FROM stickers WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete sticker", err)
		return
	}
	s.removeCoverFile(path)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
