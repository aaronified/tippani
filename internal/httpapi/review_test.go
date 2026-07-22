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
		VALUES ('book', ?, 365, 1, 'got', datetime('now'), datetime('now'))`, ids[0]); err != nil {
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
	} {
		if _, err := srv.Store.DB.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
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

	// A single-title library can't form a multiple-choice question (no wrong
	// answer to offer), so its deck is empty.
	_, ids := seedReviewBook(t, c, "Dune", 3)
	ageSeededItems(t, srv)
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 {
		t.Fatalf("single-title deck should be empty (no MCQ distractors): %+v", deck)
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
		if it.Direction != dirSource && it.Direction != dirQuote {
			t.Fatalf("bad direction: %+v", it)
		}
		if len(it.Options) < 2 || it.Answer < 0 || it.Answer >= len(it.Options) {
			t.Fatalf("bad MCQ options/answer: %+v", it)
		}
		// The correct option is the card's title (source) or its quote (quote).
		want := it.Title
		if it.Direction == dirQuote {
			want = it.Quote
		}
		if it.Options[it.Answer] != want {
			t.Fatalf("answer option mismatch: %+v", it)
		}
	}

	// A correct pick counts as "got" (half-life 7 -> 17.5), the card leaves the
	// deck, and freshly reviewed reads as remembered. Every answer also carries
	// the fresh library-wide status counts (Dune 3 + the remembered Emma
	// distractor = 4) so "Where you stand" updates live.
	res := answer(t, c, kindBook, ids[0], "got", "daily")
	if !res.OK || res.Stability != 17.5 || res.Status != "remembered" || res.Answered != 1 || res.Got != 1 {
		t.Fatalf("got: %+v", res)
	}
	if res.States.Total != 4 || res.States.Remembered != 2 || res.States.Unseen != 2 {
		t.Fatalf("states after got: %+v", res.States)
	}
	// A wrong pick counts as "forgot": floor 7, lapse recorded, and — however
	// freshly reviewed — it reads as probably-forgotten, not remembered (a lapse
	// is the honest signal about current recall).
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
	if deck.Items[0].Status != "probably-forgotten" || len(deck.Items[0].Options) < 2 {
		t.Fatalf("due item: %+v", deck.Items[0])
	}

	// A correct recall regrows the half-life: 10 × 2.5 = 25.
	res := answer(t, c, kindBook, ids[1], "got", "daily")
	if res.Stability < 24.9 || res.Stability > 25.1 {
		t.Fatalf("regrown stability: %+v", res)
	}
	// A LATE correct recall earns elapsed credit instead: stability 7 but 21
	// days survived -> 21 × 1.2 = 25.2 (beats 7 × 2.5 = 17.5).
	res = answer(t, c, kindBook, ids[2], "got", "daily")
	if res.Stability < 25.1 || res.Stability > 25.3 {
		t.Fatalf("late-recall credit: %+v", res)
	}
	// A long-stable lapse shrinks but keeps a footing: 40 * 0.25 = 10.
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
		SET stability = 40, last_reviewed_at = datetime('now', '-50 days'),
		    last_touched_at = datetime('now', '-50 days') WHERE kind='book' AND item_id=?`, ids[2]); err != nil {
		t.Fatal(err)
	}
	res = answer(t, c, kindBook, ids[2], "forgot", "daily")
	if res.Stability != 10 {
		t.Fatalf("lapse: %+v", res)
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
	if first.Stability != 17.5 || again.Stability != 17.5 || again.Answered != 1 {
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
	east, _, _ := reviewDay(720)   // UTC+12
	west, _, _ := reviewDay(-720)  // UTC-12
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
		if len(it.Options) < 2 {
			t.Fatalf("practice card without options: %+v", it)
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
	if res.Status != "remembered" || res.Stability != 17.5 {
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

	// Quiz it right → row at 17.5 (floor 7 × 2.5). The Daily Quiz is NOT "seeing"
	// (its grade drives the schedule in full), so no extra bump here.
	answer(t, c, kindBook, ids[0], "got", "daily")
	if s := stabilityOf(ids[0]); !near(s, 17.5) {
		t.Fatalf("after daily got: %v (want 17.5)", s)
	}
	// Sharing (POST /review/seen): 17.5 × 1.2 = 21.0
	c.mustDo("POST", "/review/seen", map[string]any{"kind": kindBook, "id": ids[0]}, 200)
	if s := stabilityOf(ids[0]); !near(s, 21.0) {
		t.Fatalf("after share-seen: %v (want 21.0)", s)
	}
	// Practising (default: not counting) still counts as seeing: 21.0 × 1.2 = 25.2
	answer(t, c, kindBook, ids[0], "got", "practice")
	if s := stabilityOf(ids[0]); !near(s, 25.2) {
		t.Fatalf("after practice-seen: %v (want 25.2)", s)
	}
	// Favouriting (false→true) counts as seeing: 25.2 × 1.2 = 30.24
	favBody := map[string]any{"quote": "Dune passage 0", "color": "yellow", "favorite": true}
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), favBody, 200)
	if s := stabilityOf(ids[0]); !near(s, 30.24) {
		t.Fatalf("after favourite-seen: %v (want 30.24)", s)
	}
	// Re-saving an already-favourite card is not a fresh "seeing".
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), favBody, 200)
	if s := stabilityOf(ids[0]); !near(s, 30.24) {
		t.Fatalf("re-saving a favourite re-credited seeing: %v (want 30.24)", s)
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
	if res.Stability != 17.5 || res.Status != "remembered" {
		t.Fatalf("screen answer: %+v", res)
	}
	list := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, 200))
	var found bool
	for _, d := range list.Dialogues {
		if d.ID == dlg.ID {
			found = d.Reviewed && d.Stability == 17.5
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
		if a.ID == ids[0] && (!a.Reviewed || a.Stability != 17.5) {
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
