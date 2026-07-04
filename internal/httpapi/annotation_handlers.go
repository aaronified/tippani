package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/store"
)

func validColor(c string) bool {
	switch c {
	case "yellow", "blue", "pink", "orange":
		return true
	}
	return false
}

type annotationReq struct {
	BookID   int64    `json:"book_id"`
	Quote    string   `json:"quote"`
	Note     string   `json:"note"`
	Color    string   `json:"color"`
	Chapter  string   `json:"chapter"`
	Location string   `json:"location"`
	Tags     []string `json:"tags"`
	Favorite bool     `json:"favorite"`
	Rating   int      `json:"rating"` // 0 = unrated, else 1-5 (PLAN §3)
}

func (a *annotationReq) validate() string {
	a.Quote = strings.TrimSpace(a.Quote)
	a.Note = strings.TrimSpace(a.Note)
	if a.Quote == "" && a.Note == "" {
		return "quote or note is required"
	}
	if a.Color == "" {
		a.Color = "yellow" // PLAN §3: colours fixed at 4, default yellow
	}
	if !validColor(a.Color) {
		return "color must be yellow, blue, pink or orange"
	}
	if a.Rating < 0 || a.Rating > 5 {
		return "rating must be between 0 and 5"
	}
	var ok bool
	if a.Chapter, ok = trimCap(a.Chapter, 128); !ok {
		return "chapter too long (max 128 characters)"
	}
	if a.Location, ok = trimCap(a.Location, 128); !ok {
		return "location too long (max 128 characters)"
	}
	return ""
}

// favoriteRatingFilters appends the PLAN §3 favorite=1 / min_rating=N list
// filters (shared by annotations and dialogues) for the given table alias.
// Writes a 400 and returns false on a bad value.
func favoriteRatingFilters(w http.ResponseWriter, r *http.Request, alias string, q *string, args *[]any) bool {
	if v := r.URL.Query().Get("favorite"); v != "" {
		if v != "1" {
			writeErr(w, http.StatusBadRequest, "favorite filter must be 1")
			return false
		}
		*q += ` AND ` + alias + `.favorite = 1`
	}
	if v := r.URL.Query().Get("min_rating"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 5 {
			writeErr(w, http.StatusBadRequest, "min_rating must be between 1 and 5")
			return false
		}
		*q += ` AND ` + alias + `.rating >= ?`
		*args = append(*args, n)
	}
	return true
}

// hash implements the PLAN §3 dedupe rule: the quote, or the note for
// note-only annotations. Location deliberately excluded.
func (a *annotationReq) hash() string {
	if a.Quote != "" {
		return store.DedupeHash(a.Quote)
	}
	return store.DedupeHash(a.Note)
}

type annotationRow struct {
	ID        int64    `json:"id"`
	BookID    int64    `json:"book_id"`
	Quote     string   `json:"quote"`
	Note      string   `json:"note"`
	Color     string   `json:"color"`
	Chapter   string   `json:"chapter"`
	Location  string   `json:"location"`
	Favorite  bool     `json:"favorite"`
	Rating    int      `json:"rating"`
	Tags      []string `json:"tags"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

func (s *Server) fetchAnnotation(uid, id int64) (*annotationRow, error) {
	var a annotationRow
	err := s.Store.DB.QueryRow(`
		SELECT a.id, a.book_id, COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite, a.rating,
		       a.created_at, a.updated_at
		FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).
		Scan(&a.ID, &a.BookID, &a.Quote, &a.Note, &a.Color,
			&a.Chapter, &a.Location, &a.Favorite, &a.Rating, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.Tags = []string{}
	rows, err := s.Store.DB.Query(`
		SELECT t.name FROM annotation_tags at JOIN tags t ON t.id = at.tag_id
		WHERE at.annotation_id = ? ORDER BY t.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			a.Tags = append(a.Tags, n)
		}
	}
	return &a, nil
}

func (s *Server) handleCreateAnnotation(w http.ResponseWriter, r *http.Request) {
	var req annotationReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	var owned bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM books WHERE id = ? AND user_id = ?)`,
		req.BookID, uid).Scan(&owned); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if !owned { // someone else's book looks identical to a missing one
		writeErr(w, http.StatusNotFound, "book not found")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO annotations (book_id, quote, note, color, chapter, location,
		                         favorite, rating, source, dedupe_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?) ON CONFLICT DO NOTHING`,
		req.BookID, nullable(req.Quote), nullable(req.Note), req.Color,
		nullable(req.Chapter), nullable(req.Location), req.Favorite, req.Rating, req.hash())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same dedupe_hash already in this book
		writeErr(w, http.StatusConflict, "duplicate annotation")
		return
	}
	id, _ := res.LastInsertId()
	if err := setTags(tx, "annotation", uid, id, req.Tags); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	a, err := s.fetchAnnotation(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (s *Server) handleListAnnotations(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	q := `
		SELECT a.id, a.book_id, COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite, a.rating,
		       a.created_at, a.updated_at
		FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE b.user_id = ?`
	args := []any{uid}
	if v := r.URL.Query().Get("book_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid book_id")
			return
		}
		q += ` AND a.book_id = ?`
		args = append(args, id)
	}
	if v := r.URL.Query().Get("color"); v != "" {
		if !validColor(v) {
			writeErr(w, http.StatusBadRequest, "color must be yellow, blue, pink or orange")
			return
		}
		q += ` AND a.color = ?`
		args = append(args, v)
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM annotation_tags at JOIN tags t ON t.id = at.tag_id
		                   WHERE at.annotation_id = a.id AND t.name = ?)`
		args = append(args, v)
	}
	if !favoriteRatingFilters(w, r, "a", &q, &args) {
		return
	}
	q += ` ORDER BY a.created_at DESC, a.id DESC`
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	items := []annotationRow{}
	for rows.Next() {
		a := annotationRow{Tags: []string{}}
		if err := rows.Scan(&a.ID, &a.BookID, &a.Quote, &a.Note, &a.Color,
			&a.Chapter, &a.Location, &a.Favorite, &a.Rating, &a.CreatedAt, &a.UpdatedAt); err == nil {
			items = append(items, a)
		}
	}
	// One query fills all tag lists (tags are per-user, so this can't leak).
	tagRows, err := s.Store.DB.Query(`
		SELECT at.annotation_id, t.name FROM annotation_tags at
		JOIN tags t ON t.id = at.tag_id WHERE t.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tagRows.Close()
	byAnn := map[int64][]string{}
	for tagRows.Next() {
		var id int64
		var n string
		if err := tagRows.Scan(&id, &n); err == nil {
			byAnn[id] = append(byAnn[id], n)
		}
	}
	for i := range items {
		if ts := byAnn[items[i].ID]; ts != nil {
			items[i].Tags = ts
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"annotations": items})
}

func (s *Server) handleUpdateAnnotation(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid annotation id")
		return
	}
	var req annotationReq // full new state; book_id in the body is ignored
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	var bookID int64
	err := s.Store.DB.QueryRow(`
		SELECT a.book_id FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).Scan(&bookID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "annotation not found")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	hash := req.hash()
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM annotations WHERE book_id = ? AND dedupe_hash = ? AND id <> ?)`,
		bookID, hash, id).Scan(&clash); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if clash { // the edit now collides with a sibling annotation
		writeErr(w, http.StatusConflict, "duplicate annotation")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		UPDATE annotations SET quote = ?, note = ?, color = ?, chapter = ?, location = ?,
		       favorite = ?, rating = ?, dedupe_hash = ?, updated_at = datetime('now')
		WHERE id = ?`,
		nullable(req.Quote), nullable(req.Note), req.Color,
		nullable(req.Chapter), nullable(req.Location), req.Favorite, req.Rating, hash, id); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := setTags(tx, "annotation", uid, id, req.Tags); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	a, err := s.fetchAnnotation(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *Server) handleDeleteAnnotation(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid annotation id")
		return
	}
	// Tag join rows cascade; the tags themselves persist (managed vocabulary, §10).
	res, err := s.Store.DB.Exec(`
		DELETE FROM annotations WHERE id = ?
		AND book_id IN (SELECT id FROM books WHERE user_id = ?)`, id, userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "annotation not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
