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
	// reviewLeechLapses is how many times a card has to be forgotten before the
	// deck offers a way out of it. Five is Anki's default, which is what makes
	// the word mean the same thing here as it does to anyone who has met one
	// before. It is a threshold for an OFFER and nothing else: no card is
	// suspended, nothing leaves the deck, and the quiz keeps asking until the
	// reader says otherwise. A card that vanished because a counter reached five
	// would be the app deciding something nobody asked it to decide.
	reviewLeechLapses = 5
)

// Adaptive-interval constants (srAdaptive, off by default). The fixed ladder is
// the honest default and stays the default; these describe the OTHER rule.
//
// The one place the ladder is harsher than the science asks is the lapse: it
// drops a card to 7 from any rung, so a single miss on a card you have recalled
// four times costs you the whole climb. Anki's move to FSRS made the argument
// that a lapse should SHORTEN rather than reset mainstream, and that is the
// substance of this option — reviewShrink, not reviewGrow, is why it exists.
//
// The bounds do not change: adaptive still lives between reviewMinStability and
// reviewMaxStability, so every query that floors or caps a half-life keeps
// working unchanged and no stored value can promise a review past 100 days.
const (
	reviewGrow   = 2.5 // successful recall multiplier (SM-2's classic ease)
	reviewShrink = 0.5 // lapse multiplier — halve the half-life, never reset it
	reviewLate   = 1.2 // late-recall credit: recalling it this long after the last review is itself evidence
)

// ---- difficulty weighting (1.16.0) -----------------------------------------
//
// NOT EVERY QUESTION IS THE SAME QUESTION, and the schedule used to pretend it
// was. Picking the right book out of four is recognition with three quarters of
// the work already done for you; typing the missing words back is recall with
// nothing to lean on. Both moved the half-life by the same multiplier, so a
// reader who kept getting the easy ones right was told they knew a quote as well
// as one who could reproduce it.
//
// A harder question pays more when you get it right and costs LESS when you do
// not, and the second half is what makes it fair rather than merely generous:
// failing the hardest question in the deck is weak evidence that you have
// forgotten the quote, where failing to recognise it among four is strong
// evidence.
//
//	MCQ (source / quote / speaker)   x1.00 up   x1.00 down   the baseline
//	cloze - type the missing words   x1.25 up   x0.85 down   nothing to lean on
//
// A flip card carries no weight because it never reaches a scored deck (see
// directionsForMode), and in unscored Practice there is nothing to multiply.
const (
	clozeGrowWeight   = 1.25
	clozeShrinkWeight = 0.85
)

// directionWeight returns the (reward, penalty) multipliers for a direction.
// An unknown direction weighs 1 - a direction added without a weight behaves
// exactly as everything did before rather than silently scoring zero.
func directionWeight(direction string, t reviewTuning) (grow, shrink float64) {
	switch direction {
	case dirCloze:
		return t.ClozeGrow, t.ClozeShrink
	default:
		return 1, 1
	}
}

// weighByDifficulty scales the MOVE an answer earned, not the value it landed on.
// `next` is what nextStability returned and `cur` is where the card was, so
// next-cur is the distance the baseline rules chose and the weight stretches or
// shortens it in place.
//
// Working on the distance rather than the result is what keeps this composable
// with both scheduling rules: the fixed ladder and the adaptive multiplier each
// hand back a half-life, and neither needs to know a weight exists. The bounds
// are re-applied because a stretched move can leave the range.
func weighByDifficulty(direction, result string, cur, next float64, t reviewTuning) float64 {
	grow, shrink := directionWeight(direction, t)
	w := grow
	if result != "got" {
		w = shrink
	}
	if w == 1 {
		return next
	}
	out := cur + (next-cur)*w
	return min(max(out, reviewMinStability), reviewMaxStability)
}

// nextStability is the half-life an answer earns. Both scheduling rules live
// here, together, because the only way to be sure the opt-in rule differs from
// the default ONLY where it is meant to is to read them side by side.
//
// `succeeded` is whether the card has ever been recalled correctly before
// (review_count > lapse_count). Both rules treat the first success identically —
// it takes the starting rung and no more — because a card with no track record
// has demonstrated nothing yet, whichever rule you are under. The rules diverge
// only once there is a history to be adaptive about.
// The bounds are applied ONCE, on the way out, rather than by each branch. Every
// branch here multiplies or picks, and both operations can leave the range: the
// version of this function that clamped per-branch was correct in four places and
// wrong in the fifth, which is the failure mode a single exit removes.
func nextStability(adaptive bool, result string, cur, elapsed float64, succeeded bool, t reviewTuning) float64 {
	clamp := func(v float64) float64 { return min(max(v, reviewMinStability), reviewMaxStability) }
	if result == "got" && !succeeded {
		// max(), not assignment: a "seen"-lengthened half-life must never be
		// shortened by a correct answer.
		return clamp(max(cur, t.Ladder1))
	}
	if !adaptive {
		if result == "got" {
			return clamp(nextRung(cur, t.ladder()))
		}
		return clamp(t.Ladder1) // lapse: straight back to the first rung
	}
	if result == "got" {
		// Grow multiplicatively, but never award less than the elapsed gap itself
		// warrants: remembering something 90 days after the last review is direct
		// evidence the half-life is around 90, not around cur*2.5.
		return clamp(max(cur*t.Grow, elapsed*reviewLate))
	}
	return clamp(cur * t.Shrink) // lapse: shortened, not reset
}

// reviewLadder is the fixed spaced-repetition ladder (days): a correct recall
// climbs to the next rung above the card's current half-life, any lapse falls
// straight back to the first rung, and cards sit on the top rung for as long
// as the correct answers keep coming. Off-rung half-lives (pre-ladder rows,
// srSeen bumps) climb to the nearest rung above, so every card converges onto
// the ladder. Migration 0019 clamps stored values to the new 100-day cap.
var reviewLadder = [...]float64{reviewMinStability, 30, reviewMaxStability}

// nextRung is the half-life a successful recall earns: the smallest rung
// strictly above the current one, or the top rung once there is none.
func nextRung(cur float64, ladder [3]float64) float64 {
	for _, r := range ladder {
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
	dirFlip   = "flip"   // show the quote, reveal the source, grade yourself
	dirCloze  = "cloze"  // blank a phrase out of the quote, type it back
	// Screen only: a book has no cast, which is why directionsFor is per-kind.
	dirSpeaker = "speaker" // show the line, recall WHO said it (options are actors)
)

// directionsFor is every question a card of this kind can be asked, in one
// ordered table.
//
// ONE TABLE, NOT A CHAIN OF IFS. Each new direction was designed as its own
// rewrite of dailyDirection's two-way toggle into a differently-shaped three-way,
// and the rewrites were mutually exclusive — %3 here, a second hash there, a
// screen-only branch in the third. A table makes "what can this kind be asked?"
// one question with one answer, and makes adding a fifth direction an edit to a
// list rather than to a modulus.
//
// PER-KIND, because the applicability is real and not a special case: a book has
// no cast, so it can never be asked who said the line. Putting that here rather
// than in the picker is what stops it becoming an `if kind == ...` at the call
// site, which is where the last three rewrites all wanted to put it.
//
// THE WEIGHTING IS A DELIBERATE CHOICE AND NOT AN ACCIDENT OF LENGTH. Adding
// directions dilutes the old ones: "which book is this quote from?" was half of
// a book's cards and is now a third. That is intended — the section exists to
// make the loop deeper rather than to ask one question more often — but it is a
// visible change to every existing account, so it is decided here, in the table,
// where changing it is changing one line.
// THE DAILY QUIZ DOES NOT ASK A SELF-SCORED QUESTION (1.16.0), and that is a
// deliberate decision rather than a simplification.
//
// A flip card shows the quote, reveals the source, and asks the reader to say
// whether they had it. Nothing checks the answer, so the grade is whatever they
// say — and that grade moves the SCHEDULE. Every other card in the daily deck is
// marked by the server against a right answer, so one card in five being
// self-marked does not make the deck slightly softer, it makes the whole number
// mean something else: a streak and an accuracy figure that mix graded and
// self-graded answers can be read as neither. The daily score is the one thing
// in this app that is meant to be earned.
//
// It stays in Practice, where it belongs and where it is the DEFAULT — no
// options to recognise the answer from, no distractors doing half the work, just
// the quote and your own honesty. When Practice scoring is turned on it drops out
// there too, for exactly the same reason.
//
// THE FALLBACK IS THE CLOZE, and that is what makes taking flip out safe. Flip
// was the card that could never fail to build, because it needs no distractors —
// so removing it looks like it would leave a one-book library with an empty deck.
// It does not: a cloze needs no distractors either. It masks a phrase out of the
// card's OWN words, so one quote from one book is a complete question, and the
// server grades the typed answer typo-tolerantly. The hole left is only the one
// cloze genuinely cannot fill — a quote too short to mask, or one outside the
// Latin script the stopword list understands — and a card with no gradable
// question is left out of the round rather than downgraded to a self-marked one.
func directionsFor(kind string) []string {
	return directionsForMode(kind, false, nil)
}

// directionsForMode is directionsFor with the one axis that changes: whether the
// answers are being SCORED. Self-scored cards are offered only when nothing is
// counting.
//
// One function rather than two lists, because the two must not be able to drift:
// the daily builder and the practice builder both come through here, so a
// direction added to one is added to both by construction and the only question
// left is whether it may be self-marked.
//
// `on` is the READER'S repertoire (review_questions.go) — nil means everything
// this build can ask, which is what every caller passed before the in-depth
// controls existed and what the internal callers still pass.
//
// THE FILTER IS APPLIED LAST AND CANNOT EMPTY THE RESULT. review_questions.go
// guarantees each deck keeps a direction that applies to every kind, so the
// intersection here is non-empty for every kind — but a guarantee made in
// another file is a guarantee that can be broken by a change to that file, and
// the failure would be an empty deck rather than a compile error. So it is also
// checked here, where the cost is one branch.
func directionsForMode(kind string, scored bool, on map[string]bool) []string {
	dirs := []string{dirSource, dirQuote, dirCloze}
	if kind == kindScreen {
		// A book has no cast, which is why this is per-kind: it can never be
		// asked who said the line.
		dirs = append(dirs, dirSpeaker)
	}
	if !scored {
		dirs = append(dirs, dirFlip)
	}
	if on == nil {
		return dirs
	}
	kept := make([]string, 0, len(dirs))
	for _, d := range dirs {
		if on[d] {
			kept = append(kept, d)
		}
	}
	if len(kept) == 0 {
		return dirs
	}
	return kept
}

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
//
// IT DOES NOT USE shuffleKey, and that is the correction. shuffleKey is the
// deck's ORDER key — it is what mergeDeck and the candidate queries sort by — so
// deriving the direction from the same number ties the two together: every card
// asked one way clusters at one end of the session and the other way at the
// other, which reads as the quiz having moods. A second hash off the same inputs
// keeps them independent.
func dailyDirection(kind string, id, seed int64, on map[string]bool) string {
	// The daily deck is always scored, so it is never offered a flip card.
	dirs := directionsForMode(kind, true, on)
	h := uint64(id)*0x9E3779B97F4A7C15 + kindSalt(kind)*31 + uint64(seed)*0xBF58476D1CE4E5B9
	h ^= h >> 29
	return dirs[h%uint64(len(dirs))]
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
	episodeRef           // screen only, shows only; null on a film's lines
	MediaType    string  `json:"media_type"` // movie | show (screen); "" for book
	Stability    float64 `json:"stability"`
	ReviewCount  int     `json:"review_count"`
	// LapseCount is how many times this card has been forgotten — stored since
	// 0015 and, until now, never read by anything. It sits beside ReviewCount
	// because the two are always read together: review_count > lapse_count is
	// what nextStability calls "has succeeded before", and lapse_count alone is
	// what makes a leech.
	LapseCount int `json:"lapse_count"`
	// Leech — forgotten reviewLeechLapses times or more. NOT an instruction: the
	// card stays in the deck and keeps being asked. This is the deck saying out
	// loud that a card is costing a slot and giving nothing back, so the reader
	// can be offered a way out of it. The threshold lives on the server so
	// "five" is one number rather than one per surface.
	Leech  bool   `json:"leech"`
	Status string `json:"status"`
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
	// tagJoin / tagKey name this kind's tag join table, for themed rounds. Each
	// kind has its own rather than one shared table.
	tagJoin string
	tagKey  string
}

func bookSource() reviewSource {
	return reviewSource{kind: kindBook, table: "annotations", parent: "books", parentKey: "book_id", idCol: "x.id",
		tagJoin: "annotation_tags", tagKey: "annotation_id"}
}

func screenSource() reviewSource {
	return reviewSource{kind: kindScreen, table: "dialogues", parent: "movies", parentKey: "movie_id", idCol: "x.id",
		tagJoin: "dialogue_tags", tagKey: "dialogue_id"}
}

func utteranceSource() reviewSource {
	return reviewSource{kind: kindUtterance, table: "utterances", idCol: "x.id",
		eligible: `AND (COALESCE(x.occasion,'') <> '' OR COALESCE(x.speaker,'') <> '')`,
		tagJoin:  "utterance_tags", tagKey: "utterance_id"}
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

// where is the eligibility rule: owned by the caller, has words, not opted out,
// and whatever else the kind requires. The `?` takes the user id.
//
// THIS IS THE ONE CHOKE POINT, and that is why the exclusion goes here rather
// than into each query. Five callers splice this string — the three candidate
// fetches, dailyRemaining's count and reviewStates' breakdown — and a rule added
// to four of them is a deck that will not serve a card the badge is still
// counting, which reads as the quiz being broken rather than as a filter being
// inconsistent.
// ONE FLAG, NOT TWO. 0033 also ANDed the parent's `review_excluded` here, so a
// highlight could be kept out of the deck by its book without anything on the
// quote saying so — and that made the control that clears the quote's own flag
// lie. It offered "Add to quiz", cleared the column, toasted "back in the quiz",
// and the deck went on refusing to serve the card because the other flag was
// still set. Nothing on screen resolved it: the mark read both flags, the button
// read one.
//
// So the flag that GATES is now the flag the reader can see and change on the
// card in front of them. Excluding a work still reaches its quotes — it writes
// the column on all of them, and seeds the ones added later — but it does that
// as a write they can see and undo, not as a term in this query.
func (rs reviewSource) where() string {
	return "WHERE " + rs.ownerCol() + " = ? AND (COALESCE(x.quote,'') <> '' OR COALESCE(x.note,'') <> '')" +
		" AND COALESCE(x.review_excluded,0) = 0 " + rs.eligible
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
const schedCols = `r.item_id IS NOT NULL, COALESCE(r.stability, ?), COALESCE(r.review_count,0), COALESCE(r.lapse_count,0), r.last_reviewed_at,
                   COALESCE(r.last_result,''), COALESCE(julianday('now') - julianday(x.created_at), 1e9)`

// bookCandidates / screenCandidates / utteranceCandidates fetch reviewable cards
// for one bucket. bucketAll (Practice) returns the whole in-scope pool;
// bucketDue / bucketUnseen (Daily) each return their own slice,
// most-forgotten-first and hash-spread respectively, capped at `limit`.
func (s *Server) bookCandidates(uid int64, bucket deckBucket, th reviewTheme, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	rs := bookSource()
	q := `SELECT x.id, x.book_id, COALESCE(x.quote,''), COALESCE(x.note,''), x.color,
	             p.title, COALESCE(p.author,''), COALESCE(x.chapter,''), COALESCE(x.location,''),
	             ` + schedCols + `
	      FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where()
	args := []any{reviewMinStability, uid}
	// The theme, spliced HERE and never into rs.where() — that string is also
	// read by dailyRemaining and reviewStates, which are Daily's badge and
	// Daily's status row, and a theme in either would narrow both.
	tclause, targs, skip := th.clause(rs)
	if skip {
		return nil, nil
	}
	q += tclause
	args = append(args, targs...)
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
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &c.card.LapseCount, &lr, &c.lastResult, &c.age); err != nil {
			olog.Warnf(olog.CodeReviewRowScan, "[review] book candidate row scan failed: %v", err)
			continue
		}
		c.workKey = kindBook + ":" + strconv.FormatInt(bookID, 10)
		c.elapsed = elapsedDays(lr)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Server) screenCandidates(uid int64, bucket deckBucket, th reviewTheme, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	rs := screenSource()
	q := `SELECT x.id, x.movie_id, COALESCE(x.quote,''), COALESCE(x.note,''), x.color, p.title, COALESCE(x.character,''),
	             COALESCE(x.actor,''), COALESCE(x.timestamp,''), x.season, x.episode, COALESCE(p.media_type,'movie'),
	             ` + schedCols + `
	      FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where()
	args := []any{reviewMinStability, uid}
	// The theme, spliced HERE and never into rs.where() — that string is also
	// read by dailyRemaining and reviewStates, which are Daily's badge and
	// Daily's status row, and a theme in either would narrow both.
	tclause, targs, skip := th.clause(rs)
	if skip {
		return nil, nil
	}
	q += tclause
	args = append(args, targs...)
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
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &c.card.LapseCount, &lr, &c.lastResult, &c.age); err != nil {
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
func (s *Server) utteranceCandidates(uid int64, bucket deckBucket, th reviewTheme, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	rs := utteranceSource()
	q := `SELECT x.id, COALESCE(x.quote,''), COALESCE(x.note,''), x.color,
	             COALESCE(x.speaker,''), COALESCE(x.occasion,''), COALESCE(x.occasion_date,''),
	             ` + schedCols + `
	      FROM ` + rs.from() + ` ` + rs.reviewJoin() + ` ` + rs.where()
	args := []any{reviewMinStability, uid}
	// The theme, spliced HERE and never into rs.where() — that string is also
	// read by dailyRemaining and reviewStates, which are Daily's badge and
	// Daily's status row, and a theme in either would narrow both.
	tclause, targs, skip := th.clause(rs)
	if skip {
		return nil, nil
	}
	q += tclause
	args = append(args, targs...)
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
			&c.seen, &c.card.Stability, &c.card.ReviewCount, &c.card.LapseCount, &lr, &c.lastResult, &c.age); err != nil {
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
func (s *Server) deckCandidates(uid int64, bucket deckBucket, sc reviewScope, th reviewTheme, mod, day string, seed int64, limit int) ([]reviewCand, error) {
	var out []reviewCand
	if sc.books {
		bc, err := s.bookCandidates(uid, bucket, th, mod, day, seed, limit)
		if err != nil {
			return nil, err
		}
		out = append(out, bc...)
	}
	if sc.screen {
		dc, err := s.screenCandidates(uid, bucket, th, mod, day, seed, limit)
		if err != nil {
			return nil, err
		}
		out = append(out, dc...)
	}
	if sc.utterance {
		uc, err := s.utteranceCandidates(uid, bucket, th, mod, day, seed, limit)
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
	// Derived, never stored — the same discipline the status dot follows.
	card.Leech = card.LapseCount >= reviewLeechLapses
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
	// cast is the film's whole billed cast, from movies.cast_json — the people
	// who COULD have said a line in it, as against actorNames, which is only
	// those the reader has actually recorded saying one.
	//
	// The distinction is the whole quality of a "who said this?" card. Offering
	// three actors the reader has already quoted makes the answer guessable from
	// familiarity; offering three from the same film's billing makes it a
	// question about the film.
	cast []string
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

// quizPools samples the distractor material. `seed` is the day seed for the
// Daily Quiz and 0 for Practice.
//
// THE SAMPLE HAS TO BE STABLE, not just its order. The quote pool is capped at
// quizQuoteCap rows per medium, and it was capped with `ORDER BY RANDOM()` — so
// a library with more quotes than the cap handed every request a DIFFERENT two
// hundred. seededRand then carefully shuffled that varying sample with a stable
// seed, which cannot produce a stable answer: the same daily card offered
// different wrong answers on a phone and on a laptop, on the same day, and the
// seed introduced to stop exactly that could not reach the problem.
//
// So the daily deck orders by the same arithmetic hash the deck order already
// uses (shuffleKeySQL) rather than by RANDOM(). Practice passes 0 and keeps
// RANDOM(), on purpose: varying between rounds is the point there.
func (s *Server) quizPools(uid int64, sc reviewScope, seed int64) (quizPools, error) {
	p := quizPools{byKey: map[string]workRef{}}
	// sample is the ORDER BY for the capped quote pull, per kind.
	sampleOn := func(idCol, kind string) (string, []any) {
		if seed == 0 {
			return "ORDER BY RANDOM() LIMIT " + strconv.Itoa(quizQuoteCap), nil
		}
		return "ORDER BY " + shuffleKeySQL(idCol, kind) + " LIMIT " + strconv.Itoa(quizQuoteCap), []any{seed}
	}
	sample := func(kind string) (string, []any) { return sampleOn("a.id", kind) }
	scan := func(q string, fn func(*sql.Rows) error, extra ...any) error {
		rows, err := s.Store.DB.Query(q, append([]any{uid}, extra...)...)
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
		bookOrder, bookArgs := sample(kindBook)
		if err := scan(`SELECT a.id, a.book_id, COALESCE(a.quote,''), COALESCE(a.note,'')
		                FROM annotations a JOIN books b ON b.id = a.book_id
		                WHERE b.user_id = ? AND (COALESCE(a.quote,'') <> '' OR COALESCE(a.note,'') <> '')
		                `+bookOrder,
			p.quoteScanner(kindBook), bookArgs...); err != nil {
			return p, err
		}
	}
	if sc.screen {
		if err := scan(`SELECT id, title, COALESCE(director,''), COALESCE(cast_json,'')
		                FROM movies WHERE user_id = ? AND title <> ''`,
			func(rows *sql.Rows) error {
				var id int64
				var title, director, castJSON string
				if err := rows.Scan(&id, &title, &director, &castJSON); err != nil {
					olog.Warnf(olog.CodeReviewRowScan, "[review] screen work row scan failed: %v", err)
					return nil
				}
				k := kindScreen + ":" + strconv.FormatInt(id, 10)
				p.byKey[k] = workRef{
					key: k, kind: kindScreen, title: title, director: director,
					genres: map[string]bool{}, actors: map[string]bool{},
					// Already stored by the metadata fetch. No API call, exactly as
					// the roadmap promised.
					cast: castActors(castJSON),
				}
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
		screenOrder, screenArgs := sampleOn("d.id", kindScreen)
		if err := scan(`SELECT d.id, d.movie_id, COALESCE(d.quote,''), COALESCE(d.note,'')
		                FROM dialogues d JOIN movies m ON m.id = d.movie_id
		                WHERE m.user_id = ? AND (COALESCE(d.quote,'') <> '' OR COALESCE(d.note,'') <> '')
		                `+screenOrder,
			p.quoteScanner(kindScreen), screenArgs...); err != nil {
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
		uttOrder, uttArgs := sampleOn("id", kindUtterance)
		if err := scan(`SELECT COALESCE(quote,''), COALESCE(note,''), COALESCE(speaker,''), COALESCE(occasion,'')
		                FROM utterances
		                WHERE user_id = ? AND (COALESCE(quote,'') <> '' OR COALESCE(note,'') <> '')
		                  AND (COALESCE(occasion,'') <> '' OR COALESCE(speaker,'') <> '')
		                `+uttOrder,
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
			}, uttArgs...); err != nil {
			return p, err
		}
	}
	// SORTED, because a Go map does not iterate in a stable order and this slice
	// is the input to a SEEDED shuffle.
	//
	// seededRand exists so that "the exact options — distractor choice AND order —
	// are identical for every client viewing the same day's card". That promise
	// was not being kept. A seeded Fisher–Yates permutes the positions it is
	// given; run it over a slice whose starting order is random and the result is
	// random too, and rankWorks' SliceStable then preserves that randomness among
	// every equally-scored work. So the same card could offer different wrong
	// answers on a phone and a laptop, on the same day, which is the one thing
	// the seed was introduced to stop.
	//
	// The key is the sort field rather than the title: it is unique (kind + id),
	// so the order is total, and two works that genuinely share a title cannot
	// swap places between requests.
	for _, w := range p.byKey {
		p.works = append(p.works, w)
	}
	sort.Slice(p.works, func(i, j int) bool { return p.works[i].key < p.works[j].key })
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
// buildQuestion CANNOT FAIL, and that is a fix rather than a convenience.
//
// It used to return (reviewCard, bool) and both call sites dropped the card when
// it came back false — while dailyRemaining counts the same card in SQL, which
// knows nothing about whether a question could be built for it. So a library
// with one book in it had a badge saying cards were due and a deck that served
// none of them, and nothing anywhere reported a problem.
//
// The flip card is what makes the signature honest: it needs no distractor pool,
// no second work to be wrong with, and no maskable span, so there is always a
// question to ask about any quote with words in it.
func buildQuestion(c reviewCand, preferred string, p quizPools, seed int64, scored bool, on map[string]bool, clozeWords float64) (reviewCard, bool) {
	// Fold the day seed with the card identity into one stable per-card seed;
	// 0 stays 0 (practice → global RNG).
	cardSeed := seed
	if seed != 0 {
		cardSeed = seed*1000003 + c.card.ID*97 + int64(kindSalt(c.card.Kind)%1000)
		if cardSeed == 0 {
			cardSeed = 1
		}
	}
	// The preferred direction, then every other one this kind allows.
	if card := finishCard(c, preferred); attachDirection(&card, c.workKey, p, cardSeed, clozeWords) {
		return card, true
	}
	for _, d := range directionsForMode(c.card.Kind, scored, on) {
		if d == preferred {
			continue
		}
		if card := finishCard(c, d); attachDirection(&card, c.workKey, p, cardSeed, clozeWords) {
			return card, true
		}
	}
	// A SCORED DECK HAS NO ESCAPE HATCH, and that is the change. This used to end
	// `return finishCard(c, dirFlip)`: the flip card needs no distractors, so it
	// could never fail, which made it the guaranteed fallback for a card with too
	// little material around it. In a scored deck that guarantee is the bug — it
	// would put a self-marked card into the daily score, which is the one thing
	// 1.16.0 exists to stop.
	//
	// Almost nothing reaches here. The cloze above needs no distractors either,
	// only words: one quote from one book is a complete question. What is left is
	// a quote too short to mask a phrase out of, or one outside the Latin script
	// clozeReadable gates on — and for those there is honestly no question to ask,
	// so the card sits out the round.
	//
	// ok=false is impossible for an unscored deck, because flip is always
	// available there — which is why Practice can still show you everything.
	if scored {
		return reviewCard{}, false
	}
	return finishCard(c, dirFlip), true
}

// attachDirection fills in whatever a card's direction needs, and REFUSES a
// direction it does not know.
//
// The switch is exhaustive on purpose. This was `if direction == dirSource {…}`
// with everything else falling into the quote branch, which is fine while there
// are exactly two directions and is an answer leak the moment there are three: a
// card labelled with a direction this function had never heard of came back
// carrying quote options — the correct quote among them — while the client
// rendered it as something else entirely. A default that returns false makes an
// unknown direction produce no card instead of the wrong one.
func attachDirection(card *reviewCard, ownKey string, p quizPools, seed int64, clozeWords float64) bool {
	switch card.Direction {
	case dirSource, dirQuote:
		return attachMCQ(card, ownKey, p, seed)
	case dirFlip:
		// Nothing to attach: a flip card is the quote on one side and its source
		// on the other, both of which the card already carries.
		return true
	case dirCloze:
		return attachCloze(card, clozeWords)
	case dirSpeaker:
		return attachSpeaker(card, ownKey, p, seed)
	default:
		return false
	}
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

// attachCloze masks a phrase out of the card's own words.
//
// THE QUOTE IS OVERWRITTEN IN PLACE rather than joined by a second "masked"
// field, and that is load-bearing. Everything downstream reads `quote` — the
// client's QuoteBlock, the share image, the in-card edit form — so a parallel
// field would leave the real text sitting on the card for any of them to print.
// There is exactly one copy of the words on a cloze card, and it has a hole in
// it.
//
// THE ANSWER IS NOT SENT. Unlike an MCQ, whose `answer` is an index that means
// nothing without the options beside it, a cloze answer IS the thing being
// recalled — so it stays on the server and the attempt is graded there.
func attachCloze(card *reviewCard, multiWordFrom float64) bool {
	text := card.Quote
	if strings.TrimSpace(text) == "" {
		text = card.Note // a note-only quote is still words worth recalling
	}
	// The blank is ONE WORD until the card has been remembered long enough to
	// deserve a wider one — see clozeMultiWordFrom. The card already carries its
	// half-life, so nothing has to be threaded in for this.
	masked, _, ok := clozeSpan(text, card.Kind, card.ID, clozeMaxWordsFor(card.Stability, multiWordFrom))
	if !ok {
		return false
	}
	if strings.TrimSpace(card.Quote) == "" {
		card.Note = masked
	} else {
		card.Quote = masked
	}
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
	// The reader'''s repertoire for THIS deck (review_questions.go). Read once per
	// request rather than per card, and passed down rather than consulted at the
	// bottom, so the question of what may be asked is answered in one place.
	onDaily := parseReviewQuestions(pf.SRQuestions).forDeck(reviewDeckDaily)
	tuning := parseReviewTuning(pf.SRTuning)
	day, seed, mod := reviewDay(offset)
	answered, got, forgot, err := s.dailyTally(uid, day)
	if err != nil {
		internalError(w, r, "daily quiz tally", err)
		return
	}
	items := []reviewCard{}
	if slots := pf.SRDaily - answered; slots > 0 {
		pools, err := s.quizPools(uid, scope, seed)
		if err != nil {
			internalError(w, r, "daily quiz pools", err)
			return
		}
		// The two buckets are fetched SEPARATELY, each with its own limit. One
		// query ordered seen-before-unseen let the due backlog fill the whole
		// fetch, so a never-answered card could not reach the deck at all until
		// the backlog cleared.
		fetch := slots * reviewFetchHeadroom
		// reviewTheme{} BY NAME, not by omission. Daily is not themeable — the
		// daily deck IS the schedule, and filtering it would leave the cards that
		// are actually due unasked while the streak still counted the day as
		// cleared. Passing the empty theme explicitly makes that a line somebody
		// can read and argue with.
		due, err := s.deckCandidates(uid, bucketDue, scope, reviewTheme{}, mod, day, seed, fetch)
		if err != nil {
			internalError(w, r, "daily quiz due", err)
			return
		}
		unseen, err := s.deckCandidates(uid, bucketUnseen, scope, reviewTheme{}, mod, day, seed, fetch)
		if err != nil {
			internalError(w, r, "daily quiz unseen", err)
			return
		}
		for _, c := range mergeDeck(due, unseen, slots, reviewUnseenShare) {
			if len(items) >= slots {
				break
			}
			// A card with too little material to be asked a GRADED question is
			// left out rather than downgraded to a self-marked one.
			if card, ok := buildQuestion(c, dailyDirection(c.card.Kind, c.card.ID, seed, onDaily), pools, seed, true, onDaily, tuning.ClozeWords); ok {
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
	onPractice := parseReviewQuestions(pf.SRQuestions).forDeck(reviewDeckPractice)
	tuning := parseReviewTuning(pf.SRTuning)
	// "Quiz me on this book / tag / colour / person." Absent parameters mean the
	// whole pool, which is what Practice has always served.
	theme := parseReviewTheme(r.URL.Query())
	// An anthology theme names a ROW, unlike the other five, which name a value —
	// so it is the one theme that can be asked about something that is not the
	// caller's. Refused with a 404 rather than served as an empty round: the clause
	// itself already matches nothing (see review_theme.go), but "no cards" and
	// "not yours" look identical on screen, and the first is a thing a reader can
	// fix by adding a quote.
	if theme.anthology != 0 && !anthologyOwned(s.Store.DB, uid, theme.anthology) {
		writeErr(w, http.StatusNotFound, "anthology not found")
		return
	}
	// 0: Practice varies its distractors between rounds on purpose.
	pools, err := s.quizPools(uid, scope, 0)
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
	cands, err := s.deckCandidates(uid, bucketAll, scope, theme, "", "", rand.Int64N(reviewSeedRange), 0)
	if err != nil {
		internalError(w, r, "practice pool", err)
		return
	}
	// WHETHER PRACTICE IS SCORED DECIDES WHETHER IT MAY SELF-MARK. With
	// srPracticeCounts off — the default — Practice moves no schedule and keeps no
	// grade worth defending, so the flip card belongs here and leads. Turn scoring
	// on and it drops out, for the same reason the Daily Quiz never offers it.
	scored := pf.SRPracticeCounts
	items := make([]reviewCard, 0, len(cands))
	for _, c := range cands {
		// Practice picks from the same table the daily deck does, at random
		// rather than by hash — varying between rounds is the point here.
		dirs := directionsForMode(c.card.Kind, scored, onPractice)
		preferred := dirs[rand.IntN(len(dirs))]
		// `onPractice[dirFlip]` is the reader's say, and it has to be checked HERE
		// as well as in the table above. This branch does not pick from `dirs` —
		// it overrides the pick — so a reader who turned the flip card off would
		// otherwise get it half the time regardless, which is the loudest possible
		// way for a setting to be ignored.
		if !scored && onPractice[dirFlip] {
			// THE DEFAULT, weighted rather than merely available: unscored
			// Practice leads with the flip card and the graded kinds are the
			// variety around it. A flat pick would make it one direction in five.
			if rand.IntN(2) == 0 {
				preferred = dirFlip
			}
		}
		if card, ok := buildQuestion(c, preferred, pools, 0, scored, onPractice, tuning.ClozeWords); ok {
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
		// A cloze attempt, graded HERE rather than in the browser.
		//
		// Every other card type is graded client-side and that is fine: an MCQ's
		// `answer` is an index, which means nothing without the options beside
		// it, and a flip card is the reader's own verdict by definition. A cloze
		// answer is different in kind — it IS the words being recalled — so
		// sending it to the client to compare against would be sending the answer
		// to a question that has not been answered yet.
		//
		// When this is present the server recomputes the same mask the card was
		// built with (clozeSpan is derived from kind and id alone, never from the
		// day) and decides got/forgot itself, ignoring whatever `result` said.
		Attempt *string `json:"attempt"`
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
	clozeAnswer := "" // filled once a cloze attempt has been graded, never before
	// A cloze attempt decides its own grade. Done before ownership so that a
	// borrowed id still 404s on the same line every other write does.
	pf, err := s.loadPrefs(uid)
	if err != nil {
		internalError(w, r, "review answer prefs", err)
		return
	}
	tuning := parseReviewTuning(pf.SRTuning)
	owned, err := s.ownsItem(uid, req.Kind, req.ID)
	if err != nil {
		internalError(w, r, "review answer ownership", err)
		return
	}
	if !owned { // someone else's item is indistinguishable from a missing one
		writeErr(w, http.StatusNotFound, "item not found")
		return
	}

	if req.Attempt != nil {
		text, err := s.itemText(req.Kind, req.ID)
		if err != nil {
			internalError(w, r, "review answer item text", err)
			return
		}
		// THE SAME WIDTH THE CARD WAS BUILT WITH, which means the half-life as it
		// was BEFORE this answer moves it. Read here rather than reused from the
		// scheduling block below, because that block runs after this one — and
		// grading a one-word blank against a three-word answer would mark a
		// correct reader wrong, silently, only on cards at the 30-day rung.
		var stabilityNow float64 = reviewMinStability
		if err := s.Store.DB.QueryRow(
			`SELECT stability FROM item_reviews WHERE kind = ? AND item_id = ?`,
			req.Kind, req.ID).Scan(&stabilityNow); err != nil && !errors.Is(err, sql.ErrNoRows) {
			internalError(w, r, "review answer cloze stability", err)
			return
		}
		_, answerText, ok := clozeSpan(text, req.Kind, req.ID, clozeMaxWordsFor(stabilityNow, tuning.ClozeWords))
		if !ok {
			// The card could not have been a cloze card, so the attempt is about
			// a question that was never asked. Refused rather than graded: a
			// silent "forgot" here would move somebody's schedule on the strength
			// of a request nothing generated.
			writeErr(w, http.StatusBadRequest, "this card is not a fill-in-the-blank")
			return
		}
		if clozeCorrect(answerText, *req.Attempt) {
			req.Result = "got"
		} else {
			req.Result = "forgot"
		}
		// Safe to send back ONLY because the attempt is in: the card is graded,
		// so the words are no longer the answer to an open question. Carried on
		// the reply rather than fetched by a second request, which would be a
		// route that hands out cloze answers on demand.
		clozeAnswer = answerText
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
		s.answerResponse(w, r, uid, req.Mode, offset, req.Kind, req.ID, req.Result, "", stability, age, lapseCount, lastReviewed, lastResult, pf, found)
		return
	}

	if moveSchedule {
		// A card has "succeeded" before when it has more answers than lapses
		// (review_count == lapse_count ⇔ zero "got"s so far); a card with no row
		// at all trivially has not. nextStability turns that, the grade and the
		// gap since the last review into the new half-life under whichever of the
		// two rules the reviewer is on.
		prev := stability
		stability = nextStability(pf.SRAdaptive, req.Result, stability,
			elapsedDays(lastReviewed), found && reviewCount > lapseCount, tuning)
		// THE DIFFICULTY IS DERIVED, NOT DECLARED. A client-sent "direction" would
		// be the client telling the server what its own answer was worth, and the
		// obvious abuse - claim every answer was the hardest kind - would inflate a
		// schedule invisibly. The one direction that pays differently is the cloze,
		// and the server knows a cloze when it sees one: it graded the attempt
		// itself, a few lines above, against an answer that never left the machine.
		dir := ""
		if req.Attempt != nil {
			dir = dirCloze
		}
		stability = weighByDifficulty(dir, req.Result, prev, stability, tuning)
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

	// The lapse count as it stands AFTER this answer, because the offer it drives
	// is earned by the answer just given rather than by the state before it.
	// Derived from the write rather than re-read: the transaction already knows
	// the number, and a second SELECT is a second chance to disagree with it.
	//
	// GATED ON moveSchedule, not on the grade. Practice with srPracticeCounts off
	// never touches lapse_count, so counting one here would offer to set a card
	// aside on the strength of answers that never reached the schedule.
	lapses := lapseCount
	if moveSchedule && req.Result == "forgot" {
		lapses++
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
	s.answerResponse(w, r, uid, req.Mode, offset, req.Kind, req.ID, req.Result, clozeAnswer, stability, age, lapses, respLastReviewed, respLastResult, pf, found || moveSchedule)
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

// itemText is the words on the card behind an id — the quote, or the note when a
// quote is note-only, which is the same fallback attachCloze uses when it builds
// the mask. The grading path has to reconstruct exactly what the card was built
// from, so the two fallbacks must not drift.
//
// Switched exhaustively rather than defaulted, for the reason itemAgeDays gives:
// an unrecognised kind reading annotations would grade an attempt against
// somebody's highlight that happened to share an id.
func (s *Server) itemText(kind string, id int64) (string, error) {
	var table string
	switch kind {
	case kindBook:
		table = "annotations"
	case kindScreen:
		table = "dialogues"
	case kindUtterance:
		table = "utterances"
	default:
		return "", fmt.Errorf("unknown review kind %q", kind)
	}
	var quote, note string
	err := s.Store.DB.QueryRow(
		`SELECT COALESCE(quote,''), COALESCE(note,'') FROM `+table+` WHERE id = ?`, id).Scan(&quote, &note)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(quote) == "" {
		return note, nil
	}
	return quote, nil
}

// answerResponse assembles the reply shared by the normal path and the daily
// no-op echo: the card's new status + half-life, the mode's day tally, the
// library-wide status counts (so the "Where you stand" row updates live on
// every answer, quiz or practice), and (for daily) how much of today's deck is
// left so the pending dot stays honest.
// answerResponse also carries whether the card has just BECOME a leech, and that
// is load-bearing rather than a convenience.
//
// A lapse sets last_reviewed_at to now and stability to the first rung, and a
// card is due when elapsed >= MAX(stability, 7). So the very answer that makes a
// card a leech also guarantees it will not appear in a deck for at least a week.
// A flag that travelled only on the deck would surface the offer seven days
// after the frustration that earned it, which is the wrong week to be asked.
func (s *Server) answerResponse(w http.ResponseWriter, r *http.Request, uid int64, mode string, offset int,
	kind string, id int64, result, clozeAnswer string, stability, ageDays float64, lapses int, lastReviewed sql.NullString, lastResult string, pf prefs, seen bool) {
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
		"ok":   true,
		"kind": kind,
		"id":   id,
		// The grade that was actually recorded. Usually the one the client sent —
		// but a cloze attempt is graded HERE, so this is the only way the card
		// learns whether it was right.
		"result":      result,
		"stability":   stability,
		"lapse_count": lapses,
		"leech":       lapses >= reviewLeechLapses,
		"status":      recallStatus(seen, stability, elapsedDays(lastReviewed), ageDays, lastResult),
		"mode":        mode,
		"answered":    answered,
		"got":         got,
		"forgot":      forgot,
		"states":      states,
	}
	// Only present on a graded cloze card, which is the only time the words are
	// not the answer to an open question.
	if clozeAnswer != "" {
		out["answer"] = clozeAnswer
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
