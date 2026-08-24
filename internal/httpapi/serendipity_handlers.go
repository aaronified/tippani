package httpapi

import (
	"database/sql"
	"math/rand/v2"
	"net/http"
	"strings"
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
//
// "ENOUGH TO DRAW A QUOTE CARD" GREW, and the reason is worth recording. The
// first version carried the quote, its colour, and a title and credit line — and
// the card it produced was the plainest thing on Home: no cover, no faces, no
// tags, nothing to do with the line but read it. A surface whose whole job is to
// make you glad you kept something cannot be the one that shows it worst.
//
// What was added is what a favourite tile draws, and no more. The five fields
// below are each one meaning rather than one kind's column list — CoverPath is
// "the picture of where this came from", a book's cover or a film's poster, and
// the card does not care which. The per-kind locators (chapter, page, timestamp,
// season) are deliberately NOT here: the card has a source line, not a citation,
// and every field on a shared shape is a field two of the three kinds leave empty.
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

	CoverPath string   `json:"cover_path"` // the book's cover or the film's poster; "" for a standalone quote
	MediaType string   `json:"media_type"` // book | movie | show | game | quote — what the badge says
	Character string   `json:"character"`  // WHO says it, as against Credit's who wrote or played it (0047: a book has one too)
	Year      int      `json:"year"`       // the work's year, 0 when unknown; NEGATIVE is BCE (0030)
	Favourite bool     `json:"favorite"`   // so the heart on the card starts in the right state
	Tags      []string `json:"tags"`
}

// tagsOf builds the scalar subquery that carries a row's tags along with it.
//
// A JOIN would multiply the row per tag and a second query per card would be
// N+1 — which On this day, returning up to sixty rows, would pay sixty times.
// group_concat over an ordered inner SELECT does it in the one pass.
//
// THE SEPARATOR IS UNIT SEPARATOR (0x1F) AND NOT A COMMA. A comma would in fact
// work today, because cleanNames() splits every incoming tag on commas before it
// is stored, so no stored name can contain one. That is exactly the reason not to
// use it: it would make this query correct only for as long as a normalisation
// rule in taxonomy_handlers.go stays the way it is, and nobody changing that rule
// would think to come here. 0x1F is not a character anyone types.
func tagsOf(joinTable, fkCol, selfAlias string) string {
	return `COALESCE((SELECT group_concat(name, char(31)) FROM (
	           SELECT t.name FROM ` + joinTable + ` xt JOIN tags t ON t.id = xt.tag_id
	           WHERE xt.` + fkCol + ` = ` + selfAlias + `.id ORDER BY t.name)), '')`
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
	// THE ELEVENTH COLUMN IS THE CHARACTER, and the book branch selected a literal
	// empty string for it while the screen branch below selected the column. A
	// novel has speakers (0047) and this is the card the owner reported the missing
	// name on, so Shuffle and On-this-day were still showing it blank after the
	// release that fixed the library's copy of the same card.
	{"book", `SELECT a.id, a.quote, COALESCE(a.note, ''), a.color,
	           COALESCE(b.title, ''), COALESCE(b.author, ''), b.id, a.created_at,
	           COALESCE(b.cover_path, ''), 'book', COALESCE(a.character, ''), COALESCE(b.published_year, 0), a.favorite,
	           ` + tagsOf("annotation_tags", "annotation_id", "a") + `
	          FROM annotations a JOIN books b ON b.id = a.book_id
	          WHERE b.user_id = ? AND TRIM(COALESCE(a.quote, '')) <> ''`},
	{"screen", `SELECT d.id, d.quote, COALESCE(d.note, ''), d.color,
	             COALESCE(m.title, ''), COALESCE(d.actor, ''), m.id, d.created_at,
	             COALESCE(m.poster_path, ''), COALESCE(NULLIF(m.media_type, ''), 'movie'),
	             COALESCE(d.character, ''), COALESCE(m.release_year, 0), d.favorite,
	             ` + tagsOf("dialogue_tags", "dialogue_id", "d") + `
	            FROM dialogues d JOIN movies m ON m.id = d.movie_id
	            WHERE m.user_id = ? AND TRIM(COALESCE(d.quote, '')) <> ''`},
	{"quote", `SELECT u.id, u.quote, COALESCE(u.note, ''), u.color,
	            COALESCE(u.occasion, ''), COALESCE(u.speaker, ''), 0, u.created_at,
	            '', 'quote', '', 0, u.favorite,
	            ` + tagsOf("utterance_tags", "utterance_id", "u") + `
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
		var tags string
		r.Kind = kind
		if err := rows.Scan(&r.ID, &r.Quote, &r.Note, &r.Colour, &r.Title, &r.Credit, &r.WorkID, &r.Created,
			&r.CoverPath, &r.MediaType, &r.Character, &r.Year, &r.Favourite, &tags); err != nil {
			return out, err
		}
		// [] and not null: a card mapping over its tags should not have to check
		// first, which is the same rule every list response in the app follows.
		r.Tags = []string{}
		if tags != "" {
			r.Tags = strings.Split(tags, "\x1f")
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
