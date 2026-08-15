package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// episodeRef is the show half of a dialogue's locator: which episode the line is
// from. A film is one runtime, so its timestamp locates a line completely; a
// series with sixty episodes needs to say which of them "01:12:40" belongs to.
//
// Both are POINTERS because null — not 0 — is what "unset" means here: season 0
// is a real season, the one specials and pilots live in, so 0 and "not recorded"
// cannot share a value. Films leave both null; the rule lives in normalize rather
// than in a CHECK because SQLite cannot reach across to movies.media_type (0025).
type episodeRef struct {
	Season  *int `json:"season"`
	Episode *int `json:"episode"`
}

// Sanity ceilings, not domain truths: they exist so a client that sends a
// timestamp or a year where a season belongs is told so, rather than storing it.
const (
	maxSeason  = 999
	maxEpisode = 9999
)

// normalize applies the shows-only rule and checks the rest, returning a
// client-facing message or "" (the house shape — cf. normalizeStatus,
// normalizeMediaType). It needs the parent's media_type, so it is called after the
// movie is loaded rather than from dialogueReq.validate — which keeps a malformed
// line answering 400 and a missing movie answering 404, in that order.
//
// A film's lines are CLEARED rather than refused. Flipping a show to a film in the
// Edit form leaves its dialogues holding episode numbers that no longer mean
// anything; refusing them would make every later edit of those lines fail, with no
// way to fix it from a form that (correctly) does not offer the fields. Clearing
// heals the line on its next save, and matches the importer's forgiveness for the
// same case (writeMovieDialogues).
func (e *episodeRef) normalize(mediaType string) string {
	if mediaType != "show" {
		*e = episodeRef{}
		return ""
	}
	if (e.Season != nil && *e.Season < 0) || (e.Episode != nil && *e.Episode < 0) {
		return "season and episode cannot be negative"
	}
	if (e.Season != nil && *e.Season > maxSeason) || (e.Episode != nil && *e.Episode > maxEpisode) {
		return fmt.Sprintf("season must be at most %d and episode at most %d", maxSeason, maxEpisode)
	}
	// A season with no episode is fine — sometimes all anyone remembers is the
	// season a line was in. The reverse is not: an episode number means nothing
	// without its season, and would sort ahead of every numbered season.
	if e.Episode != nil && e.Season == nil {
		return "an episode needs the season it is in"
	}
	return ""
}

// dialogueReq is quoteReq plus the screen locator: who says the line, when in the
// runtime, and — for a show — which episode. See quote.go for the shared half.
type dialogueReq struct {
	quoteReq
	MovieID   int64  `json:"movie_id"`
	Character string `json:"character"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	episodeRef
}

// hash shadows quoteReq.hash to qualify a show's line by its episode — see
// store.DialogueDedupeHash for why a series needs that and a book does not.
// Films and un-episoded lines hash exactly as quoteReq would, so this changes
// nothing for them. Must be called AFTER episodeRef.normalize, or a film that
// still carries stale episode numbers would hash as though it were a show.
func (d *dialogueReq) hash() string {
	return store.DialogueDedupeHash(d.Quote, d.Season, d.Episode)
}

func (d *dialogueReq) validate() string {
	if msg := d.quoteReq.validate(); msg != "" {
		return msg
	}
	// Unlike an annotation, a dialogue is always a spoken line — there is no
	// note-only form, because a thought about a film belongs on the film.
	if d.Quote == "" {
		return "quote is required"
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

// autofillActor implements the PLAN §3b rule: when actor is empty, map each
// character named on the line to who plays them in the movie's stored cast
// (case-insensitive, trimmed). A line can now credit several characters (the
// client picks them as comma-joined tokens), so we split on commas, resolve
// each against the cast, and join the unique actors in order. Characters with
// no cast match contribute nothing; a fully unmatched line yields "".
func autofillActor(castJSON, character, actor string) string {
	if actor != "" || strings.TrimSpace(character) == "" {
		return actor
	}
	var cast []metadata.CastMember
	if json.Unmarshal([]byte(castJSON), &cast) != nil {
		return actor
	}
	var actors []string
	seen := map[string]bool{}
	for _, ch := range strings.Split(character, ",") {
		ch = strings.TrimSpace(ch)
		if ch == "" {
			continue
		}
		for _, c := range cast {
			if strings.EqualFold(strings.TrimSpace(c.Character), ch) {
				a := strings.TrimSpace(c.Actor)
				if a != "" && !seen[strings.ToLower(a)] {
					seen[strings.ToLower(a)] = true
					actors = append(actors, a)
				}
				break
			}
		}
	}
	return strings.Join(actors, ", ")
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

// dialogueRow is quoteRow plus the screen locator. See quote.go for the shared
// half.
type dialogueRow struct {
	quoteRow
	MovieID   int64  `json:"movie_id"`
	Character string `json:"character"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	episodeRef
	// The film's exclusion is quoteRow.WorkReviewExcluded, shared with
	// annotations rather than spelled movie_review_excluded here.
}

// dialogueCols includes the LEFT-JOINed spaced-repetition state (see
// dialogueReviewJoin); every SELECT using it must add that join. It also reads
// `m.review_excluded`, so every SELECT using it must join `movies m` — both of
// them already did, because that join IS the ownership check.
const dialogueCols = `d.id, d.movie_id, d.quote, COALESCE(d.note, ''), d.color, COALESCE(d.character, ''),
	COALESCE(d.actor, ''), COALESCE(d.timestamp, ''), d.season, d.episode, d.favorite, d.sticker_id, d.sticker_x, d.sticker_y,
	COALESCE(d.noted_at, ''), d.created_at, d.updated_at,
	r.item_id IS NOT NULL, COALESCE(r.stability, 0), COALESCE(r.last_reviewed_at, ''), COALESCE(r.last_result, ''),
	d.review_excluded, m.review_excluded`

// dialogueOrder is the one true dialogue order, used by the list and the export
// so a file reads in the order the screen shows: through the run, then through
// each episode, then down the runtime. A film's season/episode are always null,
// so this collapses to the timestamp order dialogues have always had; an
// un-episoded show line falls to the end of its group rather than the front
// (season 0 is a real season and sorts first, which is where specials belong).
//
// `p` is the dialogues table's alias, or "" when the query has none.
func dialogueOrder(p string) string {
	if p != "" {
		p += "."
	}
	return ` ORDER BY (` + p + `season IS NULL), ` + p + `season, (` + p + `episode IS NULL), ` + p + `episode,
		(` + p + `timestamp IS NULL), ` + p + `timestamp, ` + p + `id`
}

// dialogueReviewJoin attaches the per-line review row (kind='screen') that
// dialogueCols reads. Kept as a fragment so the list and single-fetch queries
// share one definition.
const dialogueReviewJoin = ` LEFT JOIN item_reviews r ON r.kind = 'screen' AND r.item_id = d.id`

func (s *Server) fetchDialogue(uid, id int64) (*dialogueRow, error) {
	var d dialogueRow
	err := s.Store.DB.QueryRow(`
		SELECT `+dialogueCols+`
		FROM dialogues d JOIN movies m ON m.id = d.movie_id`+dialogueReviewJoin+`
		WHERE d.id = ? AND m.user_id = ?`, id, uid).
		Scan(&d.ID, &d.MovieID, &d.Quote, &d.Note, &d.Color, &d.Character,
			&d.Actor, &d.Timestamp, &d.Season, &d.Episode, &d.Favorite, &d.StickerID, &d.StickerX, &d.StickerY,
			&d.NotedAt, &d.CreatedAt, &d.UpdatedAt,
			&d.Reviewed, &d.Stability, &d.LastReviewedAt, &d.LastResult,
			&d.ReviewExcluded, &d.WorkReviewExcluded)
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
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeDlgRowScan, "[dlg] fetchDialogue tag row scan failed: %v", err)
			continue
		}
		d.Tags = append(d.Tags, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeDlgRowScan, "[dlg] fetchDialogue tag row iteration failed: %v", err)
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
	olog.Tracef("[dlg] handleCreateDialogue uid=%d movie=%d", uid, req.MovieID)
	var castJSON, mediaType string
	err := s.Store.DB.QueryRow(
		`SELECT cast_json, COALESCE(media_type, 'movie') FROM movies WHERE id = ? AND user_id = ?`,
		req.MovieID, uid).Scan(&castJSON, &mediaType)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		internalError(w, r, "load movie cast", err)
		return
	}
	if msg := req.episodeRef.normalize(mediaType); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	if !s.stickerOwned(uid, req.StickerID) {
		writeErr(w, http.StatusBadRequest, "sticker not found")
		return
	}
	req.Actor = autofillActor(castJSON, req.Character, req.Actor)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	id, err := nextID(tx, "dialogues")
	if err != nil {
		internalError(w, r, "reserve dialogue id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO dialogues (id, movie_id, quote, note, color, character, actor, timestamp, season, episode,
		                       favorite, source, dedupe_hash, noted_at, sticker_id, sticker_x, sticker_y,
		                       review_excluded)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?,
		        -- Inherited from the film, exactly as a highlight inherits from its
		        -- book. See the annotation create path.
		        (SELECT COALESCE(review_excluded, 0) FROM movies WHERE id = ?)) ON CONFLICT DO NOTHING`,
		id, req.MovieID, req.Quote, nullable(req.Note), req.Color, nullable(req.Character),
		nullable(req.Actor), nullable(req.Timestamp), req.Season, req.Episode, req.Favorite, req.Source,
		req.hash(), nullable(req.NotedAt), req.StickerID, req.StickerX, req.StickerY, req.MovieID)
	if err != nil {
		internalError(w, r, "insert dialogue", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // same dedupe_hash already in this movie
		// Release the connection before the lookup — see the annotation create
		// path for why holding the tx across it self-deadlocks the 4-connection
		// pool. The INSERT matched nothing, so there is no work to commit.
		_ = tx.Rollback()

		// Same contract as the annotation create path: return the row that
		// already holds the slot so an outbox retry is idempotent.
		var existingID int64
		switch err := s.Store.DB.QueryRow(
			`SELECT id FROM dialogues WHERE movie_id = ? AND dedupe_hash = ?`,
			req.MovieID, req.hash()).Scan(&existingID); {
		case errors.Is(err, sql.ErrNoRows):
			writeErr(w, http.StatusConflict, "duplicate dialogue") // concurrently deleted
			return
		case err != nil:
			internalError(w, r, "locate duplicate dialogue", err)
			return
		}
		existing, err := s.fetchDialogue(uid, existingID)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusConflict, "duplicate dialogue")
			return
		}
		if err != nil {
			internalError(w, r, "fetch duplicate dialogue", err)
			return
		}
		writeConflictExisting(w, "duplicate dialogue", existing)
		return
	}
	if err := setTags(tx, "dialogue", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	d, err := s.fetchDialogue(uid, id)
	if err != nil {
		internalError(w, r, "fetch dialogue", err)
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) handleListDialogues(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[dlg] handleListDialogues uid=%d movie_id=%q tag=%q", uid, r.URL.Query().Get("movie_id"), r.URL.Query().Get("tag"))
	q := `
		SELECT ` + dialogueCols + `
		FROM dialogues d JOIN movies m ON m.id = d.movie_id` + dialogueReviewJoin + `
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
	// One row, for the review card's in-card edit — see idFilter.
	if !idFilter(w, r, "d", &q, &args) {
		return
	}
	if !colorFilter(w, r, "d", &q, &args) {
		return
	}
	if !favoriteFilter(w, r, "d", &q, &args) {
		return
	}
	// Season, episode, then lexical timestamp order, untimed lines last
	// (PLAN §3b — deliberate KISS).
	q += dialogueOrder("d")
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list dialogues", err)
		return
	}
	defer rows.Close()
	items := []dialogueRow{}
	for rows.Next() {
		var d dialogueRow
		d.Tags = []string{}
		if err := rows.Scan(&d.ID, &d.MovieID, &d.Quote, &d.Note, &d.Color, &d.Character,
			&d.Actor, &d.Timestamp, &d.Season, &d.Episode, &d.Favorite, &d.StickerID, &d.StickerX, &d.StickerY,
			&d.NotedAt, &d.CreatedAt, &d.UpdatedAt,
			&d.Reviewed, &d.Stability, &d.LastReviewedAt, &d.LastResult,
			&d.ReviewExcluded, &d.WorkReviewExcluded); err != nil {
			// See annotation_handlers: never silently drop a row — a scan error is a
			// SELECT/struct drift and would present as an unexplained empty list.
			olog.Warnf(olog.CodeDlgRowScan, "[dialogues] list row scan failed (schema/query drift?): %v", err)
			continue
		}
		items = append(items, d)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeDlgRowScan, "[dialogues] list row iteration failed: %v", err)
	}
	// One query fills all tag lists (tags are per-user, so this can't leak).
	tagRows, err := s.Store.DB.Query(`
		SELECT dt.dialogue_id, t.name FROM dialogue_tags dt
		JOIN tags t ON t.id = dt.tag_id WHERE t.user_id = ? ORDER BY t.name`, uid)
	if err != nil {
		internalError(w, r, "load dialogue tags", err)
		return
	}
	defer tagRows.Close()
	byDlg := map[int64][]string{}
	for tagRows.Next() {
		var id int64
		var n string
		if err := tagRows.Scan(&id, &n); err != nil {
			olog.Warnf(olog.CodeDlgRowScan, "[dlg] list tag row scan failed: %v", err)
			continue
		}
		byDlg[id] = append(byDlg[id], n)
	}
	if err := tagRows.Err(); err != nil {
		olog.Warnf(olog.CodeDlgRowScan, "[dlg] list tag row iteration failed: %v", err)
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
	olog.Tracef("[dlg] handleUpdateDialogue uid=%d id=%d", uid, id)
	var movieID int64
	var castJSON, mediaType string
	var wasFavorite bool
	err := s.Store.DB.QueryRow(`
		SELECT d.movie_id, m.cast_json, COALESCE(m.media_type, 'movie'), d.favorite
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE d.id = ? AND m.user_id = ?`, id, uid).Scan(&movieID, &castJSON, &mediaType, &wasFavorite)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "dialogue not found")
		return
	case err != nil:
		internalError(w, r, "load dialogue", err)
		return
	}
	if msg := req.episodeRef.normalize(mediaType); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	req.Actor = autofillActor(castJSON, req.Character, req.Actor)
	hash := req.hash()
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM dialogues WHERE movie_id = ? AND dedupe_hash = ? AND id <> ?)`,
		movieID, hash, id).Scan(&clash); err != nil {
		internalError(w, r, "check duplicate dialogue", err)
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
		internalError(w, r, "begin tx", err)
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		UPDATE dialogues SET quote = ?, note = ?, color = ?, character = ?, actor = ?, timestamp = ?,
		       season = ?, episode = ?,
		       favorite = ?, dedupe_hash = ?, sticker_id = ?, sticker_x = ?, sticker_y = ?, updated_at = datetime('now')
		WHERE id = ?`,
		req.Quote, nullable(req.Note), req.Color, nullable(req.Character),
		nullable(req.Actor), nullable(req.Timestamp), req.Season, req.Episode,
		req.Favorite, hash, req.StickerID, req.StickerX, req.StickerY, id); err != nil {
		internalError(w, r, "update dialogue", err)
		return
	}
	if err := setTags(tx, "dialogue", uid, id, req.Tags); err != nil {
		internalError(w, r, "set tags", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "commit tx", err)
		return
	}
	s.gcOrphanPeople(uid, "actor") // a changed actor name can orphan the old one
	// Favouriting a dialogue counts as "seeing" it (marginal half-life bump);
	// only on the false→true transition.
	if req.Favorite && !wasFavorite {
		s.applySeen(uid, kindScreen, id)
	}
	d, err := s.fetchDialogue(uid, id)
	if err != nil {
		internalError(w, r, "fetch dialogue", err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// handleDeleteDialogue bins the line, then deletes it (see trash.go).
func (s *Server) handleDeleteDialogue(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	s.binDelete(w, r, "dialogue", "dialogue not found", nil, func() {
		// The last line an actor was credited on can leave their metadata behind.
		// Deliberately NOT undone by a restore: a person row is a reference row
		// that re-fetches, not part of the quote.
		s.gcOrphanPeople(uid, "actor")
	})
}
