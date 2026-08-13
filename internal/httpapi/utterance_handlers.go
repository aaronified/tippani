package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// Utterances: quotes belonging to no book and no film (ROADMAP §24) — a line
// from a speech, a letter, an interview, a song, a proverb.
//
// The third kind, and the odd one out in exactly one respect: OWNERSHIP.
//
// An annotation is owned through its book and a dialogue through its film, so
// `JOIN books b ON b.id = a.book_id WHERE b.user_id = ?` is simultaneously the
// parent join and the access check. Forgetting to scope one of those queries is
// not really possible — there is nothing to select from without the join.
//
// An utterance has no parent, so that safety net does not exist. EVERY query in
// this file carries its own `WHERE user_id = ?`, and a missing one is a
// cross-account leak rather than a hidden row. Per-user isolation is a security
// property here, not a layout choice: a foreign row answers 404 and never 403,
// because 403 confirms the row exists. There is an ownership test per endpoint.
//
// Everything else is deliberately the same as the other two kinds. The shared
// half of the payload and the response come from quoteReq/quoteRow in quote.go,
// embedded anonymously so the JSON stays flat, and colours, tags, notes,
// favourites, stickers and the review dot all behave identically.

// utteranceReq is quoteReq plus the occasion — this kind's locator.
type utteranceReq struct {
	quoteReq
	Speaker      string `json:"speaker"`
	Occasion     string `json:"occasion"`      // a rally, a broadcast, a letter, a recording
	OccasionDate string `json:"occasion_date"` // PARTIAL: YYYY | YYYY-MM | YYYY-MM-DD
	Place        string `json:"place"`
	Medium       string `json:"medium"` // radio, speech, letter, interview, song
}

// validate runs the shared rules, then this kind's own.
func (u *utteranceReq) validate() string {
	if msg := u.quoteReq.validate(); msg != "" {
		return msg
	}
	for _, f := range []struct {
		name string
		v    *string
		max  int
	}{
		{"speaker", &u.Speaker, 200},
		{"occasion", &u.Occasion, 200},
		{"place", &u.Place, 200},
		{"medium", &u.Medium, 100},
	} {
		s, ok := trimCap(*f.v, f.max)
		if !ok {
			return f.name + " is too long"
		}
		*f.v = s
	}

	// A quote with no words is not a quote by anything the word could mean. An
	// annotation may be a bare note about a page, because the page is the thing
	// being remembered; here there is no page, so the text is all there is.
	if u.Quote == "" {
		return "a quote is required"
	}
	// The occasion date is PARTIAL by design — "1944" is usually the honest
	// answer, and padding it to a January morning invents precision nobody has.
	// normalizePartialDate is the shelf read log's validator, reused rather than
	// reimplemented: same three shapes, same calendar checks, same message, so
	// the two places in the app that accept a partial date cannot disagree about
	// what one is.
	if msg := normalizePartialDate("occasion date", &u.OccasionDate); msg != "" {
		return msg
	}
	return ""
}

// hash folds the occasion in, because for this kind the locator DISCRIMINATES:
// the same words said on two occasions are two quotes. See
// store.UtteranceDedupeHash for which of the five occasion fields count and why
// place and medium do not.
func (u *utteranceReq) hash() string {
	return store.UtteranceDedupeHash(u.Quote, u.Speaker, u.Occasion, u.OccasionDate)
}

// utteranceRow is quoteRow plus the occasion. See quote.go for the shared half.
type utteranceRow struct {
	quoteRow
	Speaker      string `json:"speaker"`
	Occasion     string `json:"occasion"`
	OccasionDate string `json:"occasion_date"`
	Place        string `json:"place"`
	Medium       string `json:"medium"`
}

// utteranceCols includes the LEFT-JOINed spaced-repetition state; every SELECT
// using it must add utteranceReviewJoin.
const utteranceCols = `u.id, u.quote, COALESCE(u.note, ''), u.color, u.favorite,
	u.speaker, u.occasion, u.occasion_date, u.place, u.medium,
	COALESCE(u.noted_at, ''), u.sticker_id, u.sticker_x, u.sticker_y, u.created_at, u.updated_at,
	r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, ''),
	u.review_excluded`

const utteranceReviewJoin = ` LEFT JOIN item_reviews r ON r.kind = 'utterance' AND r.item_id = u.id`

func scanUtterance(sc interface{ Scan(...any) error }) (utteranceRow, error) {
	var u utteranceRow
	err := sc.Scan(&u.ID, &u.Quote, &u.Note, &u.Color, &u.Favorite,
		&u.Speaker, &u.Occasion, &u.OccasionDate, &u.Place, &u.Medium,
		&u.NotedAt, &u.StickerID, &u.StickerX, &u.StickerY, &u.CreatedAt, &u.UpdatedAt,
		&u.Reviewed, &u.Stability, &u.LastReviewedAt, &u.LastResult, &u.ReviewExcluded)
	u.Tags = []string{}
	return u, err
}

func (s *Server) fetchUtterance(uid, id int64) (*utteranceRow, error) {
	u, err := scanUtterance(s.Store.DB.QueryRow(
		`SELECT `+utteranceCols+` FROM utterances u`+utteranceReviewJoin+`
		 WHERE u.id = ? AND u.user_id = ?`, id, uid))
	if err != nil {
		return nil, err
	}
	rows, err := s.Store.DB.Query(`
		SELECT t.name FROM utterance_tags ut JOIN tags t ON t.id = ut.tag_id
		WHERE ut.utterance_id = ? ORDER BY t.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeTagRowScan, "[utt] tag row scan failed: %v", err)
			continue
		}
		u.Tags = append(u.Tags, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeTagRowScan, "[utt] tag row iteration failed: %v", err)
	}
	return &u, nil
}

func (s *Server) handleCreateUtterance(w http.ResponseWriter, r *http.Request) {
	var req utteranceReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[utt] handleCreateUtterance uid=%v speaker=%q", uid, req.Speaker)
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
	id, err := nextID(tx, "utterances")
	if err != nil {
		internalError(w, r, "reserve quote id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO utterances (id, user_id, quote, note, color, favorite,
		                        speaker, occasion, occasion_date, place, medium,
		                        source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?)
		ON CONFLICT DO NOTHING`,
		id, uid, req.Quote, nullable(req.Note), req.Color, req.Favorite,
		req.Speaker, req.Occasion, req.OccasionDate, req.Place, req.Medium,
		req.Source, req.hash(), nullable(req.NotedAt), req.StickerID, req.StickerX, req.StickerY)
	if err != nil {
		internalError(w, r, "insert utterance", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same (user_id, dedupe_hash) already here
		// Release this transaction's connection BEFORE reading the existing row —
		// the pool is capped at 4 and the lookup below needs a second connection,
		// so holding the tx across it self-deadlocks once the pool saturates. The
		// INSERT matched nothing, so there is no work to commit. See the same note
		// in handleCreateAnnotation and TestDuplicatePostUnderPoolPressure.
		_ = tx.Rollback()

		var existingID int64
		switch err := s.Store.DB.QueryRow(
			`SELECT id FROM utterances WHERE user_id = ? AND dedupe_hash = ?`,
			uid, req.hash()).Scan(&existingID); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusConflict, "duplicate quote")
			return
		case err != nil:
			internalError(w, r, "locate duplicate quote", err)
			return
		}
		existing, err := s.fetchUtterance(uid, existingID)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusConflict, "duplicate quote")
			return
		}
		if err != nil {
			internalError(w, r, "fetch duplicate quote", err)
			return
		}
		writeConflictExisting(w, "duplicate quote", existing)
		return
	}
	if err := setTags(tx, "utterance", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	u, err := s.fetchUtterance(uid, id)
	if err != nil {
		internalError(w, r, "fetch utterance", err)
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (s *Server) handleListUtterances(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[utt] handleListUtterances uid=%v color=%q tag=%q speaker=%q", uid,
		r.URL.Query().Get("color"), r.URL.Query().Get("tag"), r.URL.Query().Get("speaker"))
	// The user scope is in the base query rather than appended by a filter, so
	// no combination of query parameters can produce a statement without it.
	q := `SELECT ` + utteranceCols + ` FROM utterances u` + utteranceReviewJoin + `
	      WHERE u.user_id = ?`
	args := []any{uid}
	if v := strings.TrimSpace(r.URL.Query().Get("speaker")); v != "" {
		q += ` AND u.speaker = ?`
		args = append(args, v)
	}
	if !colorFilter(w, r, "u", &q, &args) {
		return
	}
	if v := r.URL.Query().Get("tag"); v != "" {
		q += ` AND EXISTS (SELECT 1 FROM utterance_tags ut JOIN tags t ON t.id = ut.tag_id
		                   WHERE ut.utterance_id = u.id AND t.name = ?)`
		args = append(args, v)
	}
	if !favoriteFilter(w, r, "u", &q, &args) {
		return
	}
	q += ` ORDER BY u.created_at DESC, u.id DESC`
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list utterances", err)
		return
	}
	defer rows.Close()
	items := []utteranceRow{} // not nil, so an empty result marshals as [] rather than null
	byID := map[int64]int{}
	for rows.Next() {
		u, err := scanUtterance(rows)
		if err != nil {
			olog.Warnf(olog.CodeUttRowScan, "[utt] row scan failed: %v", err)
			continue
		}
		byID[u.ID] = len(items)
		items = append(items, u)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeUttRowScan, "[utt] row iteration failed: %v", err)
	}
	if len(items) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"utterances": items})
		return
	}
	// Tags in one batch rather than per row, matching the other two kinds. Scoped
	// by user on BOTH sides: tags are per-user, and so are the quotes they hang on.
	trows, err := s.Store.DB.Query(`
		SELECT ut.utterance_id, t.name
		FROM utterance_tags ut
		JOIN tags t ON t.id = ut.tag_id
		JOIN utterances u ON u.id = ut.utterance_id
		WHERE t.user_id = ? AND u.user_id = ?
		ORDER BY t.name`, uid, uid)
	if err != nil {
		internalError(w, r, "list utterance tags", err)
		return
	}
	defer trows.Close()
	for trows.Next() {
		var id int64
		var name string
		if err := trows.Scan(&id, &name); err != nil {
			olog.Warnf(olog.CodeTagRowScan, "[utt] tag row scan failed: %v", err)
			continue
		}
		if i, ok := byID[id]; ok {
			items[i].Tags = append(items[i].Tags, name)
		}
	}
	if err := trows.Err(); err != nil {
		olog.Warnf(olog.CodeTagRowScan, "[utt] tag row iteration failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"utterances": items})
}

func (s *Server) handleUpdateUtterance(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid quote id")
		return
	}
	var req utteranceReq
	if !decodeBody(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	olog.Tracef("[utt] handleUpdateUtterance uid=%v id=%v", uid, id)
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
	// Read inside the transaction, and only to spot the favourite transition
	// below — the UPDATE still carries its own scope, so this is not a
	// permission check and a missing row needs no handling here.
	var wasFavorite bool
	_ = tx.QueryRow(`SELECT favorite FROM utterances WHERE id = ? AND user_id = ?`, id, uid).Scan(&wasFavorite)
	// The user scope is in the UPDATE itself, not a preflight SELECT: a check
	// followed by an unscoped write is a race, and here it would be a race that
	// edits someone else's quote.
	//
	// The hash is recomputed because editing the words or the occasion changes
	// what this quote IS. source and noted_at are create-only — a capture's
	// origin does not change when you fix a typo in it.
	res, err := tx.Exec(`
		UPDATE utterances SET quote = ?, note = ?, color = ?, favorite = ?,
		       speaker = ?, occasion = ?, occasion_date = ?, place = ?, medium = ?,
		       dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?,
		       updated_at = datetime('now')
		WHERE id = ? AND user_id = ?`,
		req.Quote, nullable(req.Note), req.Color, req.Favorite,
		req.Speaker, req.Occasion, req.OccasionDate, req.Place, req.Medium,
		req.hash(), req.StickerID, req.StickerX, req.StickerY, id, uid)
	if err != nil {
		internalError(w, r, "update utterance", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Missing, or someone else's — indistinguishable on purpose.
		writeErr(w, http.StatusNotFound, "quote not found")
		return
	}
	if err := setTags(tx, "utterance", uid, id, req.Tags); err != nil {
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
		s.applySeen(uid, kindUtterance, id)
	}
	u, err := s.fetchUtterance(uid, id)
	if err != nil {
		internalError(w, r, "fetch utterance", err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// handleDeleteUtterance bins the quote, then deletes it (see trash.go).
//
// The tag rows and the item_reviews row still go with it — utterance_tags cascades
// on the foreign key, and item_reviews is cleared by the 0026 AFTER DELETE trigger,
// since a polymorphic table cannot hold a real foreign key to three parents. Both
// are read into the snapshot before the delete for exactly that reason: a trigger
// leaves nothing behind to find afterwards.
func (s *Server) handleDeleteUtterance(w http.ResponseWriter, r *http.Request) {
	s.binDelete(w, r, "quote", "quote not found", nil, nil)
}
