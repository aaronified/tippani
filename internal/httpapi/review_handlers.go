package httpapi

// Spaced-repetition daily review (ROADMAP №2, PLAN §3c).
//
// The mechanism is the exponential forgetting curve: recall probability
// p = 2^(-elapsed_days / stability), with `stability` the per-annotation
// memory half-life in days (annotation_reviews, migration 0013). A card is
// due when p <= 0.5 — i.e. elapsed >= stability — so due-ness and the
// most-forgotten-first ordering are the plain ratio elapsed/stability,
// computed in SQL at query time. Answers move the half-life the SM-2 way:
// "got it" multiplies it (expanding retrieval), "forgot" is a lapse that
// shrinks it without a hard reset, "skip" only benches the card for the
// rest of the local day. No configuration, no background jobs.

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

const (
	reviewQuota        = 8     // cards per local day — keeps the ritual at ~2-3 minutes
	reviewMinStability = 1.0   // days; half-life floor and the unseen-card default
	reviewMaxStability = 365.0 // days; growth cap
	reviewGrowth       = 2.5   // "got it" multiplies the half-life
	reviewLateBonus    = 1.2   // a late recall proves stability >= elapsed — credit it
	reviewLapseShrink  = 0.25  // "forgot" keeps a quarter of the half-life, not zero
)

// reviewMastery buckets a half-life into the ROADMAP's SOON / LATER / SOMEDAY
// mastery labels. Derived, never stored.
func reviewMastery(stability float64) string {
	switch {
	case stability >= 30:
		return "someday"
	case stability >= 7:
		return "later"
	default:
		return "soon"
	}
}

// tzOffset parses the client's UTC offset in minutes, east positive (JS:
// -new Date().getTimezoneOffset()). It makes "today" the reviewer's local
// day; the client sends its current offset per request, so DST is its
// problem, not ours. Absent/empty means UTC.
func tzOffset(v string) (int, bool) {
	if v == "" {
		return 0, true
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < -720 || n > 840 {
		return 0, false
	}
	return n, true
}

// reviewDay returns the reviewer's local date ("YYYY-MM-DD"), a stable
// per-day shuffle seed, and the SQLite datetime modifier that shifts a
// stored UTC timestamp into the reviewer's local time.
func reviewDay(offset int) (day string, seed int64, mod string) {
	local := time.Now().UTC().Add(time.Duration(offset) * time.Minute)
	return local.Format("2006-01-02"), local.Unix() / 86400, fmt.Sprintf("%+d minutes", offset)
}

// reviewCandidates is the WHERE clause of the deck: the caller's annotations
// that are unseen, or due (elapsed >= stability), and not already touched
// today (local). Args: user id, tz modifier, local day.
const reviewCandidates = `
	FROM annotations a
	JOIN books b ON b.id = a.book_id
	LEFT JOIN annotation_reviews r ON r.annotation_id = a.id
	WHERE b.user_id = ?
	  AND (r.annotation_id IS NULL OR date(r.last_touched_at, ?) <> ?)
	  AND (r.last_reviewed_at IS NULL
	       OR julianday('now') - julianday(r.last_reviewed_at) >= r.stability)`

// reviewedToday counts cards touched (answered or skipped) in the local day —
// the day's spent quota — plus the got/forgot split for the done-state copy
// ("2 recalled · 1 to resurface"). Args: user id, tz modifier, local day.
const reviewedToday = `
	SELECT COUNT(*),
	       COALESCE(SUM(r.last_result = 'got'), 0),
	       COALESCE(SUM(r.last_result = 'forgot'), 0)
	FROM annotation_reviews r
	JOIN annotations a ON a.id = r.annotation_id
	JOIN books b ON b.id = a.book_id
	WHERE b.user_id = ? AND date(r.last_touched_at, ?) = ?`

// reviewStates counts the caller's annotations by revision state — unseen (no
// review row yet) and the three mastery buckets derived from the memory
// half-life (soon <7d, later 7–30d, someday ≥30d). Powers the Home "where your
// review stands" readout and the quiz's mastery weighting.
type reviewStateCounts struct {
	Unseen  int `json:"unseen"`
	Soon    int `json:"soon"`
	Later   int `json:"later"`
	Someday int `json:"someday"`
	Total   int `json:"total"`
}

func (s *Server) reviewStates(uid int64) (reviewStateCounts, error) {
	var c reviewStateCounts
	err := s.Store.DB.QueryRow(`
		SELECT
			COALESCE(SUM(r.annotation_id IS NULL), 0),
			COALESCE(SUM(r.annotation_id IS NOT NULL AND r.stability < 7), 0),
			COALESCE(SUM(r.stability >= 7 AND r.stability < 30), 0),
			COALESCE(SUM(r.stability >= 30), 0),
			COUNT(*)
		FROM annotations a
		JOIN books b ON b.id = a.book_id
		LEFT JOIN annotation_reviews r ON r.annotation_id = a.id
		WHERE b.user_id = ?`, uid).Scan(&c.Unseen, &c.Soon, &c.Later, &c.Someday, &c.Total)
	return c, err
}

// reviewDeckCounts returns how many cards were already touched today and how
// many remain in today's deck (candidates capped by the unspent quota).
func (s *Server) reviewDeckCounts(uid int64, offset, quota int) (touched, remaining int, err error) {
	day, _, mod := reviewDay(offset)
	var got, forgot int
	if err := s.Store.DB.QueryRow(reviewedToday, uid, mod, day).Scan(&touched, &got, &forgot); err != nil {
		return 0, 0, err
	}
	slots := quota - touched
	if slots <= 0 {
		return touched, 0, nil
	}
	var candidates int
	if err := s.Store.DB.QueryRow(`SELECT COUNT(*)`+reviewCandidates, uid, mod, day).Scan(&candidates); err != nil {
		return 0, 0, err
	}
	if candidates < slots {
		return touched, candidates, nil
	}
	return touched, slots, nil
}

type reviewItem struct {
	ID          int64   `json:"id"`
	BookID      int64   `json:"book_id"`
	Quote       string  `json:"quote"`
	Note        string  `json:"note"`
	Color       string  `json:"color"`
	Chapter     string  `json:"chapter"`
	Location    string  `json:"location"`
	Favorite    bool    `json:"favorite"`
	Rating      int     `json:"rating"`
	NotedAt     string  `json:"noted_at"`
	BookTitle   string  `json:"book_title"`
	BookAuthor  string  `json:"book_author"`
	Stability   float64 `json:"stability"`
	ReviewCount int     `json:"review_count"`
	Mastery     string  `json:"mastery"`
}

// handleDailyReview serves GET /annotations/daily-review?offset=N — the rest
// of today's deck: due cards first (most forgotten first), then unseen cards
// in a per-day shuffle, capped at the unspent quota. An empty pool or a spent
// quota both come back as items: [] with the day's tally alongside.
func (s *Server) handleDailyReview(w http.ResponseWriter, r *http.Request) {
	offset, ok := tzOffset(r.URL.Query().Get("offset"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "offset must be UTC offset minutes between -720 and 840")
		return
	}
	uid := userID(r)
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "daily review prefs", err)
		return
	}
	day, seed, mod := reviewDay(offset)
	var touched, got, forgot int
	if err := s.Store.DB.QueryRow(reviewedToday, uid, mod, day).Scan(&touched, &got, &forgot); err != nil {
		internalError(w, r, "daily review count", err)
		return
	}
	items := []reviewItem{}
	if slots := pf.SRDaily - touched; slots > 0 {
		// Due cards first, deepest-forgotten first (elapsed/stability is
		// monotonic in decayed recall probability — no pow() needed); unseen
		// cards fill the rest in a shuffle that is stable within a day.
		rows, err := s.Store.DB.Query(`
			SELECT a.id, a.book_id, COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color,
			       COALESCE(a.chapter, ''), COALESCE(a.location, ''), a.favorite, a.rating,
			       COALESCE(a.noted_at, ''), b.title, COALESCE(b.author, ''),
			       COALESCE(r.stability, ?), COALESCE(r.review_count, 0)`+reviewCandidates+`
			ORDER BY (r.last_reviewed_at IS NULL),
			         CASE WHEN r.last_reviewed_at IS NULL
			              THEN (a.id * 2654435761 + ?) % 100003
			              ELSE (julianday(r.last_reviewed_at) - julianday('now')) / r.stability
			         END,
			         a.id
			LIMIT ?`, reviewMinStability, uid, mod, day, seed, slots)
		if err != nil {
			internalError(w, r, "daily review deck", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var it reviewItem
			if err := rows.Scan(&it.ID, &it.BookID, &it.Quote, &it.Note, &it.Color,
				&it.Chapter, &it.Location, &it.Favorite, &it.Rating, &it.NotedAt,
				&it.BookTitle, &it.BookAuthor, &it.Stability, &it.ReviewCount); err == nil {
				it.Mastery = reviewMastery(it.Stability)
				items = append(items, it)
			}
		}
	}
	states, err := s.reviewStates(uid)
	if err != nil {
		internalError(w, r, "daily review states", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":          items,
		"reviewed_today": touched,
		"got_today":      got,
		"forgot_today":   forgot,
		"quota":          pf.SRDaily,
		"states":         states,
	})
}

// handleReviewAnnotation serves POST /annotations/{id}/review with
// {"result": "got"|"forgot"|"skip", "offset": N}. It upserts the card's
// review state and answers with the new half-life plus what's left of
// today's deck, so the client can advance and keep its pending dot honest.
func (s *Server) handleReviewAnnotation(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid annotation id")
		return
	}
	var req struct {
		Result string `json:"result"`
		Offset *int   `json:"offset"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Result != "got" && req.Result != "forgot" && req.Result != "skip" {
		writeErr(w, http.StatusBadRequest, "result must be got, forgot or skip")
		return
	}
	offset := 0
	if req.Offset != nil {
		if *req.Offset < -720 || *req.Offset > 840 {
			writeErr(w, http.StatusBadRequest, "offset must be UTC offset minutes between -720 and 840")
			return
		}
		offset = *req.Offset
	}
	uid := userID(r)
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "review prefs", err)
		return
	}
	var owned bool
	if err := s.Store.DB.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM annotations a JOIN books b ON b.id = a.book_id
		              WHERE a.id = ? AND b.user_id = ?)`, id, uid).Scan(&owned); err != nil {
		internalError(w, r, "review ownership", err)
		return
	}
	if !owned { // someone else's annotation looks identical to a missing one
		writeErr(w, http.StatusNotFound, "annotation not found")
		return
	}

	day, _, mod := reviewDay(offset)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "review begin", err)
		return
	}
	defer tx.Rollback()
	stability := reviewMinStability
	var lastReviewed sql.NullString
	var touchedToday bool
	found := true
	err = tx.QueryRow(`SELECT stability, last_reviewed_at, COALESCE(date(last_touched_at, ?) = ?, 0)
	                   FROM annotation_reviews WHERE annotation_id = ?`, mod, day, id).
		Scan(&stability, &lastReviewed, &touchedToday)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		found = false
	case err != nil:
		internalError(w, r, "review state", err)
		return
	}
	// Idempotency guard: the deck query already excludes cards touched today,
	// so a well-behaved client never re-answers one. A stale second device (or
	// a retried POST) could, though — and re-applying the growth would compound
	// stability (1→2.5→6.25) and double-count the tally. Treat a same-day
	// got/forgot repeat as a no-op that echoes the stored state.
	if found && touchedToday && req.Result != "skip" {
		touched, remaining, err := s.reviewDeckCounts(uid, offset, pf.SRDaily)
		if err != nil {
			internalError(w, r, "review counts", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok": true, "result": req.Result, "stability": stability,
			"mastery": reviewMastery(stability), "remaining": remaining,
			"reviewed_today": touched, "quota": pf.SRDaily,
		})
		return
	}
	if req.Result != "skip" {
		elapsed := 0.0
		if lastReviewed.Valid {
			if t, err := time.Parse("2006-01-02 15:04:05", lastReviewed.String); err == nil {
				elapsed = time.Since(t).Hours() / 24
			}
		}
		if req.Result == "got" {
			stability *= pf.SRGrow
			if late := elapsed * reviewLateBonus; late > stability {
				stability = late
			}
			stability = min(stability, reviewMaxStability)
		} else {
			stability = max(stability*pf.SRShrink, reviewMinStability)
		}
	}
	if found {
		q := `UPDATE annotation_reviews SET last_result = ?, last_touched_at = datetime('now')`
		if req.Result != "skip" {
			q += `, stability = ` + strconv.FormatFloat(stability, 'f', -1, 64) +
				`, last_reviewed_at = datetime('now'), review_count = review_count + 1`
			if req.Result == "forgot" {
				q += `, lapse_count = lapse_count + 1`
			}
		}
		_, err = tx.Exec(q+` WHERE annotation_id = ?`, req.Result, id)
	} else if req.Result == "skip" {
		_, err = tx.Exec(`INSERT INTO annotation_reviews (annotation_id, last_result, last_touched_at)
		                  VALUES (?, ?, datetime('now'))`, id, req.Result)
	} else {
		_, err = tx.Exec(`
			INSERT INTO annotation_reviews (annotation_id, stability, review_count, lapse_count,
			                                last_result, last_reviewed_at, last_touched_at)
			VALUES (?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
			id, stability, boolToInt(req.Result == "forgot"), req.Result)
	}
	if err != nil {
		internalError(w, r, "review upsert", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "review commit", err)
		return
	}

	touched, remaining, err := s.reviewDeckCounts(uid, offset, pf.SRDaily)
	if err != nil {
		internalError(w, r, "review counts", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"result":         req.Result,
		"stability":      stability,
		"mastery":        reviewMastery(stability),
		"remaining":      remaining,
		"reviewed_today": touched,
		"quota":          pf.SRDaily,
	})
}
