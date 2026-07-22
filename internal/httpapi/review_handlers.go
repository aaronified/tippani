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
// days (item_reviews, migration 0015). The half-life is deliberately long: it
// floors at reviewMinStability (a week), so even a first successful recall
// schedules the next visit weeks out. A card is due when p <= 0.5 (elapsed >=
// stability). Fresh items also get a grace week (reviewNewItemDays from the
// item's created_at): having just written a quote down counts as knowing it,
// so during that buffer the card reads "remembered" and is not yet due — a
// recorded lapse still wins. The derived status shown on every card's dot:
//   remembered         p >= 0.9, or the item is inside its first week
//   forgetting         0.5 <= p < 0.9
//   probably-forgotten p < 0.5     (due / overdue)
//   unseen             never reviewed (and past the first week)
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
	"strings"
	"time"

	"tippani/internal/olog"
)

const (
	reviewMinStability = 7.0   // days; half-life floor and the unseen-card default — a long baseline by design
	reviewMaxStability = 365.0 // days; growth cap
	reviewNewItemDays  = 7.0   // days; grace week after an item is added — reads "remembered", not yet due
	reviewGrowth       = 2.5   // default srGrow: "got it" multiplies the half-life
	reviewLateBonus    = 1.2   // a late recall proves stability >= elapsed — credit it
	reviewLapseShrink  = 0.25  // default srShrink: "forgot" keeps this fraction, not zero
	reviewSeen         = 1.0   // default srSeen: "seeing" (practice/share/favourite) marginal lengthen; 1.0 = off
	reviewQuota        = 8     // default srDaily deck size
)

// reviewFloorSQL is reviewMinStability for splicing into due-ness SQL — the
// stored stability can predate a floor raise, so queries floor it the same way
// recallStatus does (fmt %g keeps "7", not "7.000000").
var reviewFloorSQL = fmt.Sprintf("%g", reviewMinStability)

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

// recallStatus derives a card's status dot from its half-life, how long it's
// been since the last review, and how old the item itself is (ageDays, from
// created_at). Unseen cards (no review row) have no probability.
//
// A lapse is decisive: a card whose most recent answer was "forgot" reads as
// probably-forgotten however recently it was reviewed. The forgetting curve
// assumes the last review was a SUCCESSFUL recall (p = 1 at elapsed 0), so
// without this a wrong answer — which resets last_reviewed_at to now — would
// paradoxically count the card as remembered. The failed attempt, not the
// timestamp, is the honest signal; the card re-earns "remembered" only when a
// later recall succeeds (flipping last_result back to "got").
//
// A fresh item gets a grace week (reviewNewItemDays): having just saved the
// quote counts as knowing it, so the card reads "remembered" before any
// review — unless a recorded lapse says otherwise (the check above).
func recallStatus(seen bool, stability, elapsedDays, ageDays float64, lastResult string) string {
	if lastResult == "forgot" {
		return "probably-forgotten"
	}
	if ageDays < reviewNewItemDays {
		return "remembered"
	}
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
	// Multiple-choice options and the index of the correct one. For a "source"
	// card the options are titles (which work is this quote from?); for a "quote"
	// card they are quotes (which quote is from this work?).
	Options []string `json:"options"`
	Answer  int      `json:"answer"`
}

// reviewCand wraps a card with the transient facts used to order it and build
// its question: scheduling state (seen / elapsed) and the parent work's key
// ("book:12" / "screen:7") so distractors can be ranked by that work's author
// and genres.
type reviewCand struct {
	card       reviewCard
	seen       bool
	elapsed    float64 // days since last_reviewed_at (seen cards only)
	age        float64 // days since the item was added (created_at) — drives the grace week
	lastResult string  // "got" | "forgot" | "" — a lapse forces probably-forgotten
	workKey    string  // parent book/movie, for similar-distractor ranking
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
	q := `SELECT a.id, a.book_id, COALESCE(a.quote,''), COALESCE(a.note,''), a.color,
	             b.title, COALESCE(b.author,''), COALESCE(a.chapter,''), COALESCE(a.location,''),
	             r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count,0), r.last_reviewed_at, COALESCE(r.last_result,''),
	             COALESCE(julianday('now') - julianday(a.created_at), 1e9)
	      FROM annotations a
	      JOIN books b ON b.id = a.book_id
	      LEFT JOIN item_reviews r ON r.kind = 'book' AND r.item_id = a.id
	      WHERE b.user_id = ? AND (COALESCE(a.quote,'') <> '' OR COALESCE(a.note,'') <> '')`
	args := []any{reviewMinStability, uid}
	if dueOnly {
		// Due-ness floors the stored stability the same way recallStatus does, so
		// a card is due exactly when its dot reads probably-forgotten.
		q += ` AND (r.item_id IS NULL OR date(r.last_touched_at, ?) <> ?)
		       AND (r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= MAX(r.stability, ` + reviewFloorSQL + `))
		       AND COALESCE(julianday('now') - julianday(a.created_at), 1e9) >= ?
		       ORDER BY (r.last_reviewed_at IS NULL), (julianday(r.last_reviewed_at) - julianday('now')) / MAX(r.stability, ` + reviewFloorSQL + `)`
		args = append(args, mod, day, reviewNewItemDays)
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
		var bookID int64
		c.card.Kind = kindBook
		if err := rows.Scan(&c.card.ID, &bookID, &c.card.Quote, &c.card.Note, &c.card.Color,
			&c.card.Title, &c.card.Author, &c.card.Chapter, &c.card.Location,
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &lr, &c.lastResult, &c.age); err != nil {
			olog.Warnf(olog.CodeReviewRowScan, "[review] book candidate row scan failed: %v", err)
			continue
		}
		c.workKey = kindBook + ":" + strconv.FormatInt(bookID, 10)
		c.elapsed = elapsedDays(lr)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Server) screenCandidates(uid int64, dueOnly bool, mod, day string, limit int) ([]reviewCand, error) {
	q := `SELECT d.id, d.movie_id, COALESCE(d.quote,''), COALESCE(d.note,''), m.title, COALESCE(d.character,''),
	             COALESCE(d.timestamp,''), COALESCE(m.media_type,'movie'),
	             r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count,0), r.last_reviewed_at, COALESCE(r.last_result,''),
	             COALESCE(julianday('now') - julianday(d.created_at), 1e9)
	      FROM dialogues d
	      JOIN movies m ON m.id = d.movie_id
	      LEFT JOIN item_reviews r ON r.kind = 'screen' AND r.item_id = d.id
	      WHERE m.user_id = ? AND (COALESCE(d.quote,'') <> '' OR COALESCE(d.note,'') <> '')`
	args := []any{reviewMinStability, uid}
	if dueOnly {
		q += ` AND (r.item_id IS NULL OR date(r.last_touched_at, ?) <> ?)
		       AND (r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= MAX(r.stability, ` + reviewFloorSQL + `))
		       AND COALESCE(julianday('now') - julianday(d.created_at), 1e9) >= ?
		       ORDER BY (r.last_reviewed_at IS NULL), (julianday(r.last_reviewed_at) - julianday('now')) / MAX(r.stability, ` + reviewFloorSQL + `)`
		args = append(args, mod, day, reviewNewItemDays)
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
		var movieID int64
		c.card.Kind = kindScreen
		if err := rows.Scan(&c.card.ID, &movieID, &c.card.Quote, &c.card.Note, &c.card.Title, &c.card.Character,
			&c.card.Timestamp, &c.card.MediaType,
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &lr, &c.lastResult, &c.age); err != nil {
			olog.Warnf(olog.CodeReviewRowScan, "[review] screen candidate row scan failed: %v", err)
			continue
		}
		c.workKey = kindScreen + ":" + strconv.FormatInt(movieID, 10)
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
	card.Status = recallStatus(c.seen, card.Stability, c.elapsed, c.age, c.lastResult)
	return card
}

const (
	quizOptions   = 4   // choices per question (fewer only if the pool is tiny)
	quizQuoteClip = 140 // display length for a quote option
	quizQuoteCap  = 200 // quotes sampled per medium into the distractor pool
)

// workRef is one book / film / show with the metadata that makes a distractor
// "similar" to a given card: the person signal (author for a book, the cast for
// a screen work) and its genres. Distractors are ranked by overlap with the
// card's own work — see distractorScore.
type workRef struct {
	key    string // "book:12" / "screen:7"
	kind   string
	title  string
	author string          // books only
	genres map[string]bool // both
	actors map[string]bool // screen only
}

// quoteRef is one quote in the distractor pool, carrying its source work so a
// "which quote is from this work?" question never offers a quote from the same
// work, and can rank distractors by that work's similarity.
type quoteRef struct {
	work workRef
	text string
}

// quizPools holds a round's distractor material: every in-scope work (for
// "which work" questions) and a random sample of quotes (for "which quote"),
// with a by-key index for looking up a card's own work. Built once per request.
type quizPools struct {
	works  []workRef
	quotes []quoteRef
	byKey  map[string]workRef
}

func (s *Server) quizPools(uid int64, incBooks, incScreen bool) (quizPools, error) {
	p := quizPools{byKey: map[string]workRef{}}
	scan := func(q string, fn func(*sql.Rows) error) error {
		rows, err := s.Store.DB.Query(q, uid)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			if err := fn(rows); err != nil {
				return err
			}
		}
		return rows.Err()
	}
	// works (title + person signal), genres, actors (screen), and a quote sample.
	if incBooks {
		if err := scan(`SELECT id, title, COALESCE(author,'') FROM books WHERE user_id = ? AND title <> ''`,
			func(rows *sql.Rows) error {
				var id int64
				var title, author string
				if err := rows.Scan(&id, &title, &author); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] book work row scan failed: %v", err)
					return nil
				}
				k := kindBook + ":" + strconv.FormatInt(id, 10)
				p.byKey[k] = workRef{key: k, kind: kindBook, title: title, author: author, genres: map[string]bool{}, actors: map[string]bool{}}
				return nil
			}); err != nil {
			return p, err
		}
		if err := scan(`SELECT bg.book_id, g.name FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
		                JOIN books b ON b.id = bg.book_id WHERE b.user_id = ?`,
			func(rows *sql.Rows) error {
				var id int64
				var name string
				if err := rows.Scan(&id, &name); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] book genre row scan failed: %v", err)
					return nil
				}
				if w, ok := p.byKey[kindBook+":"+strconv.FormatInt(id, 10)]; ok && name != "" {
					w.genres[strings.ToLower(name)] = true
				}
				return nil
			}); err != nil {
			return p, err
		}
		if err := scan(`SELECT a.id, a.book_id, COALESCE(a.quote,''), COALESCE(a.note,'')
		                FROM annotations a JOIN books b ON b.id = a.book_id
		                WHERE b.user_id = ? AND (COALESCE(a.quote,'') <> '' OR COALESCE(a.note,'') <> '')
		                ORDER BY RANDOM() LIMIT `+strconv.Itoa(quizQuoteCap),
			p.quoteScanner(kindBook)); err != nil {
			return p, err
		}
	}
	if incScreen {
		if err := scan(`SELECT id, title FROM movies WHERE user_id = ? AND title <> ''`,
			func(rows *sql.Rows) error {
				var id int64
				var title string
				if err := rows.Scan(&id, &title); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] screen work row scan failed: %v", err)
					return nil
				}
				k := kindScreen + ":" + strconv.FormatInt(id, 10)
				p.byKey[k] = workRef{key: k, kind: kindScreen, title: title, genres: map[string]bool{}, actors: map[string]bool{}}
				return nil
			}); err != nil {
			return p, err
		}
		if err := scan(`SELECT mg.movie_id, g.name FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
		                JOIN movies m ON m.id = mg.movie_id WHERE m.user_id = ?`,
			func(rows *sql.Rows) error {
				var id int64
				var name string
				if err := rows.Scan(&id, &name); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] screen genre row scan failed: %v", err)
					return nil
				}
				if w, ok := p.byKey[kindScreen+":"+strconv.FormatInt(id, 10)]; ok && name != "" {
					w.genres[strings.ToLower(name)] = true
				}
				return nil
			}); err != nil {
			return p, err
		}
		if err := scan(`SELECT DISTINCT d.movie_id, d.actor FROM dialogues d JOIN movies m ON m.id = d.movie_id
		                WHERE m.user_id = ? AND COALESCE(d.actor,'') <> ''`,
			func(rows *sql.Rows) error {
				var id int64
				var actor string
				if err := rows.Scan(&id, &actor); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] screen actor row scan failed: %v", err)
					return nil
				}
				if w, ok := p.byKey[kindScreen+":"+strconv.FormatInt(id, 10)]; ok && actor != "" {
					w.actors[strings.ToLower(actor)] = true
				}
				return nil
			}); err != nil {
			return p, err
		}
		if err := scan(`SELECT d.id, d.movie_id, COALESCE(d.quote,''), COALESCE(d.note,'')
		                FROM dialogues d JOIN movies m ON m.id = d.movie_id
		                WHERE m.user_id = ? AND (COALESCE(d.quote,'') <> '' OR COALESCE(d.note,'') <> '')
		                ORDER BY RANDOM() LIMIT `+strconv.Itoa(quizQuoteCap),
			p.quoteScanner(kindScreen)); err != nil {
			return p, err
		}
	}
	for _, w := range p.byKey {
		p.works = append(p.works, w)
	}
	return p, nil
}

// quoteScanner adds a row (id, work_id, quote, note) to the quote pool, linking
// it to its work so distractors can be ranked and same-work quotes excluded.
func (p *quizPools) quoteScanner(kind string) func(*sql.Rows) error {
	return func(rows *sql.Rows) error {
		var id, workID int64
		var quote, note string
		if err := rows.Scan(&id, &workID, &quote, &note); err != nil {
			olog.Warnf(olog.CodeReviewRowScan, "[review] quote pool row scan failed: %v", err)
			return nil
		}
		text := quote
		if text == "" {
			text = note
		}
		if text == "" {
			return nil
		}
		if w, ok := p.byKey[kind+":"+strconv.FormatInt(workID, 10)]; ok {
			p.quotes = append(p.quotes, quoteRef{work: w, text: text})
		}
		return nil
	}
}

func sharedCount(a, b map[string]bool) int {
	n := 0
	for k := range a {
		if b[k] {
			n++
		}
	}
	return n
}

// distractorScore rates how "confusable" a candidate work is with the card's
// own work — higher means a better (harder) distractor. Same medium ranks
// first; then, for books, the SAME AUTHOR dominates and shared genres break
// ties; for films/shows, shared GENRES dominate and a shared ACTOR breaks ties
// (per the owner's rule: books→author then genre, screen→genre then actor).
func distractorScore(own, cand workRef) int {
	if cand.key == own.key {
		return -1 // never itself
	}
	score := 0
	if cand.kind == own.kind {
		score += 1_000_000 // same medium strongly preferred
		if own.kind == kindBook {
			if own.author != "" && cand.author == own.author {
				score += 100_000
			}
			score += 100 * sharedCount(own.genres, cand.genres)
		} else {
			score += 1_000 * sharedCount(own.genres, cand.genres)
			score += 10 * sharedCount(own.actors, cand.actors)
		}
	} else {
		score += 100 * sharedCount(own.genres, cand.genres) // cross-medium: only genre overlap, weakly
	}
	return score
}

// buildQuestion turns a candidate into a multiple-choice card in its preferred
// direction, falling back to the other. ok=false when neither can form (a
// library with only one title can't offer a wrong answer).
// buildQuestion builds an MCQ card. `seed` is the day seed for the Daily Quiz
// (making the whole option set deterministic per card, so every client sees the
// same choices) or 0 for practice (varied per round).
func buildQuestion(c reviewCand, preferred string, p quizPools, seed int64) (reviewCard, bool) {
	// Fold the day seed with the card identity into one stable per-card seed;
	// 0 stays 0 (practice → global RNG).
	cardSeed := seed
	if seed != 0 {
		kindSalt := int64(1)
		if c.card.Kind == kindScreen {
			kindSalt = 2
		}
		cardSeed = seed*1000003 + c.card.ID*97 + kindSalt
		if cardSeed == 0 {
			cardSeed = 1
		}
	}
	if card := finishCard(c, preferred); attachMCQ(&card, c.workKey, p, cardSeed) {
		return card, true
	}
	other := dirQuote
	if preferred == dirQuote {
		other = dirSource
	}
	if card := finishCard(c, other); attachMCQ(&card, c.workKey, p, cardSeed) {
		return card, true
	}
	return reviewCard{}, false
}

// attachMCQ fills a card's Options/Answer for its direction, drawing distractors
// most-similar-first. `seed` (non-zero) makes the choice + order deterministic.
// Returns false if there isn't enough material for a choice.
func attachMCQ(card *reviewCard, ownKey string, p quizPools, seed int64) bool {
	own := p.byKey[ownKey]
	rng := seededRand(seed)
	if card.Direction == dirSource {
		// options = work titles, ranked by similarity; answer = own title.
		var distractors []string
		for _, w := range rankWorks(own, p.works, rng) {
			if w.title != card.Title {
				distractors = append(distractors, w.title)
			}
		}
		opts, ans := choicesFrom(card.Title, distractors, quizOptions, rng)
		if len(opts) < 2 {
			return false
		}
		card.Options, card.Answer = opts, ans
		return true
	}
	// dirQuote: options = quotes from OTHER works, ranked by that work's
	// similarity; answer = this card's quote.
	correct := card.Quote
	if correct == "" {
		correct = card.Note
	}
	if correct == "" {
		return false
	}
	var distractors []string
	for _, q := range rankQuotes(own, p.quotes, rng) {
		if q.work.key == ownKey || q.work.title == card.Title {
			continue // never a quote from the same work
		}
		distractors = append(distractors, clip(q.text, quizQuoteClip))
	}
	opts, ans := choicesFrom(clip(correct, quizQuoteClip), distractors, quizOptions, rng)
	if len(opts) < 2 {
		return false
	}
	card.Options, card.Answer = opts, ans
	return true
}

// seededRand returns a PRNG for a stable per-(day, card) seed, or nil to mean
// "use the global RNG" (practice, where varying between rounds is fine). The
// Daily Quiz seeds every shuffle so the exact options — distractor choice AND
// order — are identical for every client viewing the same day's card, instead
// of being re-randomised on each request (which changed the wrong options
// between browsers, leaving only the right answer stable).
func seededRand(seed int64) *rand.Rand {
	if seed == 0 {
		return nil
	}
	return rand.New(rand.NewPCG(uint64(seed), uint64(seed)*0x9e3779b97f4a7c15+1))
}

// shuffleN shuffles via the seeded RNG when one is given, else the global RNG.
func shuffleN(rng *rand.Rand, n int, swap func(i, j int)) {
	if rng != nil {
		rng.Shuffle(n, swap)
	} else {
		rand.Shuffle(n, swap)
	}
}

// rankWorks / rankQuotes order distractors most-similar-first, shuffling first
// so equally-similar candidates vary (per `rng`: seeded ⇒ stable for the day,
// nil ⇒ varied per round).
func rankWorks(own workRef, works []workRef, rng *rand.Rand) []workRef {
	out := append([]workRef(nil), works...)
	shuffleN(rng, len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	sort.SliceStable(out, func(i, j int) bool { return distractorScore(own, out[i]) > distractorScore(own, out[j]) })
	return out
}

func rankQuotes(own workRef, quotes []quoteRef, rng *rand.Rand) []quoteRef {
	out := append([]quoteRef(nil), quotes...)
	shuffleN(rng, len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	sort.SliceStable(out, func(i, j int) bool { return distractorScore(own, out[i].work) > distractorScore(own, out[j].work) })
	return out
}

// choicesFrom assembles up to n options (the answer + distinct distractors,
// which arrive best-first), shuffles them (per `rng`), and reports the answer's
// index.
func choicesFrom(answer string, distractors []string, n int, rng *rand.Rand) ([]string, int) {
	opts := []string{answer}
	seen := map[string]bool{answer: true}
	for _, d := range distractors {
		if len(opts) >= n {
			break
		}
		if !seen[d] {
			seen[d] = true
			opts = append(opts, d)
		}
	}
	shuffleN(rng, len(opts), func(i, j int) { opts[i], opts[j] = opts[j], opts[i] })
	for i, o := range opts {
		if o == answer {
			return opts, i
		}
	}
	return opts, 0
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return strings.TrimSpace(string(r[:n])) + "…"
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
	olog.Tracef("[review] handleDailyQuiz uid=%d offset=%d", uid, offset)
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
		pools, err := s.quizPools(uid, incBooks, incScreen)
		if err != nil {
			internalError(w, r, "daily quiz pools", err)
			return
		}
		// Fetch with headroom over the quota: a card that can't form a
		// multiple-choice question (too few distinct titles) is skipped, so we
		// need more candidates than slots to still fill the deck.
		fetch := slots * 5
		var cands []reviewCand
		if incBooks {
			bc, err := s.bookCandidates(uid, true, mod, day, fetch)
			if err != nil {
				internalError(w, r, "daily quiz books", err)
				return
			}
			cands = append(cands, bc...)
		}
		if incScreen {
			sc, err := s.screenCandidates(uid, true, mod, day, fetch)
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
		for _, c := range cands {
			if len(items) >= slots {
				break
			}
			if card, ok := buildQuestion(c, dailyDirection(c.card.Kind, c.card.ID, seed), pools, seed); ok {
				items = append(items, card)
			}
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
	olog.Tracef("[review] handlePractice uid=%d", uid)
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "practice prefs", err)
		return
	}
	incBooks, incScreen := scopeFlags(pf.SRReviewScope)
	pools, err := s.quizPools(uid, incBooks, incScreen)
	if err != nil {
		internalError(w, r, "practice pools", err)
		return
	}
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
	dirs := []string{dirSource, dirQuote}
	items := make([]reviewCard, 0, len(cands))
	for _, c := range cands {
		if card, ok := buildQuestion(c, dirs[rand.IntN(2)], pools, 0); ok {
			items = append(items, card)
		}
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
	olog.Tracef("[review] handleReviewAnswer uid=%d kind=%s id=%d result=%s mode=%s", uid, req.Kind, req.ID, req.Result, req.Mode)
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
	age, err := s.itemAgeDays(req.Kind, req.ID)
	if err != nil {
		internalError(w, r, "review answer item age", err)
		return
	}
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
	var lastResult string
	var touchedToday bool
	found := true
	err = tx.QueryRow(`SELECT stability, last_reviewed_at, COALESCE(last_result, ''), COALESCE(date(last_touched_at, ?) = ?, 0)
	                   FROM item_reviews WHERE kind = ? AND item_id = ?`, mod, day, req.Kind, req.ID).
		Scan(&stability, &lastReviewed, &lastResult, &touchedToday)
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
		s.answerResponse(w, r, uid, req.Mode, offset, req.Kind, req.ID, stability, age, lastReviewed, lastResult, pf, found)
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
	// (elapsed 0), so its status turns on the grade just given — "got" reads as
	// remembered, "forgot" as probably-forgotten. One that didn't move (Practice
	// not counting) keeps its real last-review time and prior result so the dot
	// stays honest.
	respLastReviewed := lastReviewed
	respLastResult := lastResult
	if moveSchedule {
		respLastReviewed = sql.NullString{}
		respLastResult = req.Result
	}
	// Practicing a card (a non-skip answer) counts as "seeing" it — a marginal
	// half-life bump on top of any schedule move. The Daily Quiz is not "seeing":
	// its got/forgot already drive the schedule in full.
	if req.Mode == "practice" && req.Result != "skip" {
		s.bumpSeen(req.Kind, req.ID, pf.SRSeen)
	}
	s.answerResponse(w, r, uid, req.Mode, offset, req.Kind, req.ID, stability, age, respLastReviewed, respLastResult, pf, found || moveSchedule)
}

// itemAgeDays is how many days ago the annotation/dialogue behind a card was
// added — the clock for the new-item grace week. A missing or garbled
// timestamp reads as very old (no accidental grace).
func (s *Server) itemAgeDays(kind string, id int64) (float64, error) {
	q := `SELECT COALESCE(julianday('now') - julianday(created_at), 1e9) FROM annotations WHERE id = ?`
	if kind == kindScreen {
		q = `SELECT COALESCE(julianday('now') - julianday(created_at), 1e9) FROM dialogues WHERE id = ?`
	}
	var age float64
	err := s.Store.DB.QueryRow(q, id).Scan(&age)
	if errors.Is(err, sql.ErrNoRows) {
		return 1e9, nil // ownership was already checked; a vanished row just gets no grace
	}
	return age, err
}

// answerResponse assembles the reply shared by the normal path and the daily
// no-op echo: the card's new status + half-life, the mode's day tally, the
// library-wide status counts (so the "Where you stand" row updates live on
// every answer, quiz or practice), and (for daily) how much of today's deck is
// left so the pending dot stays honest.
func (s *Server) answerResponse(w http.ResponseWriter, r *http.Request, uid int64, mode string, offset int,
	kind string, id int64, stability, ageDays float64, lastReviewed sql.NullString, lastResult string, pf prefs, seen bool) {
	day, _, _ := reviewDay(offset)
	answered, got, forgot, err := s.modeTally(uid, mode, day)
	if err != nil {
		internalError(w, r, "review answer response tally", err)
		return
	}
	incBooks, incScreen := scopeFlags(pf.SRReviewScope)
	states, err := s.reviewStates(uid, incBooks, incScreen)
	if err != nil {
		internalError(w, r, "review answer states", err)
		return
	}
	out := map[string]any{
		"ok":        true,
		"kind":      kind,
		"id":        id,
		"stability": stability,
		"status":    recallStatus(seen, stability, elapsedDays(lastReviewed), ageDays, lastResult),
		"mode":      mode,
		"answered":  answered,
		"got":       got,
		"forgot":    forgot,
		"states":    states,
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
		        AND (r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= MAX(r.stability, ` + reviewFloorSQL + `))
		        AND COALESCE(julianday('now') - julianday(x.created_at), 1e9) >= ?`
		var n int
		if err := s.Store.DB.QueryRow(q, uid, mod, day, reviewNewItemDays).Scan(&n); err != nil {
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
			SELECT r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result, ''),
			       COALESCE(julianday('now') - julianday(x.created_at), 1e9)
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
			var stability, age float64
			var lr sql.NullString
			var lastResult string
			if err := rows.Scan(&seen, &stability, &lr, &lastResult, &age); err != nil {
				olog.Warnf(olog.CodeReviewRowScan, "[review] status count row scan failed: %v", err)
				continue
			}
			c.Total++
			switch recallStatus(seen, stability, elapsedDays(lr), age, lastResult) {
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
		if err := rows.Scan(&d); err != nil {
			olog.Warnf(olog.CodeReviewRowScan, "[review] daily streak row scan failed: %v", err)
			continue
		}
		days[d] = true
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
	olog.Tracef("[review] handleReviewScores uid=%d offset=%d", uid, offset)
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
	olog.Tracef("[review] handlePracticeReset uid=%d", uid)
	res, err := s.Store.DB.Exec(`DELETE FROM quiz_sessions WHERE user_id = ? AND mode = 'practice'`, uid)
	if err != nil {
		internalError(w, r, "practice reset", err)
		return
	}
	n, _ := res.RowsAffected()
	olog.Printf("[review] practice score reset by user %d (%s) — %d session rows cleared", uid, username(r), n)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// bumpSeen applies the "seeing" effect (srSeen): being shown a card outside the
// Daily Quiz — practice (not skipped), sharing, or favouriting it — lengthens
// its half-life marginally. It only touches cards already in the schedule (an
// unseen card has no half-life to grow, and creating one here would falsely read
// as "remembered"); it never moves the recall clock or the last result, so a
// lapsed card stays probably-forgotten. factor <= 1 (the default) is a no-op, so
// the whole effect is opt-in.
func (s *Server) bumpSeen(kind string, id int64, factor float64) {
	if factor <= 1.0 {
		return
	}
	if _, err := s.Store.DB.Exec(
		`UPDATE item_reviews SET stability = MIN(stability * ?, ?) WHERE kind = ? AND item_id = ?`,
		factor, reviewMaxStability, kind, id); err != nil {
		olog.Printf("[review] seen bump %s#%d: %v", kind, id, err)
	}
}

// applySeen is the fire-and-forget wrapper used by non-quiz "seeing" events
// (favouriting): it verifies ownership, loads the srSeen factor, and bumps.
func (s *Server) applySeen(uid int64, kind string, id int64) {
	owned, err := s.ownsItem(uid, kind, id)
	if err != nil || !owned {
		return
	}
	pf, err := s.loadPrefs(uid)
	if err != nil {
		return
	}
	s.bumpSeen(kind, id, pf.SRSeen)
}

// handleReviewSeen records a "seeing" event from a client-side action that has
// no other server round-trip — sharing a quote. POST /review/seen {kind,id}.
// (Practice and favouriting are hooked where they already hit the server.)
func (s *Server) handleReviewSeen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		ID   int64  `json:"id"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Kind != kindBook && req.Kind != kindScreen {
		writeErr(w, http.StatusBadRequest, "kind must be book or screen")
		return
	}
	uid := userID(r)
	olog.Tracef("[review] handleReviewSeen uid=%d kind=%s id=%d", uid, req.Kind, req.ID)
	owned, err := s.ownsItem(uid, req.Kind, req.ID)
	if err != nil {
		internalError(w, r, "review seen ownership", err)
		return
	}
	if !owned {
		writeErr(w, http.StatusNotFound, "item not found")
		return
	}
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "review seen prefs", err)
		return
	}
	s.bumpSeen(req.Kind, req.ID, pf.SRSeen)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
