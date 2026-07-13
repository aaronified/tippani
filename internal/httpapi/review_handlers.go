package httpapi

// Spaced repetition — Daily Quiz & Practice (v0.5.0 rework, ROADMAP №2).
//
// One retrieval model, two modes, over every quote in the library AND the
// catalogue (books via annotations, films/shows via dialogues). Each card is
// presented in one of two directions:
//
//   source — show the quote, recall which book/film/show it's from.
//   quote  — show the book/film/show, recall a quote from it.
//
// The flow is self-graded: present → attempt recall → reveal → grade. There is
// no multiple choice; the user is trusted to grade honestly (that is the point
// of retrieval practice). Grades:
//
//   got    — successful recall; grows the card's half-life.
//   forgot — a lapse; shrinks it without a hard reset.
//   skip   — Practice only; benches the card, never touches the schedule.
//
// Daily Quiz is the authoritative scheduler: due cards only, no skip, every
// answer recorded, always moves the half-life. Practice is unlimited and
// skippable and by DEFAULT does not move the schedule (the srPracticeCounts
// preference opts in). Scores are logged per reviewer-local day per mode in
// quiz_sessions — daily rows are permanent history + streaks, practice rows are
// the separate resettable practice score.
//
// The memory model is the exponential forgetting curve: recall probability
// p = 2^(-elapsed_days / stability), stability being the per-card half-life in
// days (item_reviews, migration 0015). A card is due when p <= 0.5 (elapsed >=
// stability). The derived status shown on every card's dot:
//   remembered         p >= 0.9   (well inside the half-life)
//   forgetting         0.5 <= p < 0.9
//   probably-forgotten p < 0.5     (due / overdue)
//   unseen             never reviewed
// Statuses are derived at read time, never stored.

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"
	"sort"
	"strconv"
	"time"

	"tippani/internal/olog"
)

const (
	reviewMinStability = 1.0   // days; half-life floor and the unseen-card default
	reviewMaxStability = 365.0 // days; growth cap
	reviewGrowth       = 2.5   // default srGrow: "got it" multiplies the half-life
	reviewLateBonus    = 1.2   // a late recall proves stability >= elapsed — credit it
	reviewLapseShrink  = 0.25  // default srShrink: "forgot" keeps this fraction, not zero
	reviewQuota        = 8     // default srDaily deck size
)

// review directions (question types). Kept as constants so the deck builder and
// tests speak the same vocabulary the client renders against.
const (
	dirSource = "source" // show quote, recall the book/film/show
	dirQuote  = "quote"  // show the book/film/show, recall the quote
)

// item kinds in item_reviews.
const (
	kindBook   = "book"   // annotations
	kindScreen = "screen" // dialogues (films + shows)
)

// tzOffset parses the client's UTC offset in minutes, east positive (JS:
// -new Date().getTimezoneOffset()). It makes "today" the reviewer's local day;
// the client sends its current offset per request, so DST is its problem, not
// ours. Absent/empty means UTC.
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

// reviewDay returns the reviewer's local date ("YYYY-MM-DD"), a per-day shuffle
// seed, and the SQLite datetime modifier that shifts a stored UTC timestamp
// into the reviewer's local time.
func reviewDay(offset int) (day string, seed int64, mod string) {
	local := time.Now().UTC().Add(time.Duration(offset) * time.Minute)
	return local.Format("2006-01-02"), local.Unix() / 86400, fmt.Sprintf("%+d minutes", offset)
}

// scopeFlags turns the srReviewScope preference into which pools to draw from.
// Legacy stored value "movies" is honoured as the screen (films+shows) scope.
func scopeFlags(scope string) (books, screen bool) {
	switch scope {
	case "books":
		return true, false
	case "movies", "screen":
		return false, true
	default: // "both" and anything unexpected
		return true, true
	}
}

// recallStatus derives a card's status dot from its half-life and how long it's
// been since the last review. Unseen cards (no review row) have no probability.
func recallStatus(seen bool, stability, elapsedDays float64) string {
	if !seen {
		return "unseen"
	}
	if stability < reviewMinStability {
		stability = reviewMinStability
	}
	p := math.Pow(2, -elapsedDays/stability)
	switch {
	case p >= 0.9:
		return "remembered"
	case p >= 0.5:
		return "forgetting"
	default:
		return "probably-forgotten"
	}
}

// dailyDirection picks a card's question type for the day, deterministically so
// a refresh shows the same one. Practice varies it at random instead.
func dailyDirection(kind string, id, seed int64) string {
	if shuffleKey(kind, id, seed)%2 == 0 {
		return dirSource
	}
	return dirQuote
}

// shuffleKey is a stable per-day pseudo-random ordering key for a card; the
// kind salt keeps a book id and a dialogue id from colliding.
func shuffleKey(kind string, id, seed int64) int64 {
	salt := uint64(2166136261)
	if kind == kindScreen {
		salt = 1013904223
	}
	return int64((uint64(id)*2654435761 + salt + uint64(seed)) % 100003)
}

// reviewCard is one card sent to the client. It carries both sides (prompt +
// answer); the client shows one and reveals the other per `direction`.
type reviewCard struct {
	Kind        string  `json:"kind"`      // book | screen
	ID          int64   `json:"id"`
	Direction   string  `json:"direction"` // source | quote
	Quote       string  `json:"quote"`
	Note        string  `json:"note"`
	Color       string  `json:"color"`      // book highlight colour; "" for screen
	Title       string  `json:"title"`      // book / film / show title
	Author      string  `json:"author"`     // book author; "" for screen
	Character   string  `json:"character"`  // screen speaker; "" for book
	Chapter     string  `json:"chapter"`    // book only
	Location    string  `json:"location"`   // book only
	Timestamp   string  `json:"timestamp"`  // screen only
	MediaType   string  `json:"media_type"` // movie | show (screen); "" for book
	Stability   float64 `json:"stability"`
	ReviewCount int     `json:"review_count"`
	Status      string  `json:"status"`
}

// reviewCand wraps a card with the transient scheduling facts (whether it's
// been seen and how long since) used to order and grade it.
type reviewCand struct {
	card    reviewCard
	seen    bool
	elapsed float64 // days since last_reviewed_at (seen cards only)
}

func elapsedDays(ts sql.NullString) float64 {
	if !ts.Valid {
		return 0
	}
	if t, err := time.Parse("2006-01-02 15:04:05", ts.String); err == nil {
		return time.Since(t).Hours() / 24
	}
	return 0
}

// bookCandidates / screenCandidates fetch reviewable cards. dueOnly=true (Daily
// Quiz) keeps only unseen or due cards not already answered today, ordered
// most-forgotten-first and capped; dueOnly=false (Practice) returns the whole
// in-scope pool for the client to shuffle and walk.
func (s *Server) bookCandidates(uid int64, dueOnly bool, mod, day string, limit int) ([]reviewCand, error) {
	q := `SELECT a.id, COALESCE(a.quote,''), COALESCE(a.note,''), a.color,
	             b.title, COALESCE(b.author,''), COALESCE(a.chapter,''), COALESCE(a.location,''),
	             r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count,0), r.last_reviewed_at
	      FROM annotations a
	      JOIN books b ON b.id = a.book_id
	      LEFT JOIN item_reviews r ON r.kind = 'book' AND r.item_id = a.id
	      WHERE b.user_id = ? AND (COALESCE(a.quote,'') <> '' OR COALESCE(a.note,'') <> '')`
	args := []any{reviewMinStability, uid}
	if dueOnly {
		q += ` AND (r.item_id IS NULL OR date(r.last_touched_at, ?) <> ?)
		       AND (r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= r.stability)
		       ORDER BY (r.last_reviewed_at IS NULL), (julianday(r.last_reviewed_at) - julianday('now')) / r.stability`
		args = append(args, mod, day)
		if limit > 0 {
			q += ` LIMIT ?`
			args = append(args, limit)
		}
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []reviewCand
	for rows.Next() {
		var c reviewCand
		var lr sql.NullString
		c.card.Kind = kindBook
		if err := rows.Scan(&c.card.ID, &c.card.Quote, &c.card.Note, &c.card.Color,
			&c.card.Title, &c.card.Author, &c.card.Chapter, &c.card.Location,
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &lr); err != nil {
			continue
		}
		c.elapsed = elapsedDays(lr)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Server) screenCandidates(uid int64, dueOnly bool, mod, day string, limit int) ([]reviewCand, error) {
	q := `SELECT d.id, COALESCE(d.quote,''), COALESCE(d.note,''), m.title, COALESCE(d.character,''),
	             COALESCE(d.timestamp,''), COALESCE(m.media_type,'movie'),
	             r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count,0), r.last_reviewed_at
	      FROM dialogues d
	      JOIN movies m ON m.id = d.movie_id
	      LEFT JOIN item_reviews r ON r.kind = 'screen' AND r.item_id = d.id
	      WHERE m.user_id = ? AND (COALESCE(d.quote,'') <> '' OR COALESCE(d.note,'') <> '')`
	args := []any{reviewMinStability, uid}
	if dueOnly {
		q += ` AND (r.item_id IS NULL OR date(r.last_touched_at, ?) <> ?)
		       AND (r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= r.stability)
		       ORDER BY (r.last_reviewed_at IS NULL), (julianday(r.last_reviewed_at) - julianday('now')) / r.stability`
		args = append(args, mod, day)
		if limit > 0 {
			q += ` LIMIT ?`
			args = append(args, limit)
		}
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []reviewCand
	for rows.Next() {
		var c reviewCand
		var lr sql.NullString
		c.card.Kind = kindScreen
		if err := rows.Scan(&c.card.ID, &c.card.Quote, &c.card.Note, &c.card.Title, &c.card.Character,
			&c.card.Timestamp, &c.card.MediaType,
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &lr); err != nil {
			continue
		}
		c.elapsed = elapsedDays(lr)
		out = append(out, c)
	}
	return out, rows.Err()
}

// finish stamps a candidate's derived fields (direction + status) and returns
// the client-facing card.
func finishCard(c reviewCand, direction string) reviewCard {
	card := c.card
	card.Direction = direction
	card.Status = recallStatus(c.seen, card.Stability, c.elapsed)
	return card
}

// handleDailyQuiz serves GET /review/daily?offset=N — the rest of today's due
// deck: most-forgotten cards first, then unseen ones in a per-day shuffle,
// capped at the unspent daily quota, across the configured scope. An empty pool
// or a spent quota both come back as items: [] with today's tally alongside.
func (s *Server) handleDailyQuiz(w http.ResponseWriter, r *http.Request) {
	offset, ok := tzOffset(r.URL.Query().Get("offset"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "offset must be UTC offset minutes between -720 and 840")
		return
	}
	uid := userID(r)
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "daily quiz prefs", err)
		return
	}
	incBooks, incScreen := scopeFlags(pf.SRReviewScope)
	day, seed, mod := reviewDay(offset)
	answered, got, forgot, err := s.dailyTally(uid, day)
	if err != nil {
		internalError(w, r, "daily quiz tally", err)
		return
	}
	items := []reviewCard{}
	if slots := pf.SRDaily - answered; slots > 0 {
		var cands []reviewCand
		if incBooks {
			bc, err := s.bookCandidates(uid, true, mod, day, slots)
			if err != nil {
				internalError(w, r, "daily quiz books", err)
				return
			}
			cands = append(cands, bc...)
		}
		if incScreen {
			sc, err := s.screenCandidates(uid, true, mod, day, slots)
			if err != nil {
				internalError(w, r, "daily quiz screen", err)
				return
			}
			cands = append(cands, sc...)
		}
		// Seen-due first (most overdue first), then unseen in a per-day shuffle.
		sort.SliceStable(cands, func(i, j int) bool {
			a, b := cands[i], cands[j]
			if a.seen != b.seen {
				return a.seen
			}
			if a.seen {
				return a.elapsed/max(a.card.Stability, reviewMinStability) >
					b.elapsed/max(b.card.Stability, reviewMinStability)
			}
			return shuffleKey(a.card.Kind, a.card.ID, seed) < shuffleKey(b.card.Kind, b.card.ID, seed)
		})
		if len(cands) > slots {
			cands = cands[:slots]
		}
		for _, c := range cands {
			items = append(items, finishCard(c, dailyDirection(c.card.Kind, c.card.ID, seed)))
		}
	}
	states, err := s.reviewStates(uid, incBooks, incScreen)
	if err != nil {
		internalError(w, r, "daily quiz states", err)
		return
	}
	streak, err := s.dailyStreak(uid, day)
	if err != nil {
		internalError(w, r, "daily quiz streak", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":          items,
		"answered_today": answered,
		"got_today":      got,
		"forgot_today":   forgot,
		"quota":          pf.SRDaily,
		"streak":         streak,
		"states":         states,
	})
}

// handlePractice serves GET /review/practice?offset=N — the whole in-scope pool
// as cards for the client to shuffle and walk, with a random direction each.
// Practice never filters by due-ness and never benches cards; the client tracks
// its own position and honours Skip locally.
func (s *Server) handlePractice(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "practice prefs", err)
		return
	}
	incBooks, incScreen := scopeFlags(pf.SRReviewScope)
	var cands []reviewCand
	if incBooks {
		bc, err := s.bookCandidates(uid, false, "", "", 0)
		if err != nil {
			internalError(w, r, "practice books", err)
			return
		}
		cands = append(cands, bc...)
	}
	if incScreen {
		sc, err := s.screenCandidates(uid, false, "", "", 0)
		if err != nil {
			internalError(w, r, "practice screen", err)
			return
		}
		cands = append(cands, sc...)
	}
	rand.Shuffle(len(cands), func(i, j int) { cands[i], cands[j] = cands[j], cands[i] })
	items := make([]reviewCard, 0, len(cands))
	dirs := []string{dirSource, dirQuote}
	for _, c := range cands {
		items = append(items, finishCard(c, dirs[rand.IntN(2)]))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "pool": len(items)})
}

// handleReviewAnswer grades one card. POST /review/answer with
// {"kind","id","result","mode","offset"}. mode="daily" always folds the grade
// into the schedule (and enforces one answer per card per day); mode="practice"
// only moves the schedule when srPracticeCounts is on, and allows skip. Every
// non-skip answer is tallied into that mode's session for the local day.
func (s *Server) handleReviewAnswer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind   string `json:"kind"`
		ID     int64  `json:"id"`
		Result string `json:"result"`
		Mode   string `json:"mode"`
		Offset *int   `json:"offset"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Kind != kindBook && req.Kind != kindScreen {
		writeErr(w, http.StatusBadRequest, "kind must be book or screen")
		return
	}
	if req.Mode != "daily" && req.Mode != "practice" {
		writeErr(w, http.StatusBadRequest, "mode must be daily or practice")
		return
	}
	switch req.Result {
	case "got", "forgot":
	case "skip":
		if req.Mode != "practice" {
			writeErr(w, http.StatusBadRequest, "skip is only allowed in practice")
			return
		}
	default:
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
		internalError(w, r, "review answer prefs", err)
		return
	}
	owned, err := s.ownsItem(uid, req.Kind, req.ID)
	if err != nil {
		internalError(w, r, "review answer ownership", err)
		return
	}
	if !owned { // someone else's item is indistinguishable from a missing one
		writeErr(w, http.StatusNotFound, "item not found")
		return
	}

	day, _, mod := reviewDay(offset)
	// Daily Quiz always drives the schedule; Practice only when opted in. Skip
	// never moves it in either mode.
	moveSchedule := (req.Mode == "daily" || pf.SRPracticeCounts) && req.Result != "skip"

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "review answer begin", err)
		return
	}
	defer tx.Rollback()

	stability := reviewMinStability
	var lastReviewed sql.NullString
	var touchedToday bool
	found := true
	err = tx.QueryRow(`SELECT stability, last_reviewed_at, COALESCE(date(last_touched_at, ?) = ?, 0)
	                   FROM item_reviews WHERE kind = ? AND item_id = ?`, mod, day, req.Kind, req.ID).
		Scan(&stability, &lastReviewed, &touchedToday)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		found = false
	case err != nil:
		internalError(w, r, "review answer state", err)
		return
	}

	// Daily idempotency: the deck already excludes cards answered today, so a
	// well-behaved client never re-answers one. A stale second device or a
	// retried POST could, and re-applying growth would compound the half-life
	// and double-count the tally. Treat a same-day repeat as a no-op echo.
	if req.Mode == "daily" && found && touchedToday {
		s.answerResponse(w, r, uid, req.Mode, offset, req.Kind, req.ID, stability, lastReviewed, pf, found)
		return
	}

	if moveSchedule {
		elapsed := elapsedDays(lastReviewed)
		if req.Result == "got" {
			stability *= pf.SRGrow
			if late := elapsed * reviewLateBonus; late > stability {
				stability = late
			}
			stability = min(stability, reviewMaxStability)
		} else { // forgot
			stability = max(stability*pf.SRShrink, reviewMinStability)
		}
		if found {
			q := `UPDATE item_reviews SET stability = ?, review_count = review_count + 1,
			       last_result = ?, last_reviewed_at = datetime('now'), last_touched_at = datetime('now')`
			if req.Result == "forgot" {
				q += `, lapse_count = lapse_count + 1`
			}
			q += ` WHERE kind = ? AND item_id = ?`
			_, err = tx.Exec(q, stability, req.Result, req.Kind, req.ID)
		} else {
			_, err = tx.Exec(`INSERT INTO item_reviews (kind, item_id, stability, review_count, lapse_count,
			                  last_result, last_reviewed_at, last_touched_at)
			                  VALUES (?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
				req.Kind, req.ID, stability, boolToInt(req.Result == "forgot"), req.Result)
		}
		if err != nil {
			internalError(w, r, "review answer upsert", err)
			return
		}
	}

	// Tally the answer into this mode's session for the local day (skips are not
	// answers, so they log nothing).
	if req.Result != "skip" {
		if _, err := tx.Exec(`INSERT INTO quiz_sessions (user_id, mode, day, answered, got, forgot, taken_at)
		                      VALUES (?, ?, ?, 1, ?, ?, datetime('now'))
		                      ON CONFLICT(user_id, mode, day) DO UPDATE SET
		                        answered = answered + 1,
		                        got = got + excluded.got,
		                        forgot = forgot + excluded.forgot,
		                        taken_at = datetime('now')`,
			uid, req.Mode, day, boolToInt(req.Result == "got"), boolToInt(req.Result == "forgot")); err != nil {
			internalError(w, r, "review answer tally", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "review answer commit", err)
		return
	}
	// Status for the reply: a card whose schedule just moved is freshly reviewed
	// (elapsed 0 → remembered); one that didn't move (Practice not counting)
	// keeps its real last-review time so the dot stays honest.
	respLastReviewed := lastReviewed
	if moveSchedule {
		respLastReviewed = sql.NullString{}
	}
	s.answerResponse(w, r, uid, req.Mode, offset, req.Kind, req.ID, stability, respLastReviewed, pf, found || moveSchedule)
}

// answerResponse assembles the reply shared by the normal path and the daily
// no-op echo: the card's new status + half-life, the mode's day tally, and (for
// daily) how much of today's deck is left so the pending dot stays honest.
func (s *Server) answerResponse(w http.ResponseWriter, r *http.Request, uid int64, mode string, offset int,
	kind string, id int64, stability float64, lastReviewed sql.NullString, pf prefs, seen bool) {
	day, _, _ := reviewDay(offset)
	answered, got, forgot, err := s.modeTally(uid, mode, day)
	if err != nil {
		internalError(w, r, "review answer response tally", err)
		return
	}
	out := map[string]any{
		"ok":        true,
		"kind":      kind,
		"id":        id,
		"stability": stability,
		"status":    recallStatus(seen, stability, elapsedDays(lastReviewed)),
		"mode":      mode,
		"answered":  answered,
		"got":       got,
		"forgot":    forgot,
	}
	if mode == "daily" {
		remaining, err := s.dailyRemaining(uid, offset, pf, answered)
		if err != nil {
			internalError(w, r, "review answer remaining", err)
			return
		}
		out["remaining"] = remaining
	}
	writeJSON(w, http.StatusOK, out)
}

// ownsItem verifies the caller owns the annotation/dialogue behind a card
// (item_reviews has no user_id of its own).
func (s *Server) ownsItem(uid int64, kind string, id int64) (bool, error) {
	q := `SELECT EXISTS(SELECT 1 FROM annotations a JOIN books b ON b.id = a.book_id WHERE a.id = ? AND b.user_id = ?)`
	if kind == kindScreen {
		q = `SELECT EXISTS(SELECT 1 FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE d.id = ? AND m.user_id = ?)`
	}
	var ok bool
	err := s.Store.DB.QueryRow(q, id, uid).Scan(&ok)
	return ok, err
}

// modeTally reads a mode's answered/got/forgot for the local day (all zero when
// there's no session yet).
func (s *Server) modeTally(uid int64, mode, day string) (answered, got, forgot int, err error) {
	err = s.Store.DB.QueryRow(`SELECT answered, got, forgot FROM quiz_sessions
	                           WHERE user_id = ? AND mode = ? AND day = ?`, uid, mode, day).
		Scan(&answered, &got, &forgot)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, 0, 0, nil
	}
	return answered, got, forgot, err
}

func (s *Server) dailyTally(uid int64, day string) (int, int, int, error) {
	return s.modeTally(uid, "daily", day)
}

// dailyRemaining is how many due cards are left in today's deck: the in-scope
// candidate pool capped by the unspent quota.
func (s *Server) dailyRemaining(uid int64, offset int, pf prefs, answered int) (int, error) {
	slots := pf.SRDaily - answered
	if slots <= 0 {
		return 0, nil
	}
	incBooks, incScreen := scopeFlags(pf.SRReviewScope)
	day, _, mod := reviewDay(offset)
	total := 0
	countOne := func(table, parent, parentKey, userCol, kind string) error {
		q := `SELECT COUNT(*) FROM ` + table + ` x
		      JOIN ` + parent + ` p ON p.id = x.` + parentKey + `
		      LEFT JOIN item_reviews r ON r.kind = '` + kind + `' AND r.item_id = x.id
		      WHERE p.` + userCol + ` = ? AND (COALESCE(x.quote,'') <> '' OR COALESCE(x.note,'') <> '')
		        AND (r.item_id IS NULL OR date(r.last_touched_at, ?) <> ?)
		        AND (r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= r.stability)`
		var n int
		if err := s.Store.DB.QueryRow(q, uid, mod, day).Scan(&n); err != nil {
			return err
		}
		total += n
		return nil
	}
	if incBooks {
		if err := countOne("annotations", "books", "book_id", "user_id", kindBook); err != nil {
			return 0, err
		}
	}
	if incScreen {
		if err := countOne("dialogues", "movies", "movie_id", "user_id", kindScreen); err != nil {
			return 0, err
		}
	}
	return min(total, slots), nil
}

// statusCounts is the "where you stand" breakdown across the in-scope library.
type statusCounts struct {
	Unseen            int `json:"unseen"`
	Remembered        int `json:"remembered"`
	Forgetting        int `json:"forgetting"`
	ProbablyForgotten int `json:"probably_forgotten"`
	Total             int `json:"total"`
}

// reviewStates counts every in-scope quote by its derived status. Computed in
// Go (recall probability needs pow) over the two small columns per item.
func (s *Server) reviewStates(uid int64, incBooks, incScreen bool) (statusCounts, error) {
	var c statusCounts
	tally := func(table, parent, parentKey, userCol, kind string) error {
		rows, err := s.Store.DB.Query(`
			SELECT r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at
			FROM `+table+` x
			JOIN `+parent+` p ON p.id = x.`+parentKey+`
			LEFT JOIN item_reviews r ON r.kind = '`+kind+`' AND r.item_id = x.id
			WHERE p.`+userCol+` = ? AND (COALESCE(x.quote,'') <> '' OR COALESCE(x.note,'') <> '')`,
			reviewMinStability, uid)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var seen bool
			var stability float64
			var lr sql.NullString
			if err := rows.Scan(&seen, &stability, &lr); err != nil {
				continue
			}
			c.Total++
			switch recallStatus(seen, stability, elapsedDays(lr)) {
			case "unseen":
				c.Unseen++
			case "remembered":
				c.Remembered++
			case "forgetting":
				c.Forgetting++
			default:
				c.ProbablyForgotten++
			}
		}
		return rows.Err()
	}
	if incBooks {
		if err := tally("annotations", "books", "book_id", "user_id", kindBook); err != nil {
			return c, err
		}
	}
	if incScreen {
		if err := tally("dialogues", "movies", "movie_id", "user_id", kindScreen); err != nil {
			return c, err
		}
	}
	return c, nil
}

// dailyStreak counts consecutive local days with a completed Daily Quiz session,
// ending today (or yesterday, so an as-yet-undone today doesn't zero a run).
func (s *Server) dailyStreak(uid int64, today string) (int, error) {
	rows, err := s.Store.DB.Query(`SELECT day FROM quiz_sessions
	                               WHERE user_id = ? AND mode = 'daily' AND answered > 0`, uid)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	days := map[string]bool{}
	for rows.Next() {
		var d string
		if rows.Scan(&d) == nil {
			days[d] = true
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	cur, err := time.Parse("2006-01-02", today)
	if err != nil {
		return 0, nil
	}
	if !days[today] { // today not done yet — anchor the streak on yesterday
		cur = cur.AddDate(0, 0, -1)
	}
	streak := 0
	for days[cur.Format("2006-01-02")] {
		streak++
		cur = cur.AddDate(0, 0, -1)
	}
	return streak, nil
}

// handleReviewScores serves GET /review/scores?offset=N — the Daily Quiz score
// (today + streak + lifetime days) and the separate Practice score (lifetime
// totals + sessions), plus the library-wide status breakdown.
func (s *Server) handleReviewScores(w http.ResponseWriter, r *http.Request) {
	offset, ok := tzOffset(r.URL.Query().Get("offset"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "offset must be UTC offset minutes between -720 and 840")
		return
	}
	uid := userID(r)
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "scores prefs", err)
		return
	}
	incBooks, incScreen := scopeFlags(pf.SRReviewScope)
	day, _, _ := reviewDay(offset)

	dAnswered, dGot, dForgot, err := s.dailyTally(uid, day)
	if err != nil {
		internalError(w, r, "scores daily", err)
		return
	}
	streak, err := s.dailyStreak(uid, day)
	if err != nil {
		internalError(w, r, "scores streak", err)
		return
	}
	remaining, err := s.dailyRemaining(uid, offset, pf, dAnswered)
	if err != nil {
		internalError(w, r, "scores remaining", err)
		return
	}
	var dailyDays int
	if err := s.Store.DB.QueryRow(`SELECT COUNT(*) FROM quiz_sessions
	                               WHERE user_id = ? AND mode = 'daily' AND answered > 0`, uid).Scan(&dailyDays); err != nil {
		internalError(w, r, "scores daily days", err)
		return
	}

	var pAnswered, pGot, pForgot, pSessions int
	if err := s.Store.DB.QueryRow(`SELECT COALESCE(SUM(answered),0), COALESCE(SUM(got),0),
	                               COALESCE(SUM(forgot),0), COUNT(*)
	                               FROM quiz_sessions WHERE user_id = ? AND mode = 'practice'`, uid).
		Scan(&pAnswered, &pGot, &pForgot, &pSessions); err != nil {
		internalError(w, r, "scores practice", err)
		return
	}

	states, err := s.reviewStates(uid, incBooks, incScreen)
	if err != nil {
		internalError(w, r, "scores states", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"daily": map[string]any{
			"answered":  dAnswered,
			"got":       dGot,
			"forgot":    dForgot,
			"accuracy":  accuracy(dGot, dAnswered),
			"streak":    streak,
			"days":      dailyDays,
			"remaining": remaining,
			"quota":     pf.SRDaily,
		},
		"practice": map[string]any{
			"answered": pAnswered,
			"got":      pGot,
			"forgot":   pForgot,
			"accuracy": accuracy(pGot, pAnswered),
			"sessions": pSessions,
		},
		"states": states,
	})
}

func accuracy(got, answered int) float64 {
	if answered <= 0 {
		return 0
	}
	return float64(got) / float64(answered)
}

// handlePracticeReset clears the Practice score. DELETE /review/practice. The
// spaced-repetition schedule (item_reviews) and the Daily Quiz history are
// untouched — only the resettable practice tally goes.
func (s *Server) handlePracticeReset(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	res, err := s.Store.DB.Exec(`DELETE FROM quiz_sessions WHERE user_id = ? AND mode = 'practice'`, uid)
	if err != nil {
		internalError(w, r, "practice reset", err)
		return
	}
	n, _ := res.RowsAffected()
	olog.Printf("[review] practice score reset by user %d (%s) — %d session rows cleared", uid, username(r), n)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
