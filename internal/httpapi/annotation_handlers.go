package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"tippani/internal/olog"
)

// annotationReq is quoteReq plus the book locator: where in the book the
// passage sits. See quote.go for the shared half.
type annotationReq struct {
	quoteReq
	BookID   int64  `json:"book_id"`
	Chapter  string `json:"chapter"`
	Location string `json:"location"`
}

func (a *annotationReq) validate() string {
	if msg := a.quoteReq.validate(); msg != "" {
		return msg
	}
	// A book highlight may be a standalone note with no quote — a thought about
	// the page rather than a passage from it. A dialogue may not.
	if a.Quote == "" && a.Note == "" {
		return "quote or note is required"
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

// favoriteFilter appends the PLAN §3 favorite=1 list filter (shared by
// annotations and dialogues) for the given table alias. Writes a 400 and
// returns false on a bad value. The args param is retained for a stable
// signature across callers even though the favorite filter binds no value.
func favoriteFilter(w http.ResponseWriter, r *http.Request, alias string, q *string, args *[]any) bool {
	if v := r.URL.Query().Get("favorite"); v != "" {
		if v != "1" {
			writeErr(w, http.StatusBadRequest, "favorite filter must be 1")
			return false
		}
		*q += ` AND ` + alias + `.favorite = 1`
	}
	return true
}

// annotationRow is quoteRow plus the book locator and the parent attribution
// that cross-book lists (Home favourites) render. See quote.go for the shared
// half.
type annotationRow struct {
	quoteRow
	BookID     int64  `json:"book_id"`
	BookTitle  string `json:"book_title"`  // parent attribution for cross-book lists
	BookAuthor string `json:"book_author"` // "" if unknown
	Chapter    string `json:"chapter"`
	Location   string `json:"location"`
}

func (s *Server) fetchAnnotation(uid, id int64) (*annotationRow, error) {
	var a annotationRow
	err := s.Store.DB.QueryRow(`
		SELECT a.id, a.book_id, b.title, COALESCE(b.author, ''),
		       COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite,
		       COALESCE(a.noted_at, ''), a.sticker_id, a.sticker_x, a.sticker_y, a.created_at, a.updated_at,
		       a.review_excluded
		FROM annotations a JOIN books b ON b.id = a.book_id
		WHERE a.id = ? AND b.user_id = ?`, id, uid).
		Scan(&a.ID, &a.BookID, &a.BookTitle, &a.BookAuthor, &a.Quote, &a.Note, &a.Color,
			&a.Chapter, &a.Location, &a.Favorite, &a.NotedAt, &a.StickerID, &a.StickerX, &a.StickerY, &a.CreatedAt, &a.UpdatedAt,
			&a.ReviewExcluded)
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
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeAnnoRowScan, "[anno] annotation tags row scan failed: %v", err)
			continue
		}
		a.Tags = append(a.Tags, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeAnnoRowScan, "[anno] annotation tags row iteration failed: %v", err)
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
	olog.Tracef("[anno] handleCreateAnnotation uid=%v book_id=%v", uid, req.BookID)
	var owned bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM books WHERE id = ? AND user_id = ?)`,
		req.BookID, uid).Scan(&owned); err != nil {
		internalError(w, r, "check book ownership", err)
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
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	// noted_at defaults to now (the "date of addition"); imports set it from the
	// source, and a client flushing an offline capture sends the date it was
	// actually taken — COALESCE picks whichever applies.
	// The id is allocated rather than left to SQLite, so a deleted quote's id is
	// never handed to a new one — see id_floor.go. Everything downstream uses this
	// value instead of LastInsertId().
	id, err := nextID(tx, "annotations")
	if err != nil {
		internalError(w, r, "reserve annotation id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO annotations (id, book_id, quote, note, color, chapter, location,
		                         favorite, source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?) ON CONFLICT DO NOTHING`,
		id, req.BookID, nullable(req.Quote), nullable(req.Note), req.Color,
		nullable(req.Chapter), nullable(req.Location), req.Favorite, req.Source, req.hash(),
		nullable(req.NotedAt), req.StickerID, req.StickerX, req.StickerY)
	if err != nil {
		internalError(w, r, "insert annotation", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same dedupe_hash already in this book
		// Release this transaction's connection BEFORE reading the existing row.
		//
		// The pool is capped at 4 (store.Open's SetMaxOpenConns), and the lookup
		// below goes through s.Store.DB, which needs a SECOND connection. Holding
		// the tx across it self-deadlocks once the pool is saturated: the handler
		// blocks waiting for a connection that only it can free, so the request
		// hangs until busy_timeout turns it into a 500. Concurrent duplicate posts
		// — an offline client flushing a queue is exactly that — reach it over
		// plain HTTP. See TestDuplicatePostUnderPoolPressure.
		//
		// Rolling back here is safe and complete: the INSERT matched nothing, so
		// there is no work to commit. The deferred Rollback still runs and returns
		// ErrTxDone, which is ignored.
		_ = tx.Rollback()

		// Hand back the row holding this (book_id, dedupe_hash) slot so an
		// offline client retrying an unacknowledged POST can tell its own
		// earlier write from a real clash (see writeConflictExisting).
		var existingID int64
		switch err := s.Store.DB.QueryRow(
			`SELECT id FROM annotations WHERE book_id = ? AND dedupe_hash = ?`,
			req.BookID, req.hash()).Scan(&existingID); {
		case errors.Is(err, sql.ErrNoRows):
			// A concurrent delete removed it between the failed insert and this
			// read. Still a duplicate as far as this request went, just with
			// nothing left to point at.
			writeErr(w, http.StatusConflict, "duplicate annotation")
			return
		case err != nil:
			internalError(w, r, "locate duplicate annotation", err)
			return
		}
		existing, err := s.fetchAnnotation(uid, existingID)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusConflict, "duplicate annotation")
			return
		}
		if err != nil {
			internalError(w, r, "fetch duplicate annotation", err)
			return
		}
		writeConflictExisting(w, "duplicate annotation", existing)
		return
	}
	if err := setTags(tx, "annotation", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	a, err := s.fetchAnnotation(uid, id)
	if err != nil {
		internalError(w, r, "fetch annotation", err)
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (s *Server) handleListAnnotations(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[anno] handleListAnnotations uid=%v book_id=%q color=%q tag=%q", uid,
		r.URL.Query().Get("book_id"), r.URL.Query().Get("color"), r.URL.Query().Get("tag"))
	q := `
		SELECT a.id, a.book_id, b.title, COALESCE(b.author, ''),
		       COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
		       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite,
		       COALESCE(a.noted_at, ''), a.sticker_id, a.sticker_x, a.sticker_y, a.created_at, a.updated_at,
		       r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, ''),
		       a.review_excluded
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
	if !colorFilter(w, r, "a", &q, &args) {
		return
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM annotation_tags at JOIN tags t ON t.id = at.tag_id
		                   WHERE at.annotation_id = a.id AND t.name = ?)`
		args = append(args, v)
	}
	if !favoriteFilter(w, r, "a", &q, &args) {
		return
	}
	q += ` ORDER BY a.created_at DESC, a.id DESC`
	// Optional cap for widgets that only need the newest few (e.g. the Home
	// screen's "recently favourited" pair), and the offset a client mirroring
	// the library pages with — without either, the whole set ships.
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list annotations", err)
		return
	}
	defer rows.Close()
	items := []annotationRow{}
	for rows.Next() {
		var a annotationRow
		a.Tags = []string{}
		if err := rows.Scan(&a.ID, &a.BookID, &a.BookTitle, &a.BookAuthor, &a.Quote, &a.Note, &a.Color,
			&a.Chapter, &a.Location, &a.Favorite, &a.NotedAt, &a.StickerID, &a.StickerX, &a.StickerY, &a.CreatedAt, &a.UpdatedAt,
			&a.Reviewed, &a.Stability, &a.LastReviewedAt, &a.LastResult, &a.ReviewExcluded); err != nil {
			// Never silently drop a row: a scan error means the SELECT and the
			// annotationRow struct drifted apart (e.g. a migration added a column),
			// which would otherwise show up as a mysteriously short/empty list with a
			// 200 — exactly the kind of "favourites vanished" symptom that's painful
			// to trace. Log it loudly and keep going.
			olog.Warnf(olog.CodeAnnoRowScan, "[annotations] list row scan failed (schema/query drift?): %v", err)
			continue
		}
		items = append(items, a)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeAnnoRowScan, "[annotations] list row iteration failed: %v", err)
	}
	// One query fills all tag lists (tags are per-user, so this can't leak).
	tagRows, err := s.Store.DB.Query(`
		SELECT at.annotation_id, t.name FROM annotation_tags at
		JOIN tags t ON t.id = at.tag_id WHERE t.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		internalError(w, r, "load tags", err)
		return
	}
	defer tagRows.Close()
	byAnn := map[int64][]string{}
	for tagRows.Next() {
		var id int64
		var n string
		if err := tagRows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeAnnoRowScan, "[anno] tag row scan failed: %v", err)
			continue
		}
		byAnn[id] = append(byAnn[id], n)
	}
	if err := tagRows.Err(); err != nil {
		olog.Warnf(olog.CodeAnnoRowScan, "[anno] tag row iteration failed: %v", err)
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
	olog.Tracef("[anno] handleUpdateAnnotation uid=%v id=%v", uid, id)
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
		internalError(w, r, "load annotation", err)
		return
	}
	hash := req.hash()
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM annotations WHERE book_id = ? AND dedupe_hash = ? AND id <> ?)`,
		bookID, hash, id).Scan(&clash); err != nil {
		internalError(w, r, "check duplicate annotation", err)
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
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		UPDATE annotations SET quote = ?, note = ?, color = ?, chapter = ?, location = ?,
		       favorite = ?, dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?, updated_at = datetime('now')
		WHERE id = ?`,
		nullable(req.Quote), nullable(req.Note), req.Color,
		nullable(req.Chapter), nullable(req.Location), req.Favorite, hash, req.StickerID, req.StickerX, req.StickerY, id); err != nil {
		internalError(w, r, "update annotation", err)
		return
	}
	if err := setTags(tx, "annotation", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	// Favouriting a quote counts as "seeing" it (marginal half-life bump); only
	// on the false→true transition, so re-saving a favourite doesn't re-credit.
	if req.Favorite && !wasFavorite {
		s.applySeen(uid, kindBook, id)
	}
	a, err := s.fetchAnnotation(uid, id)
	if err != nil {
		internalError(w, r, "fetch annotation", err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

// handleDeleteAnnotation bins the quote, then deletes it (see trash.go). Tag join
// rows cascade and the item_reviews row goes with it via the 0015 trigger — both
// are in the snapshot first, so a restore brings the tags and the review schedule
// back with the words. The tags themselves persist either way (managed
// vocabulary, §10).
func (s *Server) handleDeleteAnnotation(w http.ResponseWriter, r *http.Request) {
	s.binDelete(w, r, "annotation", "annotation not found", nil, nil)
}
