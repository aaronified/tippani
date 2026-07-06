package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/store"
)

type dialogueReq struct {
	MovieID   int64    `json:"movie_id"`
	Quote     string   `json:"quote"`
	Note      string   `json:"note"`
	Character string   `json:"character"`
	Actor     string   `json:"actor"`
	Timestamp string   `json:"timestamp"`
	Tags      []string `json:"tags"`
	Favorite  bool     `json:"favorite"`
	Rating    int      `json:"rating"` // 0 = unrated, else 1-5 (PLAN §3)
	// Attached sticker (uploaded image), or nil for none. StickerX/StickerY are
	// its centre as a fraction of the quote block width; nil ⇒ top-right default.
	// PUT is full-state, so the client carries all three through on every save.
	StickerID *int64   `json:"sticker_id"`
	StickerX  *float64 `json:"sticker_x"`
	StickerY  *float64 `json:"sticker_y"`
}

func (d *dialogueReq) validate() string {
	d.Quote = strings.TrimSpace(d.Quote)
	d.Note = strings.TrimSpace(d.Note)
	if d.Quote == "" {
		return "quote is required"
	}
	if d.Rating < 0 || d.Rating > 5 {
		return "rating must be between 0 and 5"
	}
	var ok bool
	if d.Character, ok = trimCap(d.Character, 128); !ok {
		return "character too long (max 128 characters)"
	}
	if d.Actor, ok = trimCap(d.Actor, 128); !ok {
		return "actor too long (max 128 characters)"
	}
	if d.Timestamp, ok = trimCap(d.Timestamp, 128); !ok {
		return "timestamp too long (max 128 characters)"
	}
	return ""
}

// autofillActor implements the PLAN §3b rule: when actor is empty and the
// character matches the movie's stored cast (case-insensitive, trimmed),
// fill in who plays them. character arrives already trimmed.
func autofillActor(castJSON, character, actor string) string {
	if actor != "" || character == "" {
		return actor
	}
	var cast []metadata.CastMember
	if json.Unmarshal([]byte(castJSON), &cast) != nil {
		return actor
	}
	for _, c := range cast {
		if strings.EqualFold(strings.TrimSpace(c.Character), character) {
			return strings.TrimSpace(c.Actor)
		}
	}
	return actor
}

// refillMovieActors applies the auto-fill rule retroactively: for the movie's
// dialogues whose actor is still empty, fill it from the (freshly updated) cast
// by matching character. This is what lets correcting a movie's metadata flow
// through to dialogues imported before the cast existed. Runs in the caller's tx;
// returns how many rows were filled. Rows are collected before updating (SQLite
// dislikes writing mid-iteration on the same connection).
func refillMovieActors(tx *sql.Tx, movieID int64) (int, error) {
	var castJSON string
	if err := tx.QueryRow(`SELECT cast_json FROM movies WHERE id = ?`, movieID).Scan(&castJSON); err != nil {
		return 0, err
	}
	rows, err := tx.Query(
		`SELECT id, COALESCE(character, '') FROM dialogues WHERE movie_id = ? AND (actor IS NULL OR actor = '')`,
		movieID)
	if err != nil {
		return 0, err
	}
	type fill struct {
		id    int64
		actor string
	}
	var fills []fill
	for rows.Next() {
		var id int64
		var ch string
		if err := rows.Scan(&id, &ch); err != nil {
			rows.Close()
			return 0, err
		}
		if a := autofillActor(castJSON, ch, ""); a != "" {
			fills = append(fills, fill{id, a})
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	for _, f := range fills {
		if _, err := tx.Exec(
			`UPDATE dialogues SET actor = ?, updated_at = datetime('now') WHERE id = ?`, f.actor, f.id); err != nil {
			return 0, err
		}
	}
	return len(fills), nil
}

type dialogueRow struct {
	ID        int64    `json:"id"`
	MovieID   int64    `json:"movie_id"`
	Quote     string   `json:"quote"`
	Note      string   `json:"note"`
	Character string   `json:"character"`
	Actor     string   `json:"actor"`
	Timestamp string   `json:"timestamp"`
	Favorite  bool     `json:"favorite"`
	Rating    int      `json:"rating"`
	Tags      []string `json:"tags"`
	StickerID *int64   `json:"sticker_id"` // attached sticker (uploaded image), nil = none
	StickerX  *float64 `json:"sticker_x"`  // seal centre x as a fraction of block width; nil = top-right default
	StickerY  *float64 `json:"sticker_y"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

const dialogueCols = `d.id, d.movie_id, d.quote, COALESCE(d.note, ''), COALESCE(d.character, ''),
	COALESCE(d.actor, ''), COALESCE(d.timestamp, ''), d.favorite, d.rating, d.sticker_id, d.sticker_x, d.sticker_y, d.created_at, d.updated_at`

func (s *Server) fetchDialogue(uid, id int64) (*dialogueRow, error) {
	var d dialogueRow
	err := s.Store.DB.QueryRow(`
		SELECT `+dialogueCols+`
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE d.id = ? AND m.user_id = ?`, id, uid).
		Scan(&d.ID, &d.MovieID, &d.Quote, &d.Note, &d.Character,
			&d.Actor, &d.Timestamp, &d.Favorite, &d.Rating, &d.StickerID, &d.StickerX, &d.StickerY, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	d.Tags = []string{}
	rows, err := s.Store.DB.Query(`
		SELECT t.name FROM dialogue_tags dt JOIN tags t ON t.id = dt.tag_id
		WHERE dt.dialogue_id = ? ORDER BY t.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			d.Tags = append(d.Tags, n)
		}
	}
	return &d, nil
}

func (s *Server) handleCreateDialogue(w http.ResponseWriter, r *http.Request) {
	var req dialogueReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	var castJSON string
	err := s.Store.DB.QueryRow(
		`SELECT cast_json FROM movies WHERE id = ? AND user_id = ?`,
		req.MovieID, uid).Scan(&castJSON)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	req.Actor = autofillActor(castJSON, req.Character, req.Actor)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO dialogues (movie_id, quote, note, character, actor, timestamp,
		                       favorite, rating, dedupe_hash, sticker_id, sticker_x, sticker_y)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		req.MovieID, req.Quote, nullable(req.Note), nullable(req.Character),
		nullable(req.Actor), nullable(req.Timestamp), req.Favorite, req.Rating,
		store.DedupeHash(req.Quote), req.StickerID, req.StickerX, req.StickerY)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same dedupe_hash already in this movie
		writeErr(w, http.StatusConflict, "duplicate dialogue")
		return
	}
	id, _ := res.LastInsertId()
	if err := setTags(tx, "dialogue", uid, id, req.Tags); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	d, err := s.fetchDialogue(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) handleListDialogues(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	q := `
		SELECT ` + dialogueCols + `
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE m.user_id = ?`
	args := []any{uid}
	if v := r.URL.Query().Get("movie_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid movie_id")
			return
		}
		q += ` AND d.movie_id = ?`
		args = append(args, id)
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM dialogue_tags dt JOIN tags t ON t.id = dt.tag_id
		                   WHERE dt.dialogue_id = d.id AND t.name = ?)`
		args = append(args, v)
	}
	if !favoriteRatingFilters(w, r, "d", &q, &args) {
		return
	}
	// Lexical timestamp order, untimed lines last (PLAN §3b — deliberate KISS).
	q += ` ORDER BY (d.timestamp IS NULL), d.timestamp, d.id`
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	items := []dialogueRow{}
	for rows.Next() {
		d := dialogueRow{Tags: []string{}}
		if err := rows.Scan(&d.ID, &d.MovieID, &d.Quote, &d.Note, &d.Character,
			&d.Actor, &d.Timestamp, &d.Favorite, &d.Rating, &d.StickerID, &d.StickerX, &d.StickerY, &d.CreatedAt, &d.UpdatedAt); err == nil {
			items = append(items, d)
		}
	}
	// One query fills all tag lists (tags are per-user, so this can't leak).
	tagRows, err := s.Store.DB.Query(`
		SELECT dt.dialogue_id, t.name FROM dialogue_tags dt
		JOIN tags t ON t.id = dt.tag_id WHERE t.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tagRows.Close()
	byDlg := map[int64][]string{}
	for tagRows.Next() {
		var id int64
		var n string
		if err := tagRows.Scan(&id, &n); err == nil {
			byDlg[id] = append(byDlg[id], n)
		}
	}
	for i := range items {
		if ts := byDlg[items[i].ID]; ts != nil {
			items[i].Tags = ts
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"dialogues": items})
}

func (s *Server) handleUpdateDialogue(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid dialogue id")
		return
	}
	var req dialogueReq // full new state; movie_id in the body is ignored
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	var movieID int64
	var castJSON string
	err := s.Store.DB.QueryRow(`
		SELECT d.movie_id, m.cast_json FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE d.id = ? AND m.user_id = ?`, id, uid).Scan(&movieID, &castJSON)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "dialogue not found")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	req.Actor = autofillActor(castJSON, req.Character, req.Actor)
	hash := store.DedupeHash(req.Quote)
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM dialogues WHERE movie_id = ? AND dedupe_hash = ? AND id <> ?)`,
		movieID, hash, id).Scan(&clash); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if clash {
		writeErr(w, http.StatusConflict, "duplicate dialogue")
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
		UPDATE dialogues SET quote = ?, note = ?, character = ?, actor = ?, timestamp = ?,
		       favorite = ?, rating = ?, dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?, updated_at = datetime('now')
		WHERE id = ?`,
		req.Quote, nullable(req.Note), nullable(req.Character),
		nullable(req.Actor), nullable(req.Timestamp), req.Favorite, req.Rating, hash, req.StickerID, req.StickerX, req.StickerY, id); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := setTags(tx, "dialogue", uid, id, req.Tags); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	d, err := s.fetchDialogue(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) handleDeleteDialogue(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid dialogue id")
		return
	}
	// Tag join rows cascade; the tags themselves persist (managed vocabulary, §10).
	res, err := s.Store.DB.Exec(`
		DELETE FROM dialogues WHERE id = ?
		AND movie_id IN (SELECT id FROM movies WHERE user_id = ?)`, id, userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "dialogue not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
