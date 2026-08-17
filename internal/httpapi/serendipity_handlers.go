package httpapi

import (
	"database/sql"
	"math/rand/v2"
	"net/http"
	"time"

	"tippani/internal/olog"
)

// Shuffle and On this day — roadmap §1's two reading surfaces.
//
// Both answer the same shape of question and neither has anything to do with the
// review loop, which is the distinction worth stating up front: NOTHING HERE
// TOUCHES item_reviews. Landing on a quote by chance is not answering a card,
// and a "seen" bump from idly shuffling would quietly lengthen the half-life of
// whatever the random number generator liked — inflating a schedule through a
// surface that is supposed to be for enjoying the library rather than working
// at it. There is a test for that, because the quote card these render is shared
// with the surface that DOES move the schedule.
//
// ONE ROW, CHOSEN BY THE DATABASE. `ORDER BY RANDOM() LIMIT 1` over each kind
// rather than fetching everything and picking in Go: the fetch-and-pick version
// is free at fifty quotes and stops being free at exactly the size where this
// feature starts being fun.

// shuffleRow is the shared shape both endpoints return: enough to draw a quote
// card, and its kind so the client knows which screen it belongs to.
type shuffleRow struct {
	Kind    string `json:"kind"` // book | screen | quote
	ID      int64  `json:"id"`
	Quote   string `json:"quote"`
	Note    string `json:"note"`
	Colour  string `json:"color"`
	Title   string `json:"title"`  // the book / film / occasion it came from
	Credit  string `json:"credit"` // author / actor / speaker
	WorkID  int64  `json:"work_id"`
	Created string `json:"created_at"`
}

// shuffleSources is the three kinds, each with the query that reads one row of
// the shape above. A table rather than three near-identical functions, so
// "which kinds can be shuffled" has one answer and a fourth kind is one entry.
//
// The WHERE clause is the ownership check in every case — for annotations and
// dialogues that is the parent join, which is the only thing standing between
// one account's quotes and another's.
var shuffleSources = []struct {
	kind  string
	query string
}{
	{"book", `SELECT a.id, a.quote, COALESCE(a.note, ''), a.color,
	           COALESCE(b.title, ''), COALESCE(b.author, ''), b.id, a.created_at
	          FROM annotations a JOIN books b ON b.id = a.book_id
	          WHERE b.user_id = ? AND TRIM(COALESCE(a.quote, '')) <> ''`},
	{"screen", `SELECT d.id, d.quote, COALESCE(d.note, ''), d.color,
	             COALESCE(m.title, ''), COALESCE(d.actor, ''), m.id, d.created_at
	            FROM dialogues d JOIN movies m ON m.id = d.movie_id
	            WHERE m.user_id = ? AND TRIM(COALESCE(d.quote, '')) <> ''`},
	{"quote", `SELECT u.id, u.quote, COALESCE(u.note, ''), u.color,
	            COALESCE(u.occasion, ''), COALESCE(u.speaker, ''), 0, u.created_at
	           FROM utterances u
	           WHERE u.user_id = ? AND TRIM(COALESCE(u.quote, '')) <> ''`},
}

// handleShuffle: GET /shuffle — one random quote, from anywhere.
//
// THE KIND IS CHOSEN BEFORE THE ROW, and that is a real decision rather than an
// implementation detail. Picking uniformly across all quotes would mean a
// library of four thousand highlights and forty film lines shows a film line
// once every hundred shuffles — which is honest about the proportions and
// useless as a way of rediscovering the smaller shelves. Choosing the KIND at
// random first, then a row within it, gives every part of the library a turn.
//
// Empty kinds are dropped before the draw, so a library with no films is not a
// third of the way to showing nothing.
func (s *Server) handleShuffle(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[shuffle] handleShuffle uid=%d", uid)

	// Which kinds have anything at all. One count each, cheap, and it is what
	// makes the kind-first draw fair rather than lumpy.
	var live []int
	for i, src := range shuffleSources {
		var n int
		if err := s.Store.DB.QueryRow(`SELECT count(*) FROM (`+src.query+` LIMIT 1)`, uid).Scan(&n); err != nil {
			internalError(w, r, "shuffle count", err)
			return
		}
		if n > 0 {
			live = append(live, i)
		}
	}
	if len(live) == 0 {
		// Not an error: an empty library is a normal state, and the screen says
		// so rather than showing a failure.
		writeJSON(w, http.StatusOK, map[string]any{"quote": nil})
		return
	}
	// crypto-free randomness is fine here — this picks a quote, not a token.
	pick := shuffleSources[live[rand.IntN(len(live))]]
	row, err := s.readShuffleRow(pick.kind, pick.query+` ORDER BY RANDOM() LIMIT 1`, uid)
	if err != nil {
		internalError(w, r, "shuffle read", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quote": row})
}

// handleOnThisDay: GET /on-this-day — what you saved on this date in other years.
//
// NOTED_AT WINS WHERE IT IS SET, and the roadmap entry named both columns
// without saying which. It matters on every imported row: created_at is the day
// of the IMPORT, which for a library brought over in one afternoon is the same
// day for thousands of quotes and means nothing to a reader. noted_at is when
// YOU saved the line.
//
// The year is excluded from the match and the CURRENT year is excluded from the
// results — "on this day" means other years, and a card listing what you saved
// four hours ago is a card that repeats the screen you just came from.
func (s *Server) handleOnThisDay(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	now := time.Now()
	md := now.Format("01-02")
	year := now.Format("2006")
	olog.Tracef("[shuffle] handleOnThisDay uid=%d md=%s", uid, md)

	out := []shuffleRow{}
	for _, src := range shuffleSources {
		// COALESCE(noted_at, created_at) is the date this asks about — see above.
		col := "COALESCE(NULLIF(TRIM(COALESCE(" + shuffleDateCol(src.kind) + ", '')), ''), " + shuffleSelf(src.kind) + ".created_at)"
		q := src.query +
			` AND strftime('%m-%d', ` + col + `) = ?` +
			` AND strftime('%Y', ` + col + `) <> ?` +
			` ORDER BY ` + col + ` DESC LIMIT 20`
		rows, err := s.Store.DB.Query(q, uid, md, year)
		if err != nil {
			internalError(w, r, "on this day", err)
			return
		}
		got, err := scanShuffleRows(src.kind, rows)
		rows.Close()
		if err != nil {
			internalError(w, r, "on this day scan", err)
			return
		}
		out = append(out, got...)
	}
	writeJSON(w, http.StatusOK, map[string]any{"date": md, "quotes": out})
}

func shuffleSelf(kind string) string {
	switch kind {
	case "book":
		return "a"
	case "screen":
		return "d"
	default:
		return "u"
	}
}

func shuffleDateCol(kind string) string { return shuffleSelf(kind) + ".noted_at" }

func (s *Server) readShuffleRow(kind, q string, uid int64) (*shuffleRow, error) {
	rows, err := s.Store.DB.Query(q, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	got, err := scanShuffleRows(kind, rows)
	if err != nil || len(got) == 0 {
		return nil, err
	}
	return &got[0], nil
}

func scanShuffleRows(kind string, rows *sql.Rows) ([]shuffleRow, error) {
	out := []shuffleRow{}
	for rows.Next() {
		var r shuffleRow
		r.Kind = kind
		if err := rows.Scan(&r.ID, &r.Quote, &r.Note, &r.Colour, &r.Title, &r.Credit, &r.WorkID, &r.Created); err != nil {
			return out, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
