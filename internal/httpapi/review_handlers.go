package httpapi

// Spaced repetition — Daily Quiz & Practice (v0.5.0 rework, ROADMAP №2).
//
// One retrieval model, two modes, over every quote the app holds: the library
// (books via annotations), the catalogue (films/shows via dialogues), and
// standalone quotes with no work behind them at all (utterances, §24). Each
// card is presented in one of two directions:
//
//   source — show the quote, recall where it's from.
//   quote  — show where it's from, recall the quote.
//
// "Where it's from" is a title for the first two kinds. A standalone quote has
// no parent row to take a title from, so its source is the occasion it was said
// on — a speech, a letter, a broadcast — falling back to the speaker when the
// occasion went unrecorded. A quote with neither is a proverb: there is nothing
// to recall but the words already on the card, so it never enters the deck. See
// utteranceAttribution.
//
// The flow is self-graded: present → attempt recall → reveal → grade. There is
// no multiple choice; the user is trusted to grade honestly (that is the point
// of retrieval practice). Grades:
//
//   got    — successful recall; climbs the interval ladder one rung.
//   forgot — a lapse; falls straight back to the ladder's 7-day rung.
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
// days (item_reviews, migration 0015). The half-life climbs a fixed ladder,
// reviewLadder (7 → 30 → 100 days): a card's first successful recall
// starts it at the 7-day rung, every later success climbs to the next rung
// above its current half-life, 100 days is the ceiling it then keeps — and a
// single lapse falls straight back to the 7-day rung from any height. A card
// is due when p <= 0.5 (elapsed >= stability), so the rungs ARE the review
// intervals. Fresh items also get a grace week (reviewNewItemDays from the
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
	reviewMinStability = 7.0   // days; the ladder's first rung, the half-life floor, and the unseen-card default
	reviewMaxStability = 100.0 // days; the ladder's top rung — no half-life ever grows past it
	reviewNewItemDays  = 7.0   // days; grace week after an item is added — reads "remembered", not yet due
	reviewSeen         = 1.0   // default srSeen: "seeing" (practice/share/favourite) marginal lengthen; 1.0 = off
	reviewQuota        = 8     // default srDaily deck size
)

// reviewLadder is the fixed spaced-repetition ladder (days): a correct recall
// climbs to the next rung above the card's current half-life, any lapse falls
// straight back to the first rung, and cards sit on the top rung for as long
// as the correct answers keep coming. Off-rung half-lives (pre-ladder rows,
// srSeen bumps) climb to the nearest rung above, so every card converges onto
// the ladder. Migration 0019 clamps stored values to the new 100-day cap.
var reviewLadder = [...]float64{reviewMinStability, 30, reviewMaxStability}

// nextRung is the half-life a successful recall earns: the smallest rung
// strictly above the current one, or the top rung once there is none.
func nextRung(cur float64) float64 {
	for _, r := range reviewLadder {
		if r > cur {
			return r
		}
	}
	return reviewMaxStability
}

// reviewFloorSQL is reviewMinStability for splicing into due-ness SQL — the
// stored stability can predate a floor raise, so queries floor it the same way
// recallStatus does (fmt %g keeps "7", not "7.000000").
var reviewFloorSQL = fmt.Sprintf("%g", reviewMinStability)

// review directions (question types). Kept as constants so the deck builder and
// tests speak the same vocabulary the client renders against.
const (
	dirSource = "source" // show quote, recall the work / speech it came from
	dirQuote  = "quote"  // show the work / speech, recall the quote
)

// item kinds in item_reviews.
const (
	kindBook      = "book"      // annotations
	kindScreen    = "screen"    // dialogues (films + shows)
	kindUtterance = "utterance" // standalone quotes — speeches, letters, proverbs (§24)
)

// validReviewKind gates every review write. One list, so an endpoint cannot
// learn a new kind while another silently keeps rejecting it.
func validReviewKind(kind string) bool {
	return kind == kindBook || kind == kindScreen || kind == kindUtterance
}

// kindSalt keeps ids from different kinds colliding in the shuffle key. It is
// read by both shuffleKey (Go) and shuffleKeySQL, which must agree.
func kindSalt(kind string) uint64 {
	switch kind {
	case kindScreen:
		return 1013904223
	case kindUtterance:
		return 2654435769
	default:
		return 2166136261
	}
}

// utteranceAttribution is the "work" a standalone quote belongs to: the occasion
// it was said on, or its speaker when the occasion went unrecorded. A quote has
// no parent row to inherit a title from, so this is what the deck asks you to
// recall, what groups two lines from the same speech, and what a wrong answer
// offers instead.
//
// A quote with neither — a proverb — has no attribution, and is not reviewable:
// there is nothing to recall except the words already on the card.
func utteranceAttribution(speaker, occasion string) string {
	if occasion = strings.TrimSpace(occasion); occasion != "" {
		return occasion
	}
	return strings.TrimSpace(speaker)
}

// utteranceWorkKey folds case and runs of spaces, so "Burma Radio broadcast" and
// "burma radio  broadcast" are one speech rather than two works that can be
// offered as each other's distractor. Empty when the quote has no attribution.
func utteranceWorkKey(speaker, occasion string) string {
	a := utteranceAttribution(speaker, occasion)
	if a == "" {
		return ""
	}
	return kindUtterance + ":" + strings.ToLower(strings.Join(strings.Fields(a), " "))
}

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

// reviewScope is which media the deck draws from. It travels as one value
// rather than a bool per medium because every query that has to agree on the
// scope takes it: a third medium arriving as a third positional bool is how the
// deck and the counts beside it drift apart.
type reviewScope struct {
	books     bool // annotations
	screen    bool // dialogues
	utterance bool // standalone quotes
}

func (sc reviewScope) any() bool { return sc.books || sc.screen || sc.utterance }

// allMedia is every kind regardless of the review-scope preference — Stats
// reports on the whole library, not on what the deck happens to be drawing from.
func allMedia() reviewScope { return reviewScope{books: true, screen: true, utterance: true} }

// scopeFlags turns the srReviewScope preference into which pools to draw from.
//
// THREE INDEPENDENT CHOICES, stored as one string. The preference began as a
// two-way switch, gained a third medium, and until now could still only say one
// medium or all of them — so "books and quotes but not films" was unsayable, and
// the Settings screen could not send "quotes" at all. A comma-separated list
// says any of the eight combinations, and the single-word values keep working
// because they are what every existing account has stored.
//
// Legacy "movies" is honoured as the screen (films+shows) scope. "both"
// predates the third medium and means everything — the alternative was leaving
// standalone quotes out of every existing user's deck until they found a
// setting, which reads as the feature being broken.
//
// An empty or unrecognised value means everything, NOT nothing. A deck that
// serves no cards because a preference failed to parse is indistinguishable
// from a deck you have finished, and it would be silent.
func scopeFlags(scope string) reviewScope {
	var sc reviewScope
	for _, tok := range strings.Split(scope, ",") {
		switch strings.TrimSpace(strings.ToLower(tok)) {
		case "books":
			sc.books = true
		case "movies", "screen":
			sc.screen = true
		case "quotes":
			sc.utterance = true
		case "both", "all":
			return reviewScope{books: true, screen: true, utterance: true}
		}
	}
	if !sc.any() {
		return reviewScope{books: true, screen: true, utterance: true}
	}
	return sc
}

// srScopeValid accepts a single medium, a legacy alias, or any comma-separated
// combination of the three. It rejects a list containing anything it does not
// recognise rather than quietly dropping the bad token: a scope that silently
// becomes a different scope is how someone ends up wondering why their films
// stopped appearing.
func srScopeValid(scope string) bool {
	if scope == "" {
		return false
	}
	for _, tok := range strings.Split(scope, ",") {
		if !srScopes[strings.TrimSpace(strings.ToLower(tok))] {
			return false
		}
	}
	return true
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
	return int64((uint64(id)*2654435761 + kindSalt(kind) + uint64(seed)) % 100003)
}

// reviewCard is one card sent to the client. It carries both sides (prompt +
// answer); the client shows one and reveals the other per `direction`.
type reviewCard struct {
	Kind      string `json:"kind"` // book | screen | utterance
	ID        int64  `json:"id"`
	Direction string `json:"direction"` // source | quote
	Quote     string `json:"quote"`
	Note      string `json:"note"`
	Color     string `json:"color"` // highlight colour — every kind carries one (0021, 0026)
	// Title is the source the quote is attributed to: a book / film / show
	// title, or — for a standalone quote, which has no parent work — the
	// occasion it was said on, falling back to the speaker. It is what a
	// "source" card asks you to recall, so every kind must fill it.
	Title        string  `json:"title"`
	Author       string  `json:"author"`        // book author; "" otherwise
	Character    string  `json:"character"`     // screen speaker; "" otherwise
	Actor        string  `json:"actor"`         // screen speaker's actor; "" otherwise
	Speaker      string  `json:"speaker"`       // utterance only — who said it
	OccasionDate string  `json:"occasion_date"` // utterance only — when, possibly just a year
	Chapter      string  `json:"chapter"`       // book only
	Location     string  `json:"location"`      // book only
	Timestamp    string  `json:"timestamp"`     // screen only
	episodeRef              // screen only, shows only; null on a film's lines
	MediaType   string  `json:"media_type"` // movie | show (screen); "" for book
	Stability   float64 `json:"stability"`
	ReviewCount int     `json:"review_count"`
	Status      string  `json:"status"`
	// Multiple-choice options and the index of the correct one. For a "source"
	// card the options are titles (which work is this quote from?); for a "quote"
	// card they are quotes (which quote is from this work?).
	Options []string `json:"options"`
	Answer  int      `json:"answer"`
	// OptionMeta mirrors Options index-for-index on "source" cards: the person
	// the UI shows as a face chip under each work title — a book's author, a
	// screen work's dialogue actor (falling back to its director). Absent on
	// "quote" cards (a quote option's people would name its work — the answer).
	OptionMeta []optionMeta `json:"option_meta,omitempty"`
}

// optionMeta is the person credit for one multiple-choice work option.
type optionMeta struct {
	Person string `json:"person,omitempty"` // display name; "" when unknown
	Kind   string `json:"kind,omitempty"`   // author | actor | director
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

// deckBucket picks which slice of the pool a candidate query returns. Daily
// fetches its two buckets SEPARATELY: a single query ordered seen-before-unseen
// put every never-answered card behind the whole due backlog, and the LIMIT then
// discarded them before Go ever saw one.
type deckBucket int

const (
	bucketAll    deckBucket = iota // Practice: the whole in-scope pool
	bucketDue                      // Daily: answered cards whose interval has elapsed
	bucketUnseen                   // Daily: never-answered cards past their grace week
)

// shuffleKeySQL mirrors shuffleKey as a SQL expression so a bounded fetch takes
// a SPREAD sample rather than a rowid prefix.
//
// This is the fix for the "same few books every day" report. Both of the old
// ORDER BY keys tie across huge blocks of rows — for an unseen card the overdue
// ratio is NULL, so every unseen card tied — and SQLite breaks ties in scan
// order, i.e. ascending rowid. The importer inserts book by book, so annotation
// ids are contiguous per book and a `LIMIT 40` returned forty rows from one
// book. Hashing the id scatters those ties across the library instead.
//
// The `?` takes the seed, so the sample is stable within a day and moves the
// next. Overflow bound: id * 2654435761 stays inside int64 up to id ≈ 3.47e9.
func shuffleKeySQL(idCol, kind string) string {
	return fmt.Sprintf("((%s * 2654435761 + %d + ?) %% 100003)", idCol, kindSalt(kind))
}

// reviewSource says where one kind's cards live and what makes one reviewable.
//
// Five queries have to agree on that answer — the two deck buckets, the badge
// count (dailyRemaining), the status tally (reviewStates) and the Stats recall
// half-life — and until §24 they agreed by being copies of each other, which
// held only because annotations and dialogues have the same shape. Standalone
// quotes have neither: no parent table to take the user scope from, and an
// eligibility rule of their own. Copies would have diverged the first time one
// of them was updated and another forgotten, and the symptom is a badge
// promising cards the deck won't serve.
type reviewSource struct {
	kind      string // item_reviews.kind
	table     string // annotations | dialogues | utterances
	parent    string // books | movies; "" when the row carries its own user_id
	parentKey string // book_id | movie_id
	idCol     string // for the shuffle key
	// eligible is the kind's own reviewability rule beyond "has words". Only
	// utterances have one: a quote with no attribution has no question.
	eligible string
}

func bookSource() reviewSource {
	return reviewSource{kind: kindBook, table: "annotations", parent: "books", parentKey: "book_id", idCol: "x.id"}
}

func screenSource() reviewSource {
	return reviewSource{kind: kindScreen, table: "dialogues", parent: "movies", parentKey: "movie_id", idCol: "x.id"}
}

func utteranceSource() reviewSource {
	return reviewSource{kind: kindUtterance, table: "utterances", idCol: "x.id",
		eligible: `AND (COALESCE(x.occasion,'') <> '' OR COALESCE(x.speaker,'') <> '')`}
}

func sourcesFor(sc reviewScope) []reviewSource {
	var out []reviewSource
	if sc.books {
		out = append(out, bookSource())
	}
	if sc.screen {
		out = append(out, screenSource())
	}
	if sc.utterance {
		out = append(out, utteranceSource())
	}
	return out
}

// from is the table and, where there is one, the parent that carries the user
// scope. The row alias is always `x`, the parent always `p`.
func (rs reviewSource) from() string {
	if rs.parent == "" {
		return rs.table + " x"
	}
	return rs.table + " x JOIN " + rs.parent + " p ON p.id = x." + rs.parentKey
}

// ownerCol is the column the caller's id is matched against — the parent's for
// a child row, the row's own for a parentless one.
func (rs reviewSource) ownerCol() string {
	if rs.parent == "" {
		return "x.user_id"
	}
	return "p.user_id"
}

// reviewJoin attaches the schedule row. Split out only so no caller can spell
// the kind literal differently from the one in `where`.
func (rs reviewSource) reviewJoin() string {
	return "LEFT JOIN item_reviews r ON r.kind = '" + rs.kind + "' AND r.item_id = x.id"
}

// where is the eligibility rule: owned by the caller, has words, and whatever
// else the kind requires. The `?` takes the user id.
func (rs reviewSource) where() string {
	return "WHERE " + rs.ownerCol() + " = ? AND (COALESCE(x.quote,'') <> '' OR COALESCE(x.note,'') <> '') " + rs.eligible
}

// dueSQL is when a scheduled card comes back round. It floors the stored
// stability the same way recallStatus does, so a card is due exactly when its
// dot reads probably-forgotten — and a row with no last_reviewed_at is a
// bumpSeen-only row, treated as maximally due.
//
// The deck and the badge both splice this in. Spelling it twice is how they
// come to disagree about how many cards are left.
var dueSQL = `(r.last_reviewed_at IS NULL OR julianday('now') - julianday(r.last_reviewed_at) >= MAX(r.stability, ` + reviewFloorSQL + `))`

// bucketClause is the half of a candidate query that picks WHICH slice of the
// pool comes back. Identical for every kind, so it lives here rather than once
// per candidate function.
func (rs reviewSource) bucketClause(bucket deckBucket, mod, day string, seed int64) (string, []any) {
	shuffle := shuffleKeySQL(rs.idCol, rs.kind)
	switch bucket {
	case bucketDue:
		return ` AND r.item_id IS NOT NULL
		         AND date(r.last_touched_at, ?) <> ?
		         AND ` + dueSQL + `
		         ORDER BY (julianday(r.last_reviewed_at) - julianday('now')) / MAX(r.stability, ` + reviewFloorSQL + `), ` + shuffle,
			[]any{mod, day, seed}
	case bucketUnseen:
		// The grace week is measured from created_at, which for an import is the
		// import's wall clock — so a whole import leaves grace on the same day and
		// arrives as one undifferentiated block. The hash is what stops that block
		// being sliced by rowid.
		return ` AND r.item_id IS NULL
		         AND COALESCE(julianday('now') - julianday(x.created_at), 1e9) >= ?
		         ORDER BY ` + shuffle,
			[]any{reviewNewItemDays, seed}
	default: // bucketAll
		return ` ORDER BY ` + shuffle, []any{seed}
	}
}

// schedCols is the scheduling tail every candidate SELECT ends with, in the
// order finishCard's scan expects.
const schedCols = `r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count,0), r.last_reviewed_at,
                   COALESCE(r.last_result,''), COALESCE(julianday('now') - julianday(x.created_at), 1e9)`

// bookCandidates / screenCandidates / utteranceCandidates fetch reviewable cards
// for one bucket. bucketAll (Practice) returns the whole in-scope pool;
// bucketDue / bucketUnseen (Daily) each return their own slice,
// most-forgotten-first and hash-spread respectively, capped at `limit`.
func (s *Server) bookCandidates(uid int64, bucket deckBucket, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	rs := bookSource()
	q := `SELECT x.id, x.book_id, COALESCE(x.quote,''), COALESCE(x.note,''), x.color,
	             p.title, COALESCE(p.author,''), COALESCE(x.chapter,''), COALESCE(x.location,''),
	             ` + schedCols + `
	      FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where()
	args := []any{reviewMinStability, uid}
	clause, cargs := rs.bucketClause(bucket, mod, day, seed)
	q += clause
	args = append(args, cargs...)
	if limit > 0 {
		q += ` LIMIT ?`
		args = append(args, limit)
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

func (s *Server) screenCandidates(uid int64, bucket deckBucket, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	rs := screenSource()
	q := `SELECT x.id, x.movie_id, COALESCE(x.quote,''), COALESCE(x.note,''), x.color, p.title, COALESCE(x.character,''),
	             COALESCE(x.actor,''), COALESCE(x.timestamp,''), x.season, x.episode, COALESCE(p.media_type,'movie'),
	             ` + schedCols + `
	      FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where()
	args := []any{reviewMinStability, uid}
	clause, cargs := rs.bucketClause(bucket, mod, day, seed)
	q += clause
	args = append(args, cargs...)
	if limit > 0 {
		q += ` LIMIT ?`
		args = append(args, limit)
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
		if err := rows.Scan(&c.card.ID, &movieID, &c.card.Quote, &c.card.Note, &c.card.Color, &c.card.Title, &c.card.Character,
			&c.card.Actor, &c.card.Timestamp, &c.card.Season, &c.card.Episode, &c.card.MediaType,
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

// utteranceCandidates is the third kind, and the one that does not fit the
// pattern: a standalone quote has no parent row, so its user scope is its own
// column, and its "work" is derived from two text fields rather than read from a
// join. Everything downstream — the bucket ordering, the per-work spread, the
// distractor ranking — then treats it like the other two.
func (s *Server) utteranceCandidates(uid int64, bucket deckBucket, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	rs := utteranceSource()
	q := `SELECT x.id, COALESCE(x.quote,''), COALESCE(x.note,''), x.color,
	             COALESCE(x.speaker,''), COALESCE(x.occasion,''), COALESCE(x.occasion_date,''),
	             ` + schedCols + `
	      FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where()
	args := []any{reviewMinStability, uid}
	clause, cargs := rs.bucketClause(bucket, mod, day, seed)
	q += clause
	args = append(args, cargs...)
	if limit > 0 {
		q += ` LIMIT ?`
		args = append(args, limit)
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
		var speaker, occasion string
		c.card.Kind = kindUtterance
		if err := rows.Scan(&c.card.ID, &c.card.Quote, &c.card.Note, &c.card.Color,
			&speaker, &occasion, &c.card.OccasionDate,
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &lr, &c.lastResult, &c.age); err != nil {
			olog.Warnf(olog.CodeReviewRowScan, "[review] utterance candidate row scan failed: %v", err)
			continue
		}
		c.card.Speaker = speaker
		// Title is the attribution, because Title is what the "which source?"
		// question offers as an answer. The eligibility rule guarantees it is
		// non-empty here.
		c.card.Title = utteranceAttribution(speaker, occasion)
		c.workKey = utteranceWorkKey(speaker, occasion)
		c.elapsed = elapsedDays(lr)
		out = append(out, c)
	}
	return out, rows.Err()
}

// ---- deck assembly (shared by the Daily Quiz and Practice) ----

const (
	// reviewFetchHeadroom over-fetches per slot: buildQuestion rejects a card
	// that can't form a multiple-choice question (too few distinct titles), so
	// the deck needs spares to still fill.
	reviewFetchHeadroom = 5
	// reviewUnseenShare reserves every Nth Daily slot for a card never answered.
	// At the default quota of 8 that is 2 unseen a day.
	//
	// This is a policy trade-off, not a derivation. Intake costs more than one
	// answer each: a brand-new card takes the 7-day rung on its FIRST correct
	// recall (found=false takes the max() branch, not nextRung), so it returns at
	// +7 and again at +37 before reaching the 100-day rung. Two returns per
	// admission, plus N/100 a day of maintenance once a library matures. Holding
	// intake to a third keeps that within a default quota for a few hundred
	// cards; past that the backlog grows and the quota (2..10, srDaily) is the
	// user's lever. Deferring a due card doesn't make the schedule lie — the
	// header promises a due STATE, and the seen bucket stays ordered
	// most-overdue-first, so a backlog degrades into honest FIFO by overdue-ness
	// and the status dots stay truthful.
	reviewUnseenShare = 3
	// reviewSeedRange bounds Practice's per-request shuffle seed. The seed is an
	// addend in shuffleKey, not a factor, so it isn't what constrains overflow —
	// `id * 2654435761` is, and that stays inside int64 up to id ≈ 3.47e9. This
	// just keeps the seed a plain small integer. (Daily seeds off the local day
	// number instead, so a refresh returns the same deck.)
	reviewSeedRange = 1 << 20
)

// spreadByWork re-orders a ranked list so consecutive cards come from different
// works: it rotates through one queue per work, taking each work's best-ranked
// remaining card in turn. Queue order is first appearance, so the most-overdue
// work still leads.
//
// This is what stops one book owning a deck. The trade-off is deliberate: a work
// with 400 quotes and a work with 2 get one slot per rotation each, so a large
// book is covered more slowly than its share of the library — which is the
// point, since the complaint being fixed is a big import monopolising every
// deck. Small works drain, and the large one then takes their slots.
func spreadByWork(cands []reviewCand) []reviewCand {
	if len(cands) < 2 {
		return cands
	}
	order := make([]string, 0, 8)
	queues := make(map[string][]reviewCand, 8)
	for _, c := range cands {
		if _, seen := queues[c.workKey]; !seen {
			order = append(order, c.workKey)
		}
		queues[c.workKey] = append(queues[c.workKey], c)
	}
	if len(order) < 2 {
		return cands
	}
	out := make([]reviewCand, 0, len(cands))
	for len(out) < len(cands) {
		for _, k := range order {
			if len(queues[k]) == 0 {
				continue
			}
			out = append(out, queues[k][0])
			queues[k] = queues[k][1:]
		}
	}
	return out
}

// overdueRatio is how far past due a card is, in half-lives. Higher = more
// forgotten; the Daily deck's seen bucket leads with the largest.
func overdueRatio(c reviewCand) float64 {
	return c.elapsed / max(c.card.Stability, reviewMinStability)
}

// deckCandidates fetches one bucket across the in-scope media and merges them
// into a single ordering — the two queries each come back ordered, so a plain
// append would put every book ahead of every film.
func (s *Server) deckCandidates(uid int64, bucket deckBucket, sc reviewScope, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	var out []reviewCand
	if sc.books {
		bc, err := s.bookCandidates(uid, bucket, mod, day, seed, limit)
		if err != nil {
			return nil, err
		}
		out = append(out, bc...)
	}
	if sc.screen {
		dc, err := s.screenCandidates(uid, bucket, mod, day, seed, limit)
		if err != nil {
			return nil, err
		}
		out = append(out, dc...)
	}
	if sc.utterance {
		uc, err := s.utteranceCandidates(uid, bucket, mod, day, seed, limit)
		if err != nil {
			return nil, err
		}
		out = append(out, uc...)
	}
	if bucket == bucketDue {
		sort.SliceStable(out, func(i, j int) bool { return overdueRatio(out[i]) > overdueRatio(out[j]) })
	} else {
		sort.SliceStable(out, func(i, j int) bool {
			return shuffleKey(out[i].card.Kind, out[i].card.ID, seed) <
				shuffleKey(out[j].card.Kind, out[j].card.ID, seed)
		})
	}
	return spreadByWork(out), nil
}

// mergeDeck interleaves the reserved unseen cards evenly through the due ones so
// a session isn't front-loaded with the whole backlog, then appends whatever is
// left of both. That tail matters: buildQuestion can reject a card, and the
// spares are what keep the deck full rather than short.
func mergeDeck(due, unseen []reviewCand, slots, every int) []reviewCand {
	out := make([]reviewCand, 0, len(due)+len(unseen))
	di, ui := 0, 0
	for len(out) < slots && (di < len(due) || ui < len(unseen)) {
		wantUnseen := (len(out)+1)%every == 0 || di >= len(due)
		if wantUnseen && ui < len(unseen) {
			out = append(out, unseen[ui])
			ui++
			continue
		}
		if di >= len(due) {
			break
		}
		out = append(out, due[di])
		di++
	}
	out = append(out, due[di:]...)
	return append(out, unseen[ui:]...)
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
	quizOptions  = 4   // choices per question (fewer only if the pool is tiny)
	quizQuoteCap = 200 // quotes sampled per medium into the distractor pool
)

// workRef is one book / film / show with the metadata that makes a distractor
// "similar" to a given card: the person signal (author for a book, the cast for
// a screen work) and its genres. Distractors are ranked by overlap with the
// card's own work — see distractorScore.
type workRef struct {
	key   string // "book:12" / "screen:7" / "utterance:burma radio broadcast"
	kind  string
	title string
	// author is the person credited with the work: a book's author, or — for a
	// standalone quote, whose "work" is the occasion — its speaker. Both play the
	// same two roles: the chip under the option, and the signal that makes
	// another work a confusable distractor.
	author   string
	director string          // screen only
	genres   map[string]bool // books + screen
	actors   map[string]bool // screen only, lowercased (similarity matching)
	// actorNames keeps the first-seen casing of each dialogue actor — the map
	// above lowercases for matching, but option chips need a display name.
	actorNames []string
}

// person is the credit an option chip shows for this work: a book's author, a
// quote's speaker, a screen work's dialogue actor (falling back to its
// director).
func (w workRef) person() optionMeta {
	if w.kind == kindBook {
		if w.author != "" {
			return optionMeta{Person: w.author, Kind: "author"}
		}
		return optionMeta{}
	}
	if w.kind == kindUtterance {
		// A quote with no occasion is titled by its speaker already; repeating the
		// name as its own chip would just read as a stutter.
		if w.author != "" && w.author != w.title {
			return optionMeta{Person: w.author, Kind: "speaker"}
		}
		return optionMeta{}
	}
	if len(w.actorNames) > 0 {
		return optionMeta{Person: w.actorNames[0], Kind: "actor"}
	}
	if w.director != "" {
		return optionMeta{Person: w.director, Kind: "director"}
	}
	return optionMeta{}
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

func (s *Server) quizPools(uid int64, sc reviewScope) (quizPools, error) {
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
	if sc.books {
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
	if sc.screen {
		if err := scan(`SELECT id, title, COALESCE(director,'') FROM movies WHERE user_id = ? AND title <> ''`,
			func(rows *sql.Rows) error {
				var id int64
				var title, director string
				if err := rows.Scan(&id, &title, &director); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] screen work row scan failed: %v", err)
					return nil
				}
				k := kindScreen + ":" + strconv.FormatInt(id, 10)
				p.byKey[k] = workRef{key: k, kind: kindScreen, title: title, director: director, genres: map[string]bool{}, actors: map[string]bool{}}
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
					if !w.actors[strings.ToLower(actor)] {
						w.actors[strings.ToLower(actor)] = true
						// Slice append doesn't flow through the map copy the way
						// the shared actors map does — write the struct back.
						w.actorNames = append(w.actorNames, actor)
						p.byKey[kindScreen+":"+strconv.FormatInt(id, 10)] = w
					}
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
	if sc.utterance {
		// One pass, not two: a standalone quote has no work table, so the speeches
		// ARE the quotes grouped by attribution. That means the sample cap bounds
		// the works pool too, unlike the other kinds — no matter, since a question
		// needs four options and a card whose own work missed the sample already
		// falls back to a title-only option. The eligibility rule matches
		// utteranceCandidates' — a quote with no attribution belongs to no work and
		// would otherwise become a distractor with a blank title.
		if err := scan(`SELECT COALESCE(quote,''), COALESCE(note,''), COALESCE(speaker,''), COALESCE(occasion,'')
		                FROM utterances
		                WHERE user_id = ? AND (COALESCE(quote,'') <> '' OR COALESCE(note,'') <> '')
		                  AND (COALESCE(occasion,'') <> '' OR COALESCE(speaker,'') <> '')
		                ORDER BY RANDOM() LIMIT `+strconv.Itoa(quizQuoteCap),
			func(rows *sql.Rows) error {
				var quote, note, speaker, occasion string
				if err := rows.Scan(&quote, &note, &speaker, &occasion); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] utterance pool row scan failed: %v", err)
					return nil
				}
				key := utteranceWorkKey(speaker, occasion)
				w, ok := p.byKey[key]
				if !ok {
					w = workRef{key: key, kind: kindUtterance, title: utteranceAttribution(speaker, occasion),
						author: speaker, genres: map[string]bool{}, actors: map[string]bool{}}
					p.byKey[key] = w
				}
				text := quote
				if text == "" {
					text = note
				}
				p.quotes = append(p.quotes, quoteRef{work: w, text: text})
				return nil
			}); err != nil {
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
// A standalone quote follows the book rule with its speaker in the author's
// place: two speeches by the same person are the hard pair to tell apart, and
// there are no genres to break the tie with.
func distractorScore(own, cand workRef) int {
	if cand.key == own.key {
		return -1 // never itself
	}
	score := 0
	if cand.kind == own.kind {
		score += 1_000_000 // same medium strongly preferred
		if own.kind == kindBook || own.kind == kindUtterance {
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
		cardSeed = seed*1000003 + c.card.ID*97 + int64(kindSalt(c.card.Kind)%1000)
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
		// options = work titles, ranked by similarity; answer = own title. Each
		// option keeps its workRef so the client gets a person chip per title
		// (OptionMeta) alongside the plain Options strings.
		answer := own
		if answer.title == "" { // own work missing from the pool — title-only option
			answer = workRef{key: ownKey, kind: card.Kind, title: card.Title}
		}
		var distractors []workRef
		for _, w := range rankWorks(own, p.works, rng) {
			if w.title != card.Title {
				distractors = append(distractors, w)
			}
		}
		opts, ans := choicesFromWorks(answer, distractors, quizOptions, rng)
		if len(opts) < 2 {
			return false
		}
		card.Options = make([]string, len(opts))
		card.OptionMeta = make([]optionMeta, len(opts))
		for i, o := range opts {
			card.Options[i] = o.title
			card.OptionMeta[i] = o.person()
		}
		card.Answer = ans
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
	// Quote options are sent WHOLE. They used to be clipped to 140 runes with an
	// ellipsis, which is roughly three lines on a phone — so on a long quote the
	// reader was asked to pick between four passages whose ends they could not
	// read, and no amount of tapping would show them. Clipping was the server
	// deciding a layout question, and it decided it destructively.
	//
	// The client clamps and offers its own expander. That also means two quotes
	// sharing a 140-rune opening are no longer folded together as duplicates by
	// choicesFrom, which could quietly leave a card with fewer choices than it
	// should have had.
	var distractors []string
	for _, q := range rankQuotes(own, p.quotes, rng) {
		if q.work.key == ownKey || q.work.title == card.Title {
			continue // never a quote from the same work
		}
		distractors = append(distractors, q.text)
	}
	opts, ans := choicesFrom(correct, distractors, quizOptions, rng)
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

// choicesFromWorks is choicesFrom over workRefs — same dedupe (by title),
// shuffle and answer-index contract, but each option keeps its workRef so the
// caller can attach a person chip per title.
func choicesFromWorks(answer workRef, distractors []workRef, n int, rng *rand.Rand) ([]workRef, int) {
	opts := []workRef{answer}
	seen := map[string]bool{answer.title: true}
	for _, d := range distractors {
		if len(opts) >= n {
			break
		}
		if d.title != "" && !seen[d.title] {
			seen[d.title] = true
			opts = append(opts, d)
		}
	}
	shuffleN(rng, len(opts), func(i, j int) { opts[i], opts[j] = opts[j], opts[i] })
	for i, o := range opts {
		if o.title == answer.title {
			return opts, i
		}
	}
	return opts, 0
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
	scope := scopeFlags(pf.SRReviewScope)
	day, seed, mod := reviewDay(offset)
	answered, got, forgot, err := s.dailyTally(uid, day)
	if err != nil {
		internalError(w, r, "daily quiz tally", err)
		return
	}
	items := []reviewCard{}
	if slots := pf.SRDaily - answered; slots > 0 {
		pools, err := s.quizPools(uid, scope)
		if err != nil {
			internalError(w, r, "daily quiz pools", err)
			return
		}
		// The two buckets are fetched SEPARATELY, each with its own limit. One
		// query ordered seen-before-unseen let the due backlog fill the whole
		// fetch, so a never-answered card could not reach the deck at all until
		// the backlog cleared.
		fetch := slots * reviewFetchHeadroom
		due, err := s.deckCandidates(uid, bucketDue, scope, mod, day, seed, fetch)
		if err != nil {
			internalError(w, r, "daily quiz due", err)
			return
		}
		unseen, err := s.deckCandidates(uid, bucketUnseen, scope, mod, day, seed, fetch)
		if err != nil {
			internalError(w, r, "daily quiz unseen", err)
			return
		}
		for _, c := range mergeDeck(due, unseen, slots, reviewUnseenShare) {
			if len(items) >= slots {
				break
			}
			if card, ok := buildQuestion(c, dailyDirection(c.card.Kind, c.card.ID, seed), pools, seed); ok {
				items = append(items, card)
			}
		}
	}
	states, err := s.reviewStates(uid, scope)
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
	scope := scopeFlags(pf.SRReviewScope)
	pools, err := s.quizPools(uid, scope)
	if err != nil {
		internalError(w, r, "practice pools", err)
		return
	}
	// Same selector as the Daily Quiz, so Practice inherits the hash-spread
	// sample and the per-work rotation — a round no longer walks forty quotes
	// from one book. What Practice does NOT inherit is the due filter or the
	// unseen reservation: it has no schedule to honour, so reserving slots for
	// unseen cards would make an already-reviewed card *more* likely to come up
	// than an unreviewed one. bucketAll keeps every card equally likely. The seed
	// is fresh per request, so each round is a different walk.
	cands, err := s.deckCandidates(uid, bucketAll, scope, "", "", rand.Int64N(reviewSeedRange), 0)
	if err != nil {
		internalError(w, r, "practice pool", err)
		return
	}
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
	if !validReviewKind(req.Kind) {
		writeErr(w, http.StatusBadRequest, "kind must be book, screen or utterance")
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
	var reviewCount, lapseCount int
	found := true
	err = tx.QueryRow(`SELECT stability, review_count, lapse_count, last_reviewed_at, COALESCE(last_result, ''), COALESCE(date(last_touched_at, ?) = ?, 0)
	                   FROM item_reviews WHERE kind = ? AND item_id = ?`, mod, day, req.Kind, req.ID).
		Scan(&stability, &reviewCount, &lapseCount, &lastReviewed, &lastResult, &touchedToday)
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
		// The ladder: a card's FIRST successful recall takes the 7-day starting
		// rung — whether it has no row yet or a row built purely from lapses
		// (review_count == lapse_count ⇔ zero "got"s so far) — and every later
		// success climbs one rung. Any lapse falls back to the start. max() so a
		// "seen"-lengthened half-life is never shortened by a success.
		if req.Result == "got" {
			if found && reviewCount > lapseCount {
				stability = nextRung(stability)
			} else {
				stability = max(stability, reviewLadder[0])
			}
		} else { // forgot
			stability = reviewLadder[0]
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

// itemAgeDays is how many days ago the item behind a card was added — the clock
// for the new-item grace week. A missing or garbled timestamp reads as very old
// (no accidental grace).
//
// Switched exhaustively rather than defaulted: an unrecognised kind used to read
// annotations, so a mistyped kind would have silently aged someone's annotation
// by that id instead of failing.
func (s *Server) itemAgeDays(kind string, id int64) (float64, error) {
	var table string
	switch kind {
	case kindBook:
		table = "annotations"
	case kindScreen:
		table = "dialogues"
	case kindUtterance:
		table = "utterances"
	default:
		return 1e9, fmt.Errorf("unknown review kind %q", kind)
	}
	var age float64
	err := s.Store.DB.QueryRow(
		`SELECT COALESCE(julianday('now') - julianday(created_at), 1e9) FROM `+table+` WHERE id = ?`, id).Scan(&age)
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
	scope := scopeFlags(pf.SRReviewScope)
	states, err := s.reviewStates(uid, scope)
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

// ownsItem verifies the caller owns the item behind a card (item_reviews has no
// user_id of its own). This is the only thing standing between a review write
// and someone else's row, so an unknown kind answers "no" rather than falling
// through to a table it was never asked about.
func (s *Server) ownsItem(uid int64, kind string, id int64) (bool, error) {
	var q string
	switch kind {
	case kindBook:
		q = `SELECT EXISTS(SELECT 1 FROM annotations a JOIN books b ON b.id = a.book_id WHERE a.id = ? AND b.user_id = ?)`
	case kindScreen:
		q = `SELECT EXISTS(SELECT 1 FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE d.id = ? AND m.user_id = ?)`
	case kindUtterance:
		q = `SELECT EXISTS(SELECT 1 FROM utterances WHERE id = ? AND user_id = ?)`
	default:
		return false, nil
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
	day, _, mod := reviewDay(offset)
	total := 0
	for _, rs := range sourcesFor(scopeFlags(pf.SRReviewScope)) {
		q := `SELECT COUNT(*) FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where() + `
		        AND (r.item_id IS NULL OR date(r.last_touched_at, ?) <> ?)
		        AND ` + dueSQL + `
		        AND COALESCE(julianday('now') - julianday(x.created_at), 1e9) >= ?`
		var n int
		if err := s.Store.DB.QueryRow(q, uid, mod, day, reviewNewItemDays).Scan(&n); err != nil {
			return 0, err
		}
		total += n
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
func (s *Server) reviewStates(uid int64, sc reviewScope) (statusCounts, error) {
	var c statusCounts
	tally := func(rs reviewSource) error {
		rows, err := s.Store.DB.Query(`
			SELECT r.item_id IS NOT NULL, COALESCE(r.stability, ?), r.last_reviewed_at, COALESCE(r.last_result, ''),
			       COALESCE(julianday('now') - julianday(x.created_at), 1e9)
			FROM `+rs.from()+` `+rs.reviewJoin()+` `+rs.where(),
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
	for _, rs := range sourcesFor(sc) {
		if err := tally(rs); err != nil {
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
	scope := scopeFlags(pf.SRReviewScope)
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

	states, err := s.reviewStates(uid, scope)
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
	if !validReviewKind(req.Kind) {
		writeErr(w, http.StatusBadRequest, "kind must be book, screen or utterance")
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
