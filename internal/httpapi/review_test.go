package httpapi

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

import (
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"
)

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
	OK        bool         `json:"ok"`
	Kind      string       `json:"kind"`
	ID        int64        `json:"id"`
	Stability float64      `json:"stability"`
	Status    string       `json:"status"`
	Mode      string       `json:"mode"`
	Answered  int          `json:"answered"`
	Got       int          `json:"got"`
	Forgot    int          `json:"forgot"`
	Remaining int          `json:"remaining"`
	States    statusCounts `json:"states"`
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
			"book_id": book.ID, "quote": fmt.Sprintf("%s passage %d", title, i),
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
	if card.Direction == dirFlip {
		return len(card.Options) == 0
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
	for _, it := range deck.Items {
		if it.Direction != dirFlip || len(it.Options) != 0 {
			t.Fatalf("single-title card should be a flip card with no options: %+v", it)
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
		if it.Direction != dirFlip {
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
	// From the 30-day rung a success climbs straight to the 100-day top rung.
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
	// The top rung holds: a correct recall at 100 stays at 100. (The direct
	// UPDATE leaves this row's review_count at 2 gots vs 0 lapses, so the
	// climb gate lets it through.)
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
		SET stability = 100, last_reviewed_at = datetime('now', '-120 days'),
		    last_touched_at = datetime('now', '-120 days') WHERE kind='book' AND item_id=?`, ids[1]); err != nil {
		t.Fatal(err)
	}
	res = answer(t, c, kindBook, ids[1], "got", "daily")
	if res.Stability != 100 {
		t.Fatalf("top rung: %+v", res)
	}
}

// nextRung pins the whole ladder shape: each rung climbs to the next, the top
// holds, and off-rung half-lives (pre-ladder rows, srSeen bumps) climb to the
// nearest rung above.
func TestNextRung(t *testing.T) {
	cases := []struct{ cur, want float64 }{
		{3, 7}, {7, 30}, {8.4, 30}, {29.9, 30}, {30, 100},
		{60, 100}, {99.9, 100}, {100, 100}, {365, 100},
	}
	for _, c := range cases {
		if got := nextRung(c.cur); got != c.want {
			t.Fatalf("nextRung(%v) = %v, want %v", c.cur, got, c.want)
		}
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

// The "seeing" effect (srSeen): practising (not skipping), sharing, or
// favouriting a card lengthens its half-life marginally — separate from Daily
// Quiz recall, off by default, and never touching an unseen card.
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
	// Practising (default: not counting) still counts as seeing: 8.4 × 1.2 = 10.08
	answer(t, c, kindBook, ids[0], "got", "practice")
	if s := stabilityOf(ids[0]); !near(s, 10.08) {
		t.Fatalf("after practice-seen: %v (want 10.08)", s)
	}
	// Favouriting (false→true) counts as seeing: 10.08 × 1.2 = 12.096
	favBody := map[string]any{"quote": "Dune passage 0", "color": "yellow", "favorite": true}
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), favBody, 200)
	if s := stabilityOf(ids[0]); !near(s, 12.096) {
		t.Fatalf("after favourite-seen: %v (want 12.096)", s)
	}
	// Re-saving an already-favourite card is not a fresh "seeing".
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), favBody, 200)
	if s := stabilityOf(ids[0]); !near(s, 12.096) {
		t.Fatalf("re-saving a favourite re-credited seeing: %v (want 12.096)", s)
	}

	// A skipped practice card is not "seeing".
	before := stabilityOf(ids[0])
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "skip", "mode": "practice"}, 200)
	if s := stabilityOf(ids[0]); !near(s, before) {
		t.Fatalf("a skip counted as seeing: %v -> %v", before, s)
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
	if screen == nil || len(screen.Options) < 2 || screen.Title != "Heat" {
		t.Fatalf("screen card not in deck with options: %+v", deck.Items)
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

// GET /annotations exposes review-state fields, and a full-state PUT must not
// clobber the schedule (it lives in its own table); delete cascades it.
func TestReviewStatusInList(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 2)

	list := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	for _, a := range list.Annotations {
		if a.Reviewed {
			t.Fatalf("fresh annotation marked reviewed: %+v", a)
		}
	}

	answer(t, c, kindBook, ids[0], "got", "daily") // answers by id (no deck needed)
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), map[string]any{
		"quote": "Dune passage 0", "color": "blue", "favorite": true}, 200)

	list = decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	for _, a := range list.Annotations {
		if a.ID == ids[0] && (!a.Reviewed || a.Stability != 7) {
			t.Fatalf("review state lost across PUT: %+v", a)
		}
	}
	c.mustDo("DELETE", fmt.Sprintf("/annotations/%d", ids[0]), nil, 200)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind='book' AND item_id=?`, ids[0]).Scan(&n); err != nil || n != 0 {
		t.Fatalf("review row survived annotation delete: %d, %v", n, err)
	}
}

// The new-item grace week (reviewNewItemDays): a quote saved this week reads
// "remembered" and is not yet due; past the week it surfaces as unseen and
// enters the Daily Quiz; a recorded lapse always beats the buffer.
func TestReviewNewItemBuffer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 2)
	seedDistractorBook(t, srv, c, "Emma")

	// Fresh items: nothing due, and the whole library reads remembered (the two
	// fresh Dune quotes via the buffer, the parked Emma quote via its half-life).
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 {
		t.Fatalf("fresh items served in the daily deck: %+v", deck.Items)
	}
	if deck.States.Remembered != 3 || deck.States.Unseen != 0 || deck.States.Total != 3 {
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

// distractorScore ranks confusable works: books by same-author then shared
// genres; films/shows by shared genres then shared actor; same medium always
// over cross-medium.
func TestDistractorScore(t *testing.T) {
	own := workRef{key: "book:1", kind: kindBook, author: "Le Guin", genres: set("scifi", "fantasy")}
	sameAuthor := workRef{key: "book:2", kind: kindBook, author: "Le Guin", genres: set()}
	twoGenre := workRef{key: "book:3", kind: kindBook, author: "X", genres: set("scifi", "fantasy")}
	oneGenre := workRef{key: "book:4", kind: kindBook, author: "Y", genres: set("scifi")}
	unrelated := workRef{key: "book:5", kind: kindBook, author: "Z", genres: set("romance")}
	crossMedium := workRef{key: "screen:1", kind: kindScreen, genres: set("scifi")}

	order := []workRef{sameAuthor, twoGenre, oneGenre, unrelated, crossMedium}
	for i := 0; i+1 < len(order); i++ {
		if distractorScore(own, order[i]) <= distractorScore(own, order[i+1]) {
			t.Fatalf("ranking wrong at %d: %d <= %d", i, distractorScore(own, order[i]), distractorScore(own, order[i+1]))
		}
	}

	// Screen: genre dominates, shared actor breaks the tie.
	sOwn := workRef{key: "screen:9", kind: kindScreen, genres: set("crime"), actors: set("pacino")}
	genreMatch := workRef{key: "screen:10", kind: kindScreen, genres: set("crime"), actors: set()}
	actorMatch := workRef{key: "screen:11", kind: kindScreen, genres: set(), actors: set("pacino")}
	if distractorScore(sOwn, genreMatch) <= distractorScore(sOwn, actorMatch) {
		t.Fatalf("screen: genre should outrank actor")
	}
	if distractorScore(sOwn, actorMatch) <= 0 {
		t.Fatalf("screen: shared actor should still score")
	}
}

func set(ss ...string) map[string]bool {
	m := map[string]bool{}
	for _, s := range ss {
		m[s] = true
	}
	return m
}

// GET /annotations?limit=N caps the list; a bad limit is a 400.
func TestAnnotationListLimit(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	seedReviewBook(t, c, "Dune", 5)
	got := decode[annList](t, c.mustDo("GET", "/annotations?limit=2", nil, 200))
	if len(got.Annotations) != 2 {
		t.Fatalf("limit=2 returned %d", len(got.Annotations))
	}
	c.mustDo("GET", "/annotations?limit=0", nil, http.StatusBadRequest)
	c.mustDo("GET", "/annotations?limit=nope", nil, http.StatusBadRequest)
}

// TestQuizChoicesSeedDeterministic locks the Daily Quiz fix: a given seed must
// produce byte-identical options + order, so two browsers viewing the same
// day's card see the same choices (not just the same right answer). A nil rng
// (practice) is allowed to vary, so it's only checked for a well-formed result.
func TestQuizChoicesSeedDeterministic(t *testing.T) {
	answer := "The Correct One"
	distractors := []string{"Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"}
	eq := func(a, b []string) bool {
		if len(a) != len(b) {
			return false
		}
		for i := range a {
			if a[i] != b[i] {
				return false
			}
		}
		return true
	}
	o1, a1 := choicesFrom(answer, distractors, 4, seededRand(12345))
	o2, a2 := choicesFrom(answer, distractors, 4, seededRand(12345))
	if !eq(o1, o2) || a1 != a2 {
		t.Fatalf("same seed must give identical options: %v(%d) vs %v(%d)", o1, a1, o2, a2)
	}
	if len(o1) != 4 || o1[a1] != answer {
		t.Fatalf("malformed choices %v answer#%d", o1, a1)
	}
	// The answer is always present regardless of RNG.
	on, an := choicesFrom(answer, distractors, 4, nil)
	if len(on) != 4 || on[an] != answer {
		t.Fatalf("nil-rng choices malformed %v answer#%d", on, an)
	}
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
	if want := reviewQuota / reviewUnseenShare; got != want {
		t.Fatalf("unseen cards in deck: got %d, want %d (reserved share)", got, want)
	}
	// The rest of the deck is still the backlog, most overdue first — the
	// reservation must not starve the schedule.
	if backlogged := len(deck.Items) - got; backlogged != reviewQuota-reviewQuota/reviewUnseenShare {
		t.Fatalf("due cards in deck: got %d", backlogged)
	}
}

// With no unseen cards left the reservation yields its slots back, and with no
// due cards the deck is all unseen. Neither bucket may leave the deck short.
func TestDailyQuizBucketsYieldWhenEmpty(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Middlemarch", reviewQuota*2)
	seedReviewBook(t, c, "Dune", reviewQuota*2)
	ageSeededItems(t, srv)

	// All unseen: the deck fills from the unseen bucket alone.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("unseen-only deck: got %d", len(deck.Items))
	}

	// Now make every card seen-and-due, leaving the unseen bucket empty.
	if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
		(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
		SELECT 'book', id, 7, 1, 'got', datetime('now', '-90 days'), datetime('now', '-90 days')
		FROM annotations`); err != nil {
		t.Fatal(err)
	}
	_ = ids
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("due-only deck: got %d", len(deck.Items))
	}
}

// Practice draws from the whole pool with no due filter and no unseen
// reservation — an already-reviewed card must not become more likely to come up
// than an unreviewed one — but it does inherit the per-work rotation.
func TestPracticeSharesSelectionWithoutReservation(t *testing.T) {
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
}

// spreadByWork keeps every candidate, never loops forever, and puts the
// best-ranked work first.
func TestSpreadByWork(t *testing.T) {
	mk := func(key string, id int64) reviewCand {
		c := reviewCand{workKey: key}
		c.card.ID = id
		return c
	}
	in := []reviewCand{
		mk("book:1", 1), mk("book:1", 2), mk("book:1", 3), mk("book:1", 4),
		mk("book:2", 5), mk("book:3", 6),
	}
	out := spreadByWork(in)
	if len(out) != len(in) {
		t.Fatalf("dropped candidates: %d -> %d", len(in), len(out))
	}
	if out[0].workKey != "book:1" || out[1].workKey != "book:2" || out[2].workKey != "book:3" {
		t.Fatalf("first rotation should hit each work once: %v %v %v", out[0].workKey, out[1].workKey, out[2].workKey)
	}
	if out[3].workKey != "book:1" || out[3].card.ID != 2 {
		t.Fatalf("second rotation should resume book:1 in rank order, got %+v", out[3])
	}
	// A single work is returned untouched.
	solo := []reviewCand{mk("book:9", 1), mk("book:9", 2)}
	if got := spreadByWork(solo); len(got) != 2 || got[0].card.ID != 1 {
		t.Fatalf("single-work list must keep its order: %+v", got)
	}
}
