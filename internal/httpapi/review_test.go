package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// Tests for the spaced-repetition Daily Quiz & Practice (v0.6.1 MCQ rework):
// deck construction (multiple-choice options + similar distractors, due-ness,
// quota, per-day exclusion, timezone), the half-life update rules (a correct
// pick = got, a wrong pick = forgot), Practice (unlimited, skippable,
// schedule-neutral by default), scores + streaks, the status-dot fields on the
// list endpoints, books+screen coverage, ownership, and lifecycle.
//
// Multiple choice needs at least two distinct titles for a wrong answer, so the
// deck tests seed a "distractor" title (parked out of the deck) alongside the
// book under test.
//
// Freshly created items sit inside the new-item grace week (reviewNewItemDays):
// remembered, not yet due. Deck/status tests therefore backdate their seeds
// past the buffer (ageSeededItems); the buffer itself is covered by
// TestReviewNewItemBuffer.

type reviewDeckResp struct {
	Items         []reviewCard `json:"items"`
	AnsweredToday int          `json:"answered_today"`
	GotToday      int          `json:"got_today"`
	ForgotToday   int          `json:"forgot_today"`
	Quota         int          `json:"quota"`
	Streak        int          `json:"streak"`
	States        statusCounts `json:"states"`
}

type practiceDeckResp struct {
	Items []reviewCard `json:"items"`
	Pool  int          `json:"pool"`
}

type answerResp struct {
	OK         bool         `json:"ok"`
	Kind       string       `json:"kind"`
	ID         int64        `json:"id"`
	Result     string       `json:"result"`
	Answer     string       `json:"answer"`
	Stability  float64      `json:"stability"`
	LapseCount int          `json:"lapse_count"`
	Leech      bool         `json:"leech"`
	Status     string       `json:"status"`
	Mode       string       `json:"mode"`
	Answered   int          `json:"answered"`
	Got        int          `json:"got"`
	Forgot     int          `json:"forgot"`
	Remaining  int          `json:"remaining"`
	States     statusCounts `json:"states"`
}

type scoresResp struct {
	Daily struct {
		Answered  int     `json:"answered"`
		Got       int     `json:"got"`
		Forgot    int     `json:"forgot"`
		Accuracy  float64 `json:"accuracy"`
		Streak    int     `json:"streak"`
		Days      int     `json:"days"`
		Remaining int     `json:"remaining"`
		Quota     int     `json:"quota"`
	} `json:"daily"`
	Practice struct {
		Answered int     `json:"answered"`
		Got      int     `json:"got"`
		Forgot   int     `json:"forgot"`
		Accuracy float64 `json:"accuracy"`
		Sessions int     `json:"sessions"`
	} `json:"practice"`
	States statusCounts `json:"states"`
}

// seedReviewBook creates a book with n annotations and returns the annotation ids.
func seedReviewBook(t *testing.T, c *testClient, title string, n int) (int64, []int64) {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": title}, http.StatusCreated))
	ids := make([]int64, 0, n)
	for i := 0; i < n; i++ {
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
			// A REAL SENTENCE, not "Dune passage 2". These fixtures were three
			// words long, which is too short for clozeSpan to mask a phrase out
			// of — so every cloze card silently failed to build and the deck fell
			// through to whatever could not fail. That made the fixtures, not the
			// code, decide which directions the tests ever exercised, and it hid
			// the fact that a cloze needs no distractors: one quote from one book
			// is a complete question. Long enough to have content words in it, so
			// the direction the deck actually reaches is the one a reader gets.
			"book_id": book.ID, "quote": fmt.Sprintf(
				"%s passage %d: the sleeper must awaken and the spice must flow across the desert", title, i),
		}, http.StatusCreated))
		ids = append(ids, a.ID)
	}
	return book.ID, ids
}

// seedDistractorBook adds a second titled book so multiple-choice questions can
// form, without adding any card to the deck: its one quote is parked with a long
// half-life and touched "today", so it's neither due nor eligible.
func seedDistractorBook(t *testing.T, srv *Server, c *testClient, title string) {
	t.Helper()
	_, ids := seedReviewBook(t, c, title, 1)
	if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
		(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
		VALUES ('book', ?, 100, 1, 'got', datetime('now'), datetime('now'))`, ids[0]); err != nil {
		t.Fatal(err)
	}
}

// ageSeededItems backdates every annotation and dialogue past the new-item
// grace week so deck/due tests exercise the forgetting curve, not the buffer.
func ageSeededItems(t *testing.T, srv *Server) {
	t.Helper()
	for _, q := range []string{
		`UPDATE annotations SET created_at = datetime('now', '-10 days')`,
		`UPDATE dialogues SET created_at = datetime('now', '-10 days')`,
		`UPDATE utterances SET created_at = datetime('now', '-10 days')`,
	} {
		if _, err := srv.Store.DB.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
}

// askable — the card is a question somebody can actually answer.
//
// It used to be `len(Options) >= 2`, which was the same thing while every card
// was multiple choice. It is not any more: a flip card is the quote on one side
// and its source on the other, self-graded, and having no options is what it IS
// rather than a card that failed to build. Asserting the count alone would now
// pass a malformed MCQ (one option) and fail a perfectly good flip card.
func askable(card reviewCard) bool {
	switch card.Direction {
	case dirFlip:
		return len(card.Options) == 0
	case dirCloze:
		// The question IS the hole in the text; the answer is on the server.
		return len(card.Options) == 0 && strings.Contains(card.Quote+card.Note, clozeBlank)
	case dirSpeaker:
		// Fewer than three faces is a coin toss rather than a question.
		return len(card.Options) >= speakerMinOptions && card.Answer < len(card.Options)
	}
	return len(card.Options) >= 2 && card.Answer >= 0 && card.Answer < len(card.Options)
}

func answer(t *testing.T, c *testClient, kind string, id int64, result, mode string) answerResp {
	t.Helper()
	return decode[answerResp](t, c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kind, "id": id, "result": result, "mode": mode}, 200))
}

func TestDailyQuizMCQ(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Empty pool: an empty deck, not an error.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 || deck.Quota != reviewQuota {
		t.Fatalf("empty pool deck: %+v", deck)
	}

	// A single-title library cannot form a multiple-choice question — there is no
	// second work to offer as a wrong answer — and it USED TO GET AN EMPTY DECK
	// for that reason, while dailyRemaining went on counting the same cards in
	// SQL. The badge said three were due and the deck served none, with nothing
	// anywhere reporting a problem.
	//
	// Every one of them is a flip card now: the quote on one side, its source on
	// the other, graded by the reader. That needs no distractor, so there is
	// always a question to ask.
	_, ids := seedReviewBook(t, c, "Dune", 3)
	ageSeededItems(t, srv)
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 3 {
		t.Fatalf("single-title deck should serve flip cards, not nothing: %+v", deck)
	}
	// It was a FLIP card until 1.16.0 and is a CLOZE now. The Daily Quiz stopped
	// offering self-marked cards — a grade the reader awards themselves moves the
	// same schedule as a graded one, which makes the daily number unreadable — and
	// the card that fills the no-distractor hole is the cloze, which needs none
	// either: it masks a word out of the quote's own text, so one quote from one
	// book is a complete graded question.
	for _, it := range deck.Items {
		if it.Direction == dirFlip {
			t.Fatalf("the Daily Quiz must never self-mark: %+v", it)
		}
		if it.Direction != dirCloze || len(it.Options) != 0 {
			t.Fatalf("single-title card should be a cloze with no options: %+v", it)
		}
	}

	// A second title unlocks the questions.
	seedDistractorBook(t, srv, c, "Emma")
	ageSeededItems(t, srv)
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 3 {
		t.Fatalf("deck size: %d (%+v)", len(deck.Items), deck)
	}
	for _, it := range deck.Items {
		if it.Kind != kindBook || it.Title != "Dune" || it.Status != "unseen" || it.ReviewCount != 0 {
			t.Fatalf("unseen item: %+v", it)
		}
		// A second title makes the two multiple-choice directions POSSIBLE; it
		// does not make them compulsory. The direction is drawn from the table
		// for this kind, so a flip card here is a correct outcome rather than a
		// card that failed to build — which is why the shape is asserted per
		// direction instead of assuming one.
		if !slices.Contains(directionsFor(it.Kind), it.Direction) {
			t.Fatalf("direction not in the table for this kind: %+v", it)
		}
		if !askable(it) {
			t.Fatalf("card is not answerable: %+v", it)
		}
		// Only the MULTIPLE-CHOICE directions have an option to check. A cloze
		// carries no options at all — the answer never leaves the server — so
		// indexing Options here crashed rather than failed once the daily deck
		// started reaching cloze cards on a small library.
		if it.Direction == dirSource || it.Direction == dirQuote {
			// The correct option is the card's title (source) or its quote (quote).
			want := it.Title
			if it.Direction == dirQuote {
				want = it.Quote
			}
			if it.Options[it.Answer] != want {
				t.Fatalf("answer option mismatch: %+v", it)
			}
		}
	}

	// A correct pick counts as "got": a first-ever success starts the ladder at
	// its 7-day rung, the card leaves the deck, and freshly reviewed reads as
	// remembered. Every answer also carries the fresh library-wide status counts
	// (Dune 3 + the remembered Emma distractor = 4) so "Where you stand" updates
	// live.
	res := answer(t, c, kindBook, ids[0], "got", "daily")
	if !res.OK || res.Stability != 7 || res.Status != "remembered" || res.Answered != 1 || res.Got != 1 {
		t.Fatalf("got: %+v", res)
	}
	if res.States.Total != 4 || res.States.Remembered != 2 || res.States.Unseen != 2 {
		t.Fatalf("states after got: %+v", res.States)
	}
	// A wrong pick counts as "forgot": back to the 7-day rung, lapse recorded,
	// and — however freshly reviewed — it reads as probably-forgotten, not
	// remembered (a lapse is the honest signal about current recall).
	res = answer(t, c, kindBook, ids[1], "forgot", "daily")
	if res.Stability != 7 || res.Answered != 2 || res.Forgot != 1 || res.Status != "probably-forgotten" {
		t.Fatalf("forgot: %+v", res)
	}
	if res.States.ProbablyForgotten != 1 || res.States.Unseen != 1 {
		t.Fatalf("states after forgot: %+v", res.States)
	}
	var lapses int
	if err := srv.Store.DB.QueryRow(`SELECT lapse_count FROM item_reviews WHERE kind='book' AND item_id=?`, ids[1]).Scan(&lapses); err != nil || lapses != 1 {
		t.Fatalf("lapse_count %d, %v", lapses, err)
	}

	// Daily forbids skip; other bad inputs 400.
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[2], "result": "skip", "mode": "daily"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[2], "result": "aced", "mode": "daily"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": "bogus", "id": ids[2], "result": "got", "mode": "daily"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[2], "result": "got", "mode": "weekly"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[2], "result": "got", "mode": "daily", "offset": 9999}, http.StatusBadRequest)
	c.mustDo("GET", "/review/daily?offset=abc", nil, http.StatusBadRequest)

	// Finish the deck; the day is done with a 1-day streak.
	answer(t, c, kindBook, ids[2], "got", "daily")
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 || deck.AnsweredToday != 3 || deck.Streak != 1 {
		t.Fatalf("deck after answers: %+v", deck)
	}
}

func TestDailyQuizScheduling(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// THIS TEST IS ABOUT THE LADDER, so it says so. Adaptive is the default rule
	// as of 3.1.0 and multiplies where the ladder steps, so every rung expectation
	// below would otherwise be measuring the wrong scheduler.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srLadder": true}, http.StatusOK)
	_, ids := seedReviewBook(t, c, "Emma", 3)
	seedDistractorBook(t, srv, c, "Dune") // a 2nd title so MCQ can form
	ageSeededItems(t, srv)

	seed := func(id int64, stability float64, daysAgo int) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`
			INSERT INTO item_reviews (kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, ?, 1, 'got', datetime('now', ?), datetime('now', ?))`,
			id, stability, fmt.Sprintf("-%d days", daysAgo), fmt.Sprintf("-%d days", daysAgo)); err != nil {
			t.Fatal(err)
		}
	}
	seed(ids[0], 30, 9)  // p ≈ .81 — not due
	seed(ids[1], 10, 12) // p ≈ .44 — due
	seed(ids[2], 7, 21)  // p = .125 — most forgotten

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 2 {
		t.Fatalf("due filter: %+v", deck)
	}
	if deck.Items[0].ID != ids[2] || deck.Items[1].ID != ids[1] {
		t.Fatalf("due order: %d, %d (want %d, %d)", deck.Items[0].ID, deck.Items[1].ID, ids[2], ids[1])
	}
	if deck.Items[0].Status != "probably-forgotten" || !askable(deck.Items[0]) {
		t.Fatalf("due item: %+v", deck.Items[0])
	}

	// A correct recall climbs to the next rung above the current half-life:
	// an off-ladder 10 lands on 30.
	res := answer(t, c, kindBook, ids[1], "got", "daily")
	if res.Stability != 30 {
		t.Fatalf("climbed stability: %+v", res)
	}
	// From the first rung a success climbs to the second — lateness earns no
	// extra credit (this card sat 21 days at stability 7; still just 30).
	res = answer(t, c, kindBook, ids[2], "got", "daily")
	if res.Stability != 30 {
		t.Fatalf("rung climb: %+v", res)
	}
	// From the 30-day rung a success climbs to the 100-day rung.
	res = answer(t, c, kindBook, ids[0], "got", "daily")
	if res.Stability != 100 {
		t.Fatalf("30 → 100 climb: %+v", res)
	}
	// A lapse falls straight back to the first rung from any height — even an
	// off-rung legacy 60.
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
		SET stability = 60, last_reviewed_at = datetime('now', '-70 days'),
		    last_touched_at = datetime('now', '-70 days') WHERE kind='book' AND item_id=?`, ids[2]); err != nil {
		t.Fatal(err)
	}
	res = answer(t, c, kindBook, ids[2], "forgot", "daily")
	if res.Stability != 7 {
		t.Fatalf("lapse: %+v", res)
	}
	// The 100-day rung is no longer the top one: since the ceiling became a year
	// a correct recall there climbs again, to 365. (The direct UPDATE leaves this
	// row's review_count at 2 gots vs 0 lapses, so the climb gate lets it
	// through.)
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
		SET stability = 100, last_reviewed_at = datetime('now', '-120 days'),
		    last_touched_at = datetime('now', '-120 days') WHERE kind='book' AND item_id=?`, ids[1]); err != nil {
		t.Fatal(err)
	}
	res = answer(t, c, kindBook, ids[1], "got", "daily")
	if res.Stability != 365 {
		t.Fatalf("100 → 365 climb: %+v", res)
	}
	// And THAT rung holds: a correct recall at the ceiling stays at the ceiling.
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
		SET stability = 365, last_reviewed_at = datetime('now', '-400 days'),
		    last_touched_at = datetime('now', '-400 days') WHERE kind='book' AND item_id=?`, ids[1]); err != nil {
		t.Fatal(err)
	}
	res = answer(t, c, kindBook, ids[1], "got", "daily")
	if res.Stability != 365 {
		t.Fatalf("top rung: %+v", res)
	}
}

// THE LADDER'S SHAPE IS THE FEATURE, and it is asserted here rather than read
// off the literal: four rungs, strictly ascending, starting at the floor every
// due-ness query clamps to and ending exactly ON the ceiling. A ladder whose top
// rung sat below the ceiling would leave a band of half-lives the fixed rule can
// never reach, and one above it would promise a review the clamp then takes away.
func TestTheLadderReachesTheCeilingAndStopsThere(t *testing.T) {
	l := defaultReviewTuning().ladder()
	if len(l) != reviewRungs {
		t.Fatalf("ladder has %d rungs, want %d", len(l), reviewRungs)
	}
	if l[0] != reviewMinStability {
		t.Errorf("first rung %g, want the floor %g", l[0], reviewMinStability)
	}
	if l[len(l)-1] != reviewMaxStability {
		t.Errorf("top rung %g, want the ceiling %g", l[len(l)-1], reviewMaxStability)
	}
	for i := 1; i < len(l); i++ {
		if l[i] <= l[i-1] {
			t.Errorf("rung %d (%g) does not climb above rung %d (%g)", i, l[i], i-1, l[i-1])
		}
	}
	if reviewLadder != l {
		t.Errorf("reviewLadder %v and the default tuning's ladder %v disagree", reviewLadder, l)
	}
}

// AND THE CEILING IS THE READER'S OWN, not the package's.
//
// Under adaptive — the default — a half-life grows to reviewMaxStability and the
// two are the same. A reader on the fixed LADDER stops at their own top rung, and
// one who lowered it to 30 days has a twelfth of the capacity: the note on Home
// would have told them they had room for 2,920 quotes when the truth was 240.
func TestCapacityFollowsTheReadersOwnCeiling(t *testing.T) {
	adaptive := prefs{SRDaily: 8}
	if !adaptive.adaptive() {
		t.Fatal("the fixture is wrong: an unset srLadder is the adaptive default")
	}
	if got, want := reviewCeilingFor(adaptive), reviewMaxStability; got != want {
		t.Errorf("an adaptive reader's ceiling = %g, want the package ceiling %g", got, want)
	}

	short := prefs{SRDaily: 8, SRLadder: true, SRTuning: `{"ladder1":7,"ladder2":14,"ladder3":21,"ladder4":30}`}
	if got, want := reviewCeilingFor(short), 30.0; got != want {
		t.Errorf("a ladder reader's ceiling = %g, want their own top rung %g", got, want)
	}
	if got, want := reviewCapacity(short.SRDaily, reviewCeilingFor(short)), 240; got != want {
		t.Errorf("capacity on a 30-day ladder = %d, want %d — the note would overstate by 12x", got, want)
	}
	// A ladder reader who never touched the rungs is back at the package ceiling,
	// because that IS their top rung.
	def := prefs{SRDaily: 8, SRLadder: true}
	if got, want := reviewCeilingFor(def), reviewMaxStability; got != want {
		t.Errorf("an untouched ladder's ceiling = %g, want %g", got, want)
	}
}

// A card whose only history is lapses takes the 7-day starting rung on its
// first successful recall — exactly like a brand-new card — and only climbs
// from the second success on. Without the review_count > lapse_count gate a
// day-0 "forgot" would cost nothing versus a "got" (both would reach 30 with
// one success).
func TestFirstSuccessAfterLapseStartsAtSeven(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// THIS TEST IS ABOUT THE LADDER, so it says so. Adaptive is the default rule
	// as of 3.1.0 and multiplies where the ladder steps, so every rung expectation
	// below would otherwise be measuring the wrong scheduler.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srLadder": true}, http.StatusOK)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma")
	ageSeededItems(t, srv)

	rewind := func() {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
			SET last_reviewed_at = datetime('now', '-8 days'),
			    last_touched_at = datetime('now', '-8 days') WHERE kind='book' AND item_id=?`, ids[0]); err != nil {
			t.Fatal(err)
		}
	}

	// Day 0: the first-ever answer is a lapse — row created at the 7-day rung.
	res := answer(t, c, kindBook, ids[0], "forgot", "daily")
	if res.Stability != 7 {
		t.Fatalf("first-ever forgot: %+v", res)
	}
	// A week on, its first-ever CORRECT answer starts the ladder at 7 — it must
	// NOT climb to 30 off the lapse-created rung.
	rewind()
	res = answer(t, c, kindBook, ids[0], "got", "daily")
	if res.Stability != 7 {
		t.Fatalf("first success after lapse-only history: %+v (want 7)", res)
	}
	// The second success climbs normally: 7 → 30.
	rewind()
	res = answer(t, c, kindBook, ids[0], "got", "daily")
	if res.Stability != 30 {
		t.Fatalf("second success climbs: %+v (want 30)", res)
	}
}

func TestDailyQuizQuota(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedReviewBook(t, c, "Middlemarch", reviewQuota+2)
	seedDistractorBook(t, srv, c, "Dune")
	ageSeededItems(t, srv)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("deck capped at quota: got %d", len(deck.Items))
	}
	// Card order is stable within a day (option order may reshuffle; ids don't).
	again := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	for i := range deck.Items {
		if again.Items[i].ID != deck.Items[i].ID {
			t.Fatalf("deck order changed between fetches")
		}
	}
	for i, it := range deck.Items {
		res := answer(t, c, it.Kind, it.ID, "got", "daily")
		if res.Remaining != reviewQuota-i-1 {
			t.Fatalf("remaining after %d answers: %+v", i+1, res)
		}
	}
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 || deck.AnsweredToday != reviewQuota {
		t.Fatalf("quota spent: %+v", deck)
	}
}

// A stale second device answering the same daily card the same local day is an
// idempotent no-op — no compounding, no double-count.
func TestDailyQuizIdempotentSameDay(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma")

	first := answer(t, c, kindBook, ids[0], "got", "daily")
	again := answer(t, c, kindBook, ids[0], "got", "daily")
	if first.Stability != 7 || again.Stability != 7 || again.Answered != 1 {
		t.Fatalf("same-day repeat recompounded: %+v / %+v", first, again)
	}
	var reviews int
	if err := srv.Store.DB.QueryRow(`SELECT review_count FROM item_reviews WHERE kind='book' AND item_id=?`, ids[0]).Scan(&reviews); err != nil || reviews != 1 {
		t.Fatalf("review_count double-counted: %d, %v", reviews, err)
	}
}

// reviewDay shifts UTC "now" into the reviewer's local day. This asserts the
// shift deterministically (offsets 24h apart are always on different dates) and
// that a daily answer tallies + drops the card for that local day — no
// wall-clock-dependent cross-midnight arithmetic.
func TestDailyQuizTimezone(t *testing.T) {
	east, _, _ := reviewDay(720)  // UTC+12
	west, _, _ := reviewDay(-720) // UTC-12
	if east == west {
		t.Fatalf("offsets 24h apart share a local day: %s", east)
	}
	if _, err := time.Parse("2006-01-02", east); err != nil {
		t.Fatalf("local day not a date: %q", east)
	}

	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Kim", 1)
	seedDistractorBook(t, srv, c, "Emma")
	ageSeededItems(t, srv)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily?offset=0", nil, 200))
	if len(deck.Items) != 1 {
		t.Fatalf("deck before answer: %+v", deck)
	}
	answer(t, c, kindBook, ids[0], "got", "daily")
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily?offset=0", nil, 200))
	if deck.AnsweredToday != 1 || len(deck.Items) != 0 {
		t.Fatalf("card should be answered + gone for the local day: %+v", deck)
	}
}

// Practice is unlimited, skippable, schedule-neutral by default; the schedule
// setting opts it in. Its score is separate and resettable.
func TestPracticeMode(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 3)
	seedReviewBook(t, c, "Emma", 2) // a real 2nd title (practice draws all in scope)
	ageSeededItems(t, srv)

	pd := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if pd.Pool < 3 || len(pd.Items) < 3 {
		t.Fatalf("practice pool: %+v", pd)
	}
	for _, it := range pd.Items {
		if !askable(it) {
			t.Fatalf("practice card is not a question: %+v", it)
		}
	}

	// A default practice "got" logs the score but doesn't touch the schedule.
	res := answer(t, c, kindBook, ids[0], "got", "practice")
	if res.Status != "unseen" || res.Answered != 1 || res.Got != 1 {
		t.Fatalf("practice got (default): %+v", res)
	}
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("practice must not touch the schedule by default: %d, %v", n, err)
	}
	// Skip is allowed and not counted.
	res = answer(t, c, kindBook, ids[1], "skip", "practice")
	if res.Answered != 1 {
		t.Fatalf("skip counted: %+v", res)
	}

	// Opt in: a correct practice recall now moves the half-life.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, 200)
	res = answer(t, c, kindBook, ids[2], "got", "practice")
	if res.Status != "remembered" || res.Stability != 7 {
		t.Fatalf("practice got (counting): %+v", res)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE item_id=?`, ids[2]).Scan(&n); err != nil || n != 1 {
		t.Fatalf("counting practice must move the schedule: %d, %v", n, err)
	}

	// Reset clears the practice score but leaves the schedule.
	c.mustDo("DELETE", "/review/practice", nil, 200)
	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.Practice.Answered != 0 || scores.Practice.Sessions != 0 {
		t.Fatalf("practice score not reset: %+v", scores.Practice)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE item_id=?`, ids[2]).Scan(&n); err != nil || n != 1 {
		t.Fatalf("reset wrongly cleared the schedule: %d, %v", n, err)
	}
}

func TestReviewScores(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 4)
	seedReviewBook(t, c, "Emma", 2) // 2 more unseen; also a 2nd title
	ageSeededItems(t, srv)

	answer(t, c, kindBook, ids[0], "got", "daily")
	answer(t, c, kindBook, ids[1], "got", "daily")
	answer(t, c, kindBook, ids[2], "forgot", "daily")
	answer(t, c, kindBook, ids[3], "got", "practice") // default: no schedule

	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.Daily.Answered != 3 || scores.Daily.Got != 2 || scores.Daily.Forgot != 1 {
		t.Fatalf("daily score: %+v", scores.Daily)
	}
	if scores.Daily.Accuracy < 0.66 || scores.Daily.Accuracy > 0.67 || scores.Daily.Streak != 1 || scores.Daily.Days != 1 {
		t.Fatalf("daily accuracy/streak: %+v", scores.Daily)
	}
	if scores.Practice.Answered != 1 || scores.Practice.Got != 1 || scores.Practice.Sessions != 1 {
		t.Fatalf("practice score: %+v", scores.Practice)
	}
	// The 2 dailied "got" cards → remembered; the 1 dailied "forgot" → probably-
	// forgotten (a lapse is never "remembered", however freshly reviewed); the
	// practice + Emma cards never entered the schedule → unseen. Total = 6.
	if scores.States.Remembered != 2 || scores.States.ProbablyForgotten != 1 ||
		scores.States.Unseen != 3 || scores.States.Total != 6 {
		t.Fatalf("states: %+v", scores.States)
	}
}

// The "seeing" effect (srSeen): sharing or favouriting a card lengthens its
// half-life marginally — separate from Daily Quiz recall, off by default, and
// never touching an unseen card. PRACTICE IS NOT SEEING, and that leg of this
// test is the one that used to assert the opposite.
func TestReviewSeen(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma") // a 2nd title so MCQ can form

	stabilityOf := func(id int64) float64 {
		var s float64
		if err := srv.Store.DB.QueryRow(
			`SELECT stability FROM item_reviews WHERE kind='book' AND item_id=?`, id).Scan(&s); err != nil {
			return -1 // no review row yet
		}
		return s
	}
	near := func(got, want float64) bool { return got > want-0.01 && got < want+0.01 }

	// Turn "seeing" on (off by default: 1.0×).
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srSeen": 1.2}, 200)

	// Seeing an unseen card must NOT create a schedule row (nothing to lengthen).
	c.mustDo("POST", "/review/seen", map[string]any{"kind": kindBook, "id": ids[0]}, 200)
	if stabilityOf(ids[0]) != -1 {
		t.Fatalf("seeing an unseen card created a review row")
	}

	// Quiz it right → row at the ladder's 7-day starting rung. The Daily Quiz is
	// NOT "seeing" (its grade drives the schedule in full), so no extra bump here.
	answer(t, c, kindBook, ids[0], "got", "daily")
	if s := stabilityOf(ids[0]); !near(s, 7) {
		t.Fatalf("after daily got: %v (want 7)", s)
	}
	// Sharing (POST /review/seen): 7 × 1.2 = 8.4
	c.mustDo("POST", "/review/seen", map[string]any{"kind": kindBook, "id": ids[0]}, 200)
	if s := stabilityOf(ids[0]); !near(s, 8.4) {
		t.Fatalf("after share-seen: %v (want 8.4)", s)
	}
	// PRACTICE IS NOT SEEING. With srPracticeCounts off — the default — a Practice
	// answer moves nothing at all, so 8.4 stands. It used to read 8.4 × 1.2, which
	// is a reader who said "Practice moves the schedule: No" watching it move.
	answer(t, c, kindBook, ids[0], "got", "practice")
	if s := stabilityOf(ids[0]); !near(s, 8.4) {
		t.Fatalf("a practice answer counted as seeing: %v (want 8.4, unchanged)", s)
	}
	// And a FORGOTTEN practice card is not lengthened either — the shape that made
	// the old rule indefensible rather than merely surprising.
	answer(t, c, kindBook, ids[0], "forgot", "practice")
	if s := stabilityOf(ids[0]); !near(s, 8.4) {
		t.Fatalf("a forgotten practice card was lengthened: %v (want 8.4, unchanged)", s)
	}
	// Favouriting (false→true) counts as seeing: 8.4 × 1.2 = 10.08
	favBody := map[string]any{"quote": "Dune passage 0", "color": "yellow", "favorite": true}
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), favBody, 200)
	if s := stabilityOf(ids[0]); !near(s, 10.08) {
		t.Fatalf("after favourite-seen: %v (want 10.08)", s)
	}
	// Re-saving an already-favourite card is not a fresh "seeing".
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), favBody, 200)
	if s := stabilityOf(ids[0]); !near(s, 10.08) {
		t.Fatalf("re-saving a favourite re-credited seeing: %v (want 10.08)", s)
	}

	// A skipped practice card moves nothing either (it never did).
	before := stabilityOf(ids[0])
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "skip", "mode": "practice"}, 200)
	if s := stabilityOf(ids[0]); !near(s, before) {
		t.Fatalf("a skip counted as seeing: %v -> %v", before, s)
	}

	// AND PRACTICE-THAT-COUNTS MOVES THE SCHEDULE EXACTLY ONCE. With
	// srPracticeCounts on, the grade drives the half-life the way the Daily Quiz
	// does — and srSeen adds nothing on top, so the two settings never compound.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, 200)
	before = stabilityOf(ids[0])
	answer(t, c, kindBook, ids[0], "got", "practice")
	// The recall multiplier and nothing else. The compounded value — which is what
	// this used to be — is `want * 1.2`, so the two are told apart by the number
	// rather than by which line of the handler ran.
	want := before * reviewGrow
	if s := stabilityOf(ids[0]); !near(s, want) {
		t.Fatalf("a counting practice answer: %v (want %v — the recall multiplier alone, "+
			"not %v with the seeing bump on top)", s, want, want*1.2)
	}

	// Ownership: another user can't "see" this card.
	bob := addUser(t, h, c, "bob")
	bob.mustDo("POST", "/review/seen", map[string]any{"kind": kindBook, "id": ids[0]}, http.StatusNotFound)
}

// Films/shows are first-class review items: they enter the deck with options,
// grade, expose status on the list, and their review row dies with the line.
func TestReviewScreenCards(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m1 := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Heat"}, http.StatusCreated))
	dlg := decode[dialogueRow](t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": m1.ID, "quote": "Don't let yourself get attached", "character": "Neil"}, http.StatusCreated))
	// A 2nd screen title so MCQ can form.
	m2 := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Collateral"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": m2.ID, "quote": "Yo Homeboy, that's my briefcase"}, http.StatusCreated)
	ageSeededItems(t, srv)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	var screen *reviewCard
	for i := range deck.Items {
		if deck.Items[i].Kind == kindScreen && deck.Items[i].ID == dlg.ID {
			screen = &deck.Items[i]
		}
	}
	// askable rather than a raw option count: a screen card can legitimately be
	// drawn as a flip card (no options) or as a cloze one, and the claim here is
	// that it reaches the deck as an answerable question about the right film.
	if screen == nil || !askable(*screen) || screen.Title != "Heat" {
		t.Fatalf("screen card not in deck as a question: %+v", deck.Items)
	}

	res := answer(t, c, kindScreen, dlg.ID, "got", "daily")
	if res.Stability != 7 || res.Status != "remembered" {
		t.Fatalf("screen answer: %+v", res)
	}
	list := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, 200))
	var found bool
	for _, d := range list.Dialogues {
		if d.ID == dlg.ID {
			found = d.Reviewed && d.Stability == 7
		}
	}
	if !found {
		t.Fatalf("dialogue list review state: %+v", list.Dialogues)
	}

	c.mustDo("DELETE", fmt.Sprintf("/dialogues/%d", dlg.ID), nil, 200)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind='screen' AND item_id=?`, dlg.ID).Scan(&n); err != nil || n != 0 {
		t.Fatalf("screen review row survived delete: %d, %v", n, err)
	}

	// Books-only scope hides screen lines from the deck.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "books"}, 200)
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	for _, it := range deck.Items {
		if it.Kind == kindScreen {
			t.Fatalf("books-only scope served a screen card: %+v", it)
		}
	}
}

// The new-item grace week (reviewNewItemDays): a quote saved this week is not
// yet in the Daily Quiz, and reads "unseen" (not yet asked) from the day it is
// saved; past the week it enters the Daily Quiz; a recorded lapse always beats
// the buffer.
func TestReviewNewItemBuffer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 2)
	seedDistractorBook(t, srv, c, "Emma")

	// Fresh items: nothing due. The two fresh Dune quotes read unseen, since
	// nobody has asked them yet, and the parked Emma quote reads remembered by
	// its half-life.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 {
		t.Fatalf("fresh items served in the daily deck: %+v", deck.Items)
	}
	if deck.States.Remembered != 1 || deck.States.Unseen != 2 || deck.States.Total != 3 {
		t.Fatalf("states inside the grace week: %+v", deck.States)
	}

	// Past the week the same items are unseen and due.
	ageSeededItems(t, srv)
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 2 || deck.Items[0].Status != "unseen" {
		t.Fatalf("aged items should be due as unseen: %+v", deck.Items)
	}
	if deck.States.Unseen != 2 || deck.States.Remembered != 1 {
		t.Fatalf("states past the grace week: %+v", deck.States)
	}

	// A lapse is decisive even inside the buffer: fail a card, pull its
	// created_at back to now — it must stay probably-forgotten, not flip to
	// remembered.
	answer(t, c, kindBook, ids[0], "forgot", "daily")
	if _, err := srv.Store.DB.Exec(`UPDATE annotations SET created_at = datetime('now') WHERE id = ?`, ids[0]); err != nil {
		t.Fatal(err)
	}
	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.States.ProbablyForgotten != 1 || scores.States.Remembered != 1 || scores.States.Unseen != 1 {
		t.Fatalf("a lapse must beat the grace week: %+v", scores.States)
	}
}

func TestReviewOwnership(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bob := addUser(t, h, c, "bob")
	_, ids := seedReviewBook(t, c, "Dune", 1)

	bob.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusNotFound)
	if deck := decode[reviewDeckResp](t, bob.mustDo("GET", "/review/daily", nil, 200)); len(deck.Items) != 0 {
		t.Fatalf("bob deck leaked: %+v", deck)
	}
}

func set(ss ...string) map[string]bool {
	m := map[string]bool{}
	for _, s := range ss {
		m[s] = true
	}
	return m
}

// A big import must not own the deck. Before the deck rework, both ORDER BY keys
// tied across the whole unseen pool and SQLite broke those ties in rowid order —
// and the importer writes book by book, so annotation ids are contiguous per
// book and `LIMIT slots*5` returned every row from the first book. The deck came
// back entirely from one work, every day, for months.
func TestDailyQuizSpreadsAcrossWorks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// Seeded in order, so ids are contiguous per book exactly as an import writes
	// them. Each book alone could fill the quota several times over.
	for _, title := range []string{"Middlemarch", "Dune", "Emma", "Ulysses"} {
		seedReviewBook(t, c, title, reviewQuota*3)
	}
	ageSeededItems(t, srv)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("deck should fill the quota: got %d", len(deck.Items))
	}
	byTitle := map[string]int{}
	for _, it := range deck.Items {
		byTitle[it.Title]++
	}
	if len(byTitle) < 4 {
		t.Fatalf("deck drawn from %d of 4 books (%v) — one work is monopolising it", len(byTitle), byTitle)
	}
	for title, n := range byTitle {
		if n > reviewQuota/2 {
			t.Fatalf("%q took %d of %d slots: %v", title, n, reviewQuota, byTitle)
		}
	}
}

// Unseen cards must reach the deck even with a due backlog several times the
// quota. They used to be ordered behind every due card and then truncated out of
// the fetch entirely, so a backlog meant no new material for weeks.
func TestDailyQuizAdmitsUnseenBesideBacklog(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, backlog := seedReviewBook(t, c, "Middlemarch", reviewQuota*6)
	_, fresh := seedReviewBook(t, c, "Dune", reviewQuota*2)
	ageSeededItems(t, srv)

	// Every Middlemarch card is answered and long overdue; the Dune cards have
	// never been answered.
	for _, id := range backlog {
		if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
			(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, 7, 1, 'got', datetime('now', '-90 days'), datetime('now', '-90 days'))`, id); err != nil {
			t.Fatal(err)
		}
	}
	unseen := map[int64]bool{}
	for _, id := range fresh {
		unseen[id] = true
	}

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("deck should fill the quota: got %d", len(deck.Items))
	}
	got := 0
	for _, it := range deck.Items {
		if it.Kind == kindBook && unseen[it.ID] {
			got++
		}
	}
	// Since 3.0.3 unseen cards take two slots in three, and every third slot is
	// the most overdue review, so the backlog still gets its share: of the eight,
	// slots three and six. Literal numbers, so a change to the ratio fails here
	// rather than moving the expectation with it.
	if reviewQuota != 8 {
		t.Fatalf("this test counts an eight-card deck; the default quota is %d", reviewQuota)
	}
	if got != 6 {
		t.Fatalf("unseen cards in deck: got %d, want 6 of 8 (two in every three slots)", got)
	}
	if backlogged := len(deck.Items) - got; backlogged != 2 {
		t.Fatalf("due cards in deck: got %d, want 2 of 8", backlogged)
	}
	// And the round leads with what the reader has not been asked yet.
	for i, it := range deck.Items[:2] {
		if !(it.Kind == kindBook && unseen[it.ID]) {
			t.Fatalf("card %d of the round is a review; the first two should be quotes not yet asked", i+1)
		}
	}
}

// A reader who answers one card and comes back later still meets a review every
// third card. The deck is rebuilt on each visit from the slots left, and while it
// counted those from zero every visit led with two unseen cards, so this reader
// was never asked a due review while any unseen card remained.
func TestDailyQuizKeepsItsPatternAcrossVisits(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, backlog := seedReviewBook(t, c, "Middlemarch", reviewQuota*3)
	_, fresh := seedReviewBook(t, c, "Dune", reviewQuota*3)
	ageSeededItems(t, srv)
	for _, id := range backlog {
		if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
			(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, 7, 1, 'got', datetime('now', '-90 days'), datetime('now', '-90 days'))`, id); err != nil {
			t.Fatal(err)
		}
	}
	unseen := map[int64]bool{}
	for _, id := range fresh {
		unseen[id] = true
	}

	var met strings.Builder
	for visit := 1; visit <= reviewQuota; visit++ {
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
		if len(deck.Items) == 0 {
			t.Fatalf("visit %d: the deck is empty with %d answered", visit, visit-1)
		}
		first := deck.Items[0]
		if unseen[first.ID] {
			met.WriteByte('U')
		} else {
			met.WriteByte('A')
		}
		answer(t, c, first.Kind, first.ID, "got", "daily")
	}
	if got := met.String(); got != "UUAUUAUU" {
		t.Fatalf("one card a visit met %s, want UUAUUAUU (a review every third card)", got)
	}
}

// Practice draws from the whole pool with no due filter, and since 3.0.3 it
// deals as the Daily Quiz does: two quotes never asked for every one already
// asked, so a round leads with what the reader has not been asked yet. It keeps
// the per-work rotation across that mix.
func TestPracticeLeadsWithQuotesNotYetAskedAndRotatesWorks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	for _, title := range []string{"Middlemarch", "Dune", "Emma"} {
		seedReviewBook(t, c, title, 12)
	}
	// Reviewing some cards must not change what Practice offers: no due filter.
	if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
		(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
		SELECT 'book', id, 100, 3, 'got', datetime('now'), datetime('now')
		FROM annotations WHERE id % 2 = 0`); err != nil {
		t.Fatal(err)
	}

	deck := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if len(deck.Items) != 36 {
		t.Fatalf("practice offers the whole pool: got %d, want 36", len(deck.Items))
	}
	// The rotation means the opening run touches every work rather than walking
	// one book end to end.
	seen := map[string]bool{}
	for _, it := range deck.Items[:3] {
		seen[it.Title] = true
	}
	if len(seen) != 3 {
		t.Fatalf("first three practice cards should span all three books, got %v", seen)
	}
	// Two in every three slots are quotes not yet asked: the even ids above were
	// answered, the odd ones never were.
	for i, it := range deck.Items[:12] {
		asked := it.ID%2 == 0
		if want := (i+1)%reviewDueEvery == 0; asked != want {
			t.Fatalf("practice card %d: asked=%v, want asked=%v (every third slot a quote already asked)", i+1, asked, want)
		}
	}
}

// THE CAPACITY TRAVELS WITH THE COUNTS IT IS COMPARED AGAINST.
//
// `states.total` is the library and `capacity` is what the schedule can hold, so
// a screen needs BOTH to decide whether to say the library has outgrown it. A
// response carrying one without the other leaves the note unable to render — and
// worse, makes it BLINK OUT partway through a session, because Home is fed by the
// daily deck first and by every answer after that. A note that vanishes on the
// first answer reads as a bug in the note.
//
// READ AS RAW JSON, not into the typed structs above, and that is the point: a
// typed decode would silently give 0 for a field nobody sent.
//
// TWO HALVES, AND THE FIRST ONE IS THE ONE THAT CATCHES A STRANGER.
//
// The first version of this hardcoded three probes and called itself a rule
// about the pair — while GET /stats, the fourth place `states` is sent, quietly
// had no capacity beside it. Naming the subjects is exactly what let that
// through, so the SOURCE is searched: every `"states"` key written into a
// response map anywhere in this package has to be one this test drives. A new
// endpoint that starts sending counts fails here for existing, before anyone has
// to remember it.
//
// The second half then drives those responses and reads the pair back, including
// through a nested object — /stats puts its counts under "recall", so the walk
// looks for the `states` OBJECT rather than for a known path to it.
func TestEveryResponseWithStatesCarriesTheCapacity(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Dune", 3)
	seedDistractorBook(t, srv, c, "Neuromancer")
	ageSeededItems(t, srv)

	// THE SOURCE SAYS HOW MANY THERE ARE. Every `"states":` written into a response
	// map in this package, counted where it is written rather than where somebody
	// remembered to look — so a fifth one fails this line rather than passing
	// unexamined.
	emitters := 0
	for _, f := range goSourceFiles(t) {
		emitters += strings.Count(readSource(t, f), `"states":`)
	}
	gets := []string{"/review/daily", "/review/scores", "/stats"}
	if want := len(gets) + 1; emitters != want {
		t.Fatalf("%d handlers write a `states` key; this test drives %d. A response that reports "+
			"library-wide counts has to send `capacity` beside them — add it to the list above "+
			"(and to the handler) rather than to this number.", emitters, want)
	}
	// The one POST that carries counts, which no route walk can reach.
	posts := []struct {
		path string
		body map[string]any
	}{{"/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}}}

	type probe struct {
		name string
		body map[string]any
	}
	probes := []probe{}
	for _, g := range gets {
		probes = append(probes, probe{"GET " + g, decode[map[string]any](t, c.mustDo("GET", g, nil, 200))})
	}
	for _, p := range posts {
		probes = append(probes, probe{"POST " + p.path, decode[map[string]any](t, c.mustDo("POST", p.path, p.body, 200))})
	}

	// A LITERAL, NOT reviewCapacity(...). Comparing the API against the very
	// function that computes it is a tautology: mutating reviewCapacity moved both
	// sides and this passed. 2920 is the default quota of 8 against the 365-day
	// ceiling, written out so that changing either one has to be a decision here
	// as well as there.
	want := 2920.0
	checked := 0
	// `states` can sit at the top level or one map down (/stats nests it under
	// "recall"), so the search is for the OBJECT rather than for a known path to it.
	var walk func(name string, m map[string]any)
	walk = func(name string, m map[string]any) {
		if _, ok := m["states"]; ok {
			checked++
			got, has := m["capacity"]
			if !has {
				t.Errorf("%s: sends `states` with no `capacity` beside it", name)
				return
			}
			// The VALUE too, from the same function the screen's sentence is
			// written against — a key present but wrong is the harder failure to
			// notice.
			if got != want {
				t.Errorf("%s: capacity = %v, want %v (the default quota %d x the ceiling %g)",
					name, got, want, reviewQuota, reviewMaxStability)
			}
			return
		}
		for k, v := range m {
			if sub, ok := v.(map[string]any); ok {
				walk(name+"."+k, sub)
			}
		}
	}
	for _, p := range probes {
		walk(p.name, p.body)
	}
	// A guard that found nothing to check is a guard that passes for the wrong
	// reason — the four responses below are the whole subject.
	if checked != len(probes) {
		t.Errorf("found `states` in %d of %d responses; this guard is reading the wrong ones rather than passing", checked, len(probes))
	}
}

// THE DOT AND THE DECK AGREE ABOUT WHEN A CARD COMES BACK.
//
// `dueSQL`'s comment has always made this a promise — "a card is due exactly
// when its dot reads probably-forgotten" — and until the two were derived from
// reviewDuePoint it was one number written twice in two languages: `elapsed >=
// stability` in SQL, `case p >= 0.5` in Go. Either could have moved alone, and
// the failure would have been a deck full of cards the app calls remembered, or
// a dot that says forgotten about a card the quiz will not ask for a month.
//
// ASSERTED AT THE BOUNDARY, over HTTP, on cards placed either side of it by a
// fraction — the only place the two definitions can disagree without being
// wrong about everything else as well.
func TestTheDotAndTheDeckAgreeOnDue(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Emma", 3)
	seedDistractorBook(t, srv, c, "Dune")
	ageSeededItems(t, srv)

	// elapsed = stability x dueMultiplier(target) is the boundary. At the default
	// target the multiplier is 1, so a card at exactly its half-life is due.
	edge := 30 * dueMultiplier(reviewDuePoint)
	place := func(id int64, elapsed float64) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
			(kind, item_id, stability, review_count, lapse_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, 30, 2, 0, 'got', datetime('now', ?), datetime('now', ?))`,
			id, fmt.Sprintf("-%f days", elapsed), fmt.Sprintf("-%f days", elapsed)); err != nil {
			t.Fatal(err)
		}
	}
	place(ids[0], edge*1.02) // just past due
	place(ids[1], edge*0.98) // just short of it
	place(ids[2], edge*3)    // long overdue

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	inDeck := map[int64]bool{}
	dot := map[int64]string{}
	for _, it := range deck.Items {
		inDeck[it.ID] = true
		dot[it.ID] = it.Status
	}

	// The two that are due are in the deck; the one that is not, is not.
	for _, tc := range []struct {
		id   int64
		want bool
		what string
	}{
		{ids[0], true, "just past its due point"},
		{ids[1], false, "just short of its due point"},
		{ids[2], true, "long overdue"},
	} {
		if inDeck[tc.id] != tc.want {
			t.Errorf("a card %s: in the deck = %v, want %v", tc.what, inDeck[tc.id], tc.want)
		}
	}
	// AND EVERY CARD THE DECK SERVES READS probably-forgotten. This is the half
	// that ties the two definitions together: a card the SQL called due whose dot
	// the Go code calls remembered means the two have parted company.
	for _, it := range deck.Items {
		if it.Status != "probably-forgotten" {
			t.Errorf("the deck served card %d with its dot reading %q — dueSQL and recallStatus disagree about due",
				it.ID, it.Status)
		}
	}
	if len(deck.Items) == 0 {
		t.Fatal("no cards in the deck at all, so this guard checked nothing")
	}
	_ = dot
}

// goSourceFiles / readSource — the package's own non-test sources, for the
// handful of guards that assert something about how the code is WRITTEN rather
// than about what it does.
//
// Both exist so those guards fail loudly when they can read nothing: a source
// scan that silently matches an empty list is the shape of test that passes for
// years while checking nothing, which is the failure this file has met before.
func goSourceFiles(t *testing.T) []string {
	t.Helper()
	all, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("listing the package's sources: %v", err)
	}
	var out []string
	for _, f := range all {
		if !strings.HasSuffix(f, "_test.go") {
			out = append(out, f)
		}
	}
	if len(out) < 20 {
		t.Fatalf("found %d non-test sources in this package, which cannot be right — "+
			"a scan reading nothing passes for the wrong reason", len(out))
	}
	return out
}

func readSource(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	return string(b)
}

// A MIXED library — books and films and standalone quotes together — is the one
// every real library actually is, and the one nothing tested. Every existing
// deck test seeds a single medium, so "the deck serves standalone quotes" was
// only ever asserted for a library that contains nothing else.
//
// The failure this guards against is not an error. A quote that never reaches
// the deck is a quote you stop being asked about, and the only symptom is a
// quiz that feels like it is about books — which is indistinguishable from a
// quiz that is about books because that is most of what you saved.

// seedMixedLibrary builds a library that leans heavily on books, in the
// proportion a real one does: a shelf of book highlights, a couple of films, and
// a handful of standalone quotes.
func seedMixedLibrary(t *testing.T, srv *Server, c *testClient) {
	t.Helper()
	for i := 0; i < 6; i++ {
		seedReviewBook(t, c, fmt.Sprintf("Book %d", i), 5)
	}
	for i := 0; i < 2; i++ {
		m := decode[movieDetail](t, c.mustDo("POST", "/movies",
			map[string]any{"title": fmt.Sprintf("Film %d", i)}, http.StatusCreated))
		for j := 0; j < 4; j++ {
			c.mustDo("POST", "/dialogues", map[string]any{
				"movie_id": m.ID, "quote": fmt.Sprintf("film %d line %d", i, j),
			}, http.StatusCreated)
		}
	}
	seedReviewQuotes(t, c, "Subhas Chandra Bose", "Burma Radio broadcast", 3)
	seedReviewQuotes(t, c, "Franklin D. Roosevelt", "first inaugural address", 3)
	ageSeededItems(t, srv)
}

// kindsIn reports which media a deck actually served.
func kindsIn(items []reviewCard) map[string]int {
	out := map[string]int{}
	for _, it := range items {
		out[it.Kind]++
	}
	return out
}

// The default scope is the one nobody chose, so it is the one that has to be
// right. Thirty book highlights against six standalone quotes is a five-to-one
// lean, and a deck of eight drawn fairly still has to find the quotes.
func TestDailyDeckServesEveryMediumFromAMixedLibrary(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedMixedLibrary(t, srv, c)

	// Several days, because one deck of eight is a small sample against a
	// library of forty-two and a single empty draw proves nothing either way.
	// Different seeds are what a different day gives you.
	seen := map[string]int{}
	for day := 0; day < 12; day++ {
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
		for k, n := range kindsIn(deck.Items) {
			seen[k] += n
		}
	}
	for _, kind := range []string{kindBook, kindScreen, kindUtterance} {
		if seen[kind] == 0 {
			t.Errorf("no %s card in twelve draws from a mixed library: %v", kind, seen)
		}
	}
}

// The scope preference is what decides which pools the deck draws from, and it
// is stored as one string. Every value the server accepts must actually work,
// including the two the Settings screen has never been able to send.
//
// One server and one seeded library for the whole table: GET /review/practice
// only reads (it serves the whole in-scope pool and records nothing), and every
// row PUTs its own scope before it draws, so no row can see another row's state.
func TestEveryAcceptedScopeDrawsWhatItNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedMixedLibrary(t, srv, c)

	for _, tc := range []struct {
		scope string
		want  []string
	}{
		// ---- one medium at a time ------------------------------------------
		{"books", []string{kindBook}},
		{"movies", []string{kindScreen}},
		{"quotes", []string{kindUtterance}},
		{"both", []string{kindBook, kindScreen, kindUtterance}},

		// ---- lists ----------------------------------------------------------
		// The three media are independent choices, so every combination of them
		// has to work — including the two that were unsayable until the
		// preference learned to hold a list. "books,quotes" is the case that
		// motivated it: a reader who does not want film lines in the deck should
		// not have to give up standalone quotes to say so.
		{"books,quotes", []string{kindBook, kindUtterance}},
		{"movies,quotes", []string{kindScreen, kindUtterance}},
		{"books,movies", []string{kindBook, kindScreen}},
		{"books,movies,quotes", []string{kindBook, kindScreen, kindUtterance}},
		{"quotes,books", []string{kindBook, kindUtterance}},  // order is not meaning
		{"Books, Quotes", []string{kindBook, kindUtterance}}, // spacing and case are not meaning
	} {
		t.Run(tc.scope, func(t *testing.T) {
			c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": tc.scope}, 200)
			seen := map[string]int{}
			for day := 0; day < 12; day++ {
				deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
				for k, n := range kindsIn(deck.Items) {
					seen[k] += n
				}
			}
			for _, want := range tc.want {
				if seen[want] == 0 {
					t.Errorf("scope %q served no %s: %v", tc.scope, want, seen)
				}
			}
			for k := range seen {
				found := false
				for _, want := range tc.want {
					if k == want {
						found = true
					}
				}
				if !found {
					t.Errorf("scope %q served %s, which it does not name: %v", tc.scope, k, seen)
				}
			}
		})
	}
}

// A list with one bad token is rejected whole, not silently narrowed. Dropping
// the token it did not understand is how a scope quietly becomes a different
// scope, and the only symptom would be a medium that stopped appearing.
func TestScopeRejectsAListWithRubbishInIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	for _, bad := range []string{"books,poems", "poems", "books,,quotes", ","} {
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": bad}, http.StatusBadRequest)
	}

	// An EMPTY string is the exception, and not a special case for this field:
	// every string preference treats "" as "not sending this one", which is what
	// lets the client PUT a partial object. So it leaves the stored scope alone
	// rather than being rejected — asserted here because the line above would
	// otherwise read as if it covered every falsy input.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "quotes"}, 200)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": ""}, 200)
	prefs := decode[struct {
		Preferences struct {
			SRReviewScope string `json:"srReviewScope"`
		} `json:"preferences"`
	}](t, c.mustDo("GET", "/auth/me", nil, 200))
	if prefs.Preferences.SRReviewScope != "quotes" {
		t.Fatalf("an empty scope overwrote the stored one: %q", prefs.Preferences.SRReviewScope)
	}
}

// "NEW LINES START AT" ACTUALLY MOVES WHERE A NEW LINE STARTS.
//
// WHAT THIS GUARDS. `srStart` was stored, normalised on read and write, drawn as
// a row on the Review section and consumed by NOTHING: every first answer seeded
// its half-life at the floor whatever the reader had chosen. A journey vouched
// for the row by asserting the value round-tripped, which is the shape CLAUDE.md's
// testing ruling exists to stop — a green test over a dead feature. The assertion
// here is the half-life the schedule comes out with, not the preference going in.
//
// The row's own words are the specification: "Mastered starts it at the far end,
// for a library you already know — it still comes round, just rarely, and a wrong
// answer brings it back."
func TestNewLinesStartWhereTheReaderSaid(t *testing.T) {
	answerFresh := func(t *testing.T, start, result string) float64 {
		t.Helper()
		srv := newTestServer(t)
		h := srv.Handler()
		c := signupAdmin(t, h)
		if start != "" {
			c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srStart": start}, http.StatusOK)
		}
		book := createBook(t, c, "Pride and Prejudice")
		id := idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book, "quote": "Call me Ishmael, and then call me again."},
			http.StatusCreated).Body.Bytes())
		ageSeededItems(t, srv)
		// Practice with srPracticeCounts off would not move the schedule at all,
		// so this goes through the daily path — the one a reader's first answer
		// actually takes.
		res := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
			"kind": kindBook, "id": id, "result": result, "mode": "daily",
		}, http.StatusOK))
		return res.Stability
	}

	// The default is unchanged: a first correct answer sits on the first rung.
	if got := answerFresh(t, "", "got"); got != reviewMinStability {
		t.Errorf("default start: first answer gave a half-life of %v, want the floor %v", got, reviewMinStability)
	}
	if got := answerFresh(t, startUnseen, "got"); got != reviewMinStability {
		t.Errorf("Not seen: first answer gave a half-life of %v, want the floor %v", got, reviewMinStability)
	}

	// Mastered: the far end, and the number has to be MUCH larger or the row is
	// telling the reader something the schedule does not do.
	mastered := answerFresh(t, startMastered, "got")
	if mastered <= reviewMinStability {
		t.Errorf("Mastered: first answer gave a half-life of %v, no further out than the floor %v", mastered, reviewMinStability)
	}
	if mastered != reviewMaxStability {
		t.Errorf("Mastered: first answer gave a half-life of %v, want the top rung %v", mastered, reviewMaxStability)
	}

	// AND A WRONG ANSWER BRINGS IT BACK, which is the clause that stops this being
	// a way to switch the quiz off. The top rung was the reader's assumption about
	// their own library; getting it wrong is the evidence against it.
	if got := answerFresh(t, startMastered, "forgot"); got != reviewMinStability {
		t.Errorf("Mastered then wrong: half-life is %v, want the floor %v — the row promises it comes back", got, reviewMinStability)
	}
}

// A CARD THAT HAS BEEN ANSWERED BEFORE IS NOT RE-SEEDED. `srStart` is about
// ENTERING the schedule; applying it to a card already in one would let a reader
// launder a forgotten line back to the far end by toggling a preference.
func TestStartingRungDoesNotReachACardAlreadyInTheSchedule(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Pride and Prejudice")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "Call me Ishmael, and then call me again."},
		http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	// It enters at the floor, under the default.
	first := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "forgot", "mode": "daily",
	}, http.StatusOK))
	if first.Stability != reviewMinStability {
		t.Fatalf("the card did not enter at the floor: %v", first.Stability)
	}

	// Now the reader switches the preference. The card is already in the schedule,
	// so the next answer must climb from where it is rather than jump to the end.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srStart": startMastered}, http.StatusOK)
	next := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "got", "mode": "practice",
	}, http.StatusOK))
	if next.Stability == reviewMaxStability {
		t.Errorf("a card already in the schedule was re-seeded at the top rung (%v)", next.Stability)
	}
}
