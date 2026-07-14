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
	// Attached sticker (uploaded image), or nil for none. StickerX/StickerY are
	// its centre as a fraction of the quote block's width; nil ⇒ unplaced (UI
	// defaults to top-right). PUT is full-state, so the client carries all three
	// through on every save (see annotationState).
	StickerID *int64   `json:"sticker_id"`
	StickerX  *float64 `json:"sticker_x"`
	StickerY  *float64 `json:"sticker_y"`
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
	ID         int64    `json:"id"`
	BookID     int64    `json:"book_id"`
	BookTitle  string   `json:"book_title"`  // parent attribution for cross-book lists (Home favourites)
	BookAuthor string   `json:"book_author"` // "" if unknown
	Quote      string   `json:"quote"`
	Note       string   `json:"note"`
	Color      string   `json:"color"`
	Chapter    string   `json:"chapter"`
	Location   string   `json:"location"`
	Favorite   bool     `json:"favorite"`
	Rating     int      `json:"rating"`
	Tags       []string `json:"tags"`
	NotedAt    string   `json:"noted_at"`   // date of addition (original, or manual-add time); "" if unknown
	StickerID  *int64   `json:"sticker_id"` // attached sticker (uploaded image), nil = none
	StickerX   *float64 `json:"sticker_x"`  // seal centre x as a fraction of block width; nil = top-right default
	StickerY   *float64 `json:"sticker_y"`  // seal centre y in the same width units
	CreatedAt  string   `json:"created_at"`
	UpdatedAt  string   `json:"updated_at"`
	// Spaced-repetition state for the status dot (v0.5.0). Reviewed=false is the
	// "unseen" pool; the client derives remembered/forgetting/probably-forgotten
	// from stability + last_reviewed_at + last_result (a lapse forces
	// probably-forgotten). Absent on create/update responses.
	Reviewed       bool    `json:"reviewed"`
	Stability      float64 `json:"stability"`
	LastReviewedAt string  `json:"last_reviewed_at"`
	LastResult     string  `json:"last_result"` // "got" | "forgot" | ""
}

func (s *Server) fetchAnnotation(uid, id int64) (*annotationRow, error) {
	var a annotationRow
	err := s.Store.DB.QueryRow(`
		SELECT a.id, a.book_id, b.title, COALESCE(b.author, ''),
		       COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite, a.rating,
		       COALESCE(a.noted_at, ''), a.sticker_id, a.sticker_x, a.sticker_y, a.created_at, a.updated_at
		FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).
		Scan(&a.ID, &a.BookID, &a.BookTitle, &a.BookAuthor, &a.Quote, &a.Note, &a.Color,
			&a.Chapter, &a.Location, &a.Favorite, &a.Rating, &a.NotedAt, &a.StickerID, &a.StickerX, &a.StickerY, &a.CreatedAt, &a.UpdatedAt)
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
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	// noted_at defaults to now for a manual add (the "date of addition"); imports
	// set it from the source instead.
	res, err := tx.Exec(`
		INSERT INTO annotations (book_id, quote, note, color, chapter, location,
		                         favorite, rating, source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, datetime('now'), ?, ?, ?) ON CONFLICT DO NOTHING`,
		req.BookID, nullable(req.Quote), nullable(req.Note), req.Color,
		nullable(req.Chapter), nullable(req.Location), req.Favorite, req.Rating, req.hash(), req.StickerID, req.StickerX, req.StickerY)
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
		SELECT a.id, a.book_id, b.title, COALESCE(b.author, ''),
		       COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite, a.rating,
		       COALESCE(a.noted_at, ''), a.sticker_id, a.sticker_x, a.sticker_y, a.created_at, a.updated_at,
		       r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, '')
		FROM annotations a JOIN books b ON b.id = a.book_id
		LEFT JOIN item_reviews r ON r.kind = 'book' AND r.item_id = a.id
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
	// Optional cap for widgets that only need the newest few (e.g. the Home
	// screen's "recently favourited" pair) — without it the whole set ships.
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 500 {
			writeErr(w, http.StatusBadRequest, "limit must be between 1 and 500")
			return
		}
		q += ` LIMIT ?`
		args = append(args, n)
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	items := []annotationRow{}
	for rows.Next() {
		a := annotationRow{Tags: []string{}}
		if err := rows.Scan(&a.ID, &a.BookID, &a.BookTitle, &a.BookAuthor, &a.Quote, &a.Note, &a.Color,
			&a.Chapter, &a.Location, &a.Favorite, &a.Rating, &a.NotedAt, &a.StickerID, &a.StickerX, &a.StickerY, &a.CreatedAt, &a.UpdatedAt,
			&a.Reviewed, &a.Stability, &a.LastReviewedAt, &a.LastResult); err == nil {
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
	var wasFavorite bool
	err := s.Store.DB.QueryRow(`
		SELECT a.book_id, a.favorite FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).Scan(&bookID, &wasFavorite)
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
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
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
		       favorite = ?, rating = ?, dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?, updated_at = datetime('now')
		WHERE id = ?`,
		nullable(req.Quote), nullable(req.Note), req.Color,
		nullable(req.Chapter), nullable(req.Location), req.Favorite, req.Rating, hash, req.StickerID, req.StickerX, req.StickerY, id); err != nil {
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
	// Favouriting a quote counts as "seeing" it (marginal half-life bump); only
	// on the false→true transition, so re-saving a favourite doesn't re-credit.
	if req.Favorite && !wasFavorite {
		s.applySeen(uid, kindBook, id)
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
