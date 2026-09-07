package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"tippani/internal/olog"
)

// ONE CARD'S MEMORY, READ BACK.
//
// THE OWNER'S REQUEST: "when i click on the spaced repetition icon in the quote
// cards, it should show a popup for the halflife status, and recall history (will
// need to create a recall history table), like the infodots (this is not an
// infodot, btw, so will not be restricted by the budget)."
//
// The table is 0064/0065's `item_recalls` and every answer has been written to it
// since. This is the read: the schedule state the dot is drawn from, plus the
// answers behind it.
//
// WHY THE STATE COMES BACK TOO, when the card that opened the popup already has
// it. The list endpoints attach `reviewed / stability / last_reviewed_at /
// last_result` at the moment the list was fetched, and the Daily Quiz moves all
// four without the list hearing about it — so a card answered five minutes ago
// still reads unseen on a Library page left open. A popup whose whole subject is
// "when did I last remember this" may not be the one surface in the app showing
// a stale answer.
//
// AND WHY `due` IS THE SERVER'S TO SAY. `reviewStatus` in the client mirrors the
// forgetting curve, which is how the dot has four states without a round trip.
// It does not know when the card next comes ROUND — that is `dueSQL`, spliced
// here rather than restated, because a popup that disagrees with the deck about
// whether a card is owed reads as one of the two being broken.

// recallHistoryMax is how many answers come back.
//
// THIRTY IS A PANEL'S WORTH, and this is a panel. A card answered every day for
// a month, or monthly for two and a half years, arrives whole; anything past
// that is a list you scroll rather than a history you read, and `logged` says
// how many there are so the panel can say what it is not showing.
const recallHistoryMax = 30

// recallAnswer is one row of the log: what was answered, the half-life that
// answer produced, and how long it had been since the previous one.
//
// `elapsed_days` IS A POINTER because the first answer has no previous one and
// the column is nullable. Zero would be a lie a reader could not detect — it
// reads as "answered twice in one moment".
type recallAnswer struct {
	Result      string   `json:"result"`
	Stability   float64  `json:"stability"`
	ElapsedDays *float64 `json:"elapsed_days"`
	AnsweredAt  string   `json:"answered_at"`
	// Mode and Counted are 0066's, and both are POINTERS for the same reason
	// `elapsed_days` is: rows logged before that migration know neither, and no
	// value stands in for not knowing. A practice answer that moved nothing and
	// a Daily Quiz answer that set the half-life are otherwise the same row, and
	// a panel that drew them alike would report an unmoved curve as a fault.
	Mode    *string `json:"mode"`
	Counted *bool   `json:"counted"`
}

type recallCardResp struct {
	Kind string `json:"kind"`
	ID   int64  `json:"id"`
	// The schedule, in the same field names the list endpoints use, so the
	// client's `reviewStatus` reads this response without a second shape.
	Reviewed       bool    `json:"reviewed"`
	Stability      float64 `json:"stability"`
	ReviewCount    int     `json:"review_count"`
	LapseCount     int     `json:"lapse_count"`
	LastResult     string  `json:"last_result"`
	LastReviewedAt string  `json:"last_reviewed_at"`
	CreatedAt      string  `json:"created_at"`
	// Excluded is the card's own opt-out. It is not a term in this query — the
	// history of a card kept out of the quiz is still its history — but the panel
	// says so, because "next due in 12 days" is false for a card that will never
	// be asked.
	Excluded bool `json:"excluded"`
	Due      bool `json:"due"`
	// DueInDays is signed: positive is days remaining, negative is days overdue,
	// and null is a card with no recall clock (unseen, or a bumpSeen-only row).
	DueInDays *float64       `json:"due_in_days"`
	Logged    int            `json:"logged"`
	History   []recallAnswer `json:"history"`
}

// sourceFor is the reviewSource for one kind. `sourcesFor` builds a list from
// the scope flags; this answers the other question, and exists so a per-kind
// table name is never spelled a fourth time.
func sourceFor(kind string) (reviewSource, bool) {
	switch kind {
	case kindBook:
		return bookSource(), true
	case kindScreen:
		return screenSource(), true
	case kindUtterance:
		return utteranceSource(), true
	}
	return reviewSource{}, false
}

// handleReviewCard serves GET /review/card?kind=&id= — one card's schedule state
// and its recall history.
func (s *Server) handleReviewCard(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	rs, ok := sourceFor(kind)
	if !ok {
		writeErr(w, http.StatusBadRequest, "kind must be book, screen or utterance")
		return
	}
	id, err := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
	if err != nil || id <= 0 {
		writeErr(w, http.StatusBadRequest, "id must be a positive integer")
		return
	}
	uid := userID(r)
	olog.Tracef("[review] handleReviewCard uid=%d kind=%s id=%d", uid, kind, id)

	// DUE IS `dueSQL` AND A SCHEDULE ROW, and the second half is not pedantry.
	// `dueSQL` reads true whenever `r.last_reviewed_at` is NULL, which for a LEFT
	// JOIN that matched nothing is every card the quiz has never asked about — so
	// on its own it would have the panel say "due now" about an unseen one. The
	// deck does not reach those through this rule either: they arrive by
	// `bucketUnseen` and its grace week. The due RULE stays spelled once; what is
	// added is whether there is a clock for it to be a rule about.
	//
	// SCOPED IN THE WHERE, WHICH IS ALSO THE 404. The item's own ownership column
	// is the only thing separating one reader's history from another's — the log
	// carries a user_id but the item is what the caller names — so a row that is
	// not theirs comes back as no rows and leaves as a 404, never a 403.
	out := recallCardResp{Kind: kind, ID: id, History: []recallAnswer{}}
	var lastReviewed, createdAt sql.NullString
	err = s.Store.DB.QueryRow(
		`SELECT r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count, 0),
		        COALESCE(r.lapse_count, 0), COALESCE(r.last_result, ''), r.last_reviewed_at,
		        x.created_at, COALESCE(x.review_excluded, 0),
		        (r.item_id IS NOT NULL AND `+dueSQL+`),
		        CASE WHEN r.last_reviewed_at IS NULL THEN NULL
		             ELSE MAX(r.stability, `+reviewFloorSQL+`) - (julianday('now') - julianday(r.last_reviewed_at))
		        END
		   FROM `+rs.from()+` `+rs.reviewJoin()+`
		  WHERE x.id = ? AND `+rs.ownerCol()+` = ?`,
		reviewMinStability, id, uid,
	).Scan(&out.Reviewed, &out.Stability, &out.ReviewCount, &out.LapseCount, &out.LastResult,
		&lastReviewed, &createdAt, &out.Excluded, &out.Due, &out.DueInDays)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "item not found")
		return
	}
	if err != nil {
		internalError(w, r, "review card state", err)
		return
	}
	out.LastReviewedAt = lastReviewed.String
	out.CreatedAt = createdAt.String

	if err := s.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM item_recalls WHERE user_id = ? AND kind = ? AND item_id = ?`,
		uid, kind, id).Scan(&out.Logged); err != nil {
		internalError(w, r, "review card log count", err)
		return
	}

	// NEWEST FIRST, and `id` breaks the tie: `answered_at` is `datetime('now')`,
	// so two answers in the same second are indistinguishable by it alone and a
	// practice run can produce two. The order matches
	// `idx_item_recalls_item(kind, item_id, answered_at)`, so the LIMIT is cheap
	// on a card with years of answers.
	rows, err := s.Store.DB.Query(
		`SELECT result, stability, elapsed_days, answered_at, mode, counted
		   FROM item_recalls
		  WHERE user_id = ? AND kind = ? AND item_id = ?
		  ORDER BY answered_at DESC, id DESC
		  LIMIT ?`, uid, kind, id, recallHistoryMax)
	if err != nil {
		internalError(w, r, "review card history", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var a recallAnswer
		var elapsed sql.NullFloat64
		var mode sql.NullString
		var counted sql.NullBool
		if err := rows.Scan(&a.Result, &a.Stability, &elapsed, &a.AnsweredAt, &mode, &counted); err != nil {
			internalError(w, r, "review card history scan", err)
			return
		}
		if elapsed.Valid {
			v := elapsed.Float64
			a.ElapsedDays = &v
		}
		if mode.Valid {
			v := mode.String
			a.Mode = &v
		}
		if counted.Valid {
			v := counted.Bool
			a.Counted = &v
		}
		out.History = append(out.History, a)
	}
	if err := rows.Err(); err != nil {
		internalError(w, r, "review card history rows", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
