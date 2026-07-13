package httpapi

// Tests for the v0.5.0 spaced-repetition rework: the Daily Quiz deck (unseen
// pool, due-ness, quota, per-day exclusion, timezone), the half-life update
// rules, Practice (unlimited, skippable, schedule-neutral by default and
// opt-in via srPracticeCounts), the two-direction question shape, scores +
// streaks, the status dot fields on the list endpoints, books+screen coverage,
// ownership isolation, and review-state survival across edits/deletes.

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
	OK        bool    `json:"ok"`
	Kind      string  `json:"kind"`
	ID        int64   `json:"id"`
	Stability float64 `json:"stability"`
	Status    string  `json:"status"`
	Mode      string  `json:"mode"`
	Answered  int     `json:"answered"`
	Got       int     `json:"got"`
	Forgot    int     `json:"forgot"`
	Remaining int     `json:"remaining"`
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

// answer POSTs one grade and decodes the reply.
func answer(t *testing.T, c *testClient, kind string, id int64, result, mode string) answerResp {
	t.Helper()
	return decode[answerResp](t, c.mustDo("POST", "/review/answer",
		map[string]any{"kind": kind, "id": id, "result": result, "mode": mode}, 200))
}

func TestDailyQuizFlow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Empty pool: an empty deck, not an error.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 || deck.AnsweredToday != 0 || deck.Quota != reviewQuota {
		t.Fatalf("empty pool deck: %+v", deck)
	}

	_, ids := seedReviewBook(t, c, "Dune", 3)

	// Three unseen cards, all in today's deck, each with a question direction.
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 3 || deck.States.Unseen != 3 || deck.States.Total != 3 {
		t.Fatalf("deck size/states: %+v", deck)
	}
	for _, it := range deck.Items {
		if it.Kind != kindBook || it.Title != "Dune" || it.Status != "unseen" || it.ReviewCount != 0 || it.Quote == "" {
			t.Fatalf("unseen item: %+v", it)
		}
		if it.Direction != dirSource && it.Direction != dirQuote {
			t.Fatalf("bad direction: %+v", it)
		}
	}

	// got: half-life 1 -> 2.5; the card leaves today's deck; freshly reviewed → remembered.
	res := answer(t, c, kindBook, ids[0], "got", "daily")
	if !res.OK || res.Stability != 2.5 || res.Status != "remembered" || res.Remaining != 2 || res.Answered != 1 || res.Got != 1 {
		t.Fatalf("got: %+v", res)
	}

	// forgot on a fresh card: floor holds at 1 and the lapse is counted.
	res = answer(t, c, kindBook, ids[1], "forgot", "daily")
	if res.Stability != 1 || res.Remaining != 1 || res.Answered != 2 || res.Forgot != 1 {
		t.Fatalf("forgot: %+v", res)
	}
	var lapses int
	if err := srv.Store.DB.QueryRow(`SELECT lapse_count FROM item_reviews WHERE kind='book' AND item_id=?`, ids[1]).Scan(&lapses); err != nil || lapses != 1 {
		t.Fatalf("lapse_count %d, %v", lapses, err)
	}

	// Daily forbids skip.
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[2], "result": "skip", "mode": "daily"}, http.StatusBadRequest)

	// Answer the last card; the day is done.
	res = answer(t, c, kindBook, ids[2], "got", "daily")
	if res.Remaining != 0 || res.Answered != 3 {
		t.Fatalf("last card: %+v", res)
	}
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 || deck.AnsweredToday != 3 || deck.GotToday != 2 || deck.ForgotToday != 1 || deck.Streak != 1 {
		t.Fatalf("deck after answers: %+v", deck)
	}

	// Validation.
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "aced", "mode": "daily"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": "bogus", "id": ids[0], "result": "got", "mode": "daily"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "weekly"}, http.StatusBadRequest)
	c.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily", "offset": 2000}, http.StatusBadRequest)
	c.mustDo("GET", "/review/daily?offset=abc", nil, http.StatusBadRequest)
	c.mustDo("GET", "/review/daily?offset=900", nil, http.StatusBadRequest)
}

func TestDailyQuizScheduling(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Emma", 3)

	seed := func(id int64, stability float64, daysAgo int) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`
			INSERT INTO item_reviews (kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES ('book', ?, ?, 1, 'got', datetime('now', ?), datetime('now', ?))`,
			id, stability, fmt.Sprintf("-%d days", daysAgo), fmt.Sprintf("-%d days", daysAgo)); err != nil {
			t.Fatal(err)
		}
	}
	seed(ids[0], 10, 3) // p = 2^(-0.3) ≈ .81 — not due (forgetting, but > .5)
	seed(ids[1], 2, 3)  // p = 2^(-1.5) ≈ .35 — due
	seed(ids[2], 1, 3)  // p = 2^(-3)   = .125 — the most forgotten

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 2 {
		t.Fatalf("due filter: %+v", deck)
	}
	// Most forgotten first.
	if deck.Items[0].ID != ids[2] || deck.Items[1].ID != ids[1] {
		t.Fatalf("due order: %d, %d (want %d, %d)", deck.Items[0].ID, deck.Items[1].ID, ids[2], ids[1])
	}
	if deck.Items[0].Status != "probably-forgotten" || deck.Items[0].ReviewCount != 1 {
		t.Fatalf("due item state: %+v", deck.Items[0])
	}
	// The not-due card reads as forgetting in the states breakdown.
	if deck.States.Forgetting < 1 {
		t.Fatalf("states: %+v", deck.States)
	}

	// A late successful recall earns the elapsed-time credit:
	// stability 2, reviewed 3 days ago -> max(2*2.5, ~3*1.2) = 5.
	res := answer(t, c, kindBook, ids[1], "got", "daily")
	if res.Stability < 4.9 || res.Stability > 5.1 {
		t.Fatalf("regrown stability: %+v", res)
	}

	// A long-stable card that lapses shrinks but keeps a footing: 40 * 0.25 = 10.
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

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("deck capped at quota: got %d", len(deck.Items))
	}
	// The deck order is stable within a day.
	again := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	for i := range deck.Items {
		if again.Items[i].ID != deck.Items[i].ID {
			t.Fatalf("deck order changed between fetches: %v vs %v", deck.Items[i].ID, again.Items[i].ID)
		}
	}
	// Answer the whole deck; the day is then done even with unseen cards left.
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

// A stale second device (or a retried POST) answering the same daily card on
// the same local day must be an idempotent no-op — not a second application
// that compounds stability (1→2.5→6.25) and double-counts the tally.
func TestDailyQuizIdempotentSameDay(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)

	first := answer(t, c, kindBook, ids[0], "got", "daily")
	if first.Stability != 2.5 {
		t.Fatalf("first got: %+v", first)
	}
	again := answer(t, c, kindBook, ids[0], "got", "daily")
	if again.Stability != 2.5 || again.Answered != 1 {
		t.Fatalf("same-day repeat recompounded: %+v", again)
	}
	var reviews int
	if err := srv.Store.DB.QueryRow(`SELECT review_count FROM item_reviews WHERE kind='book' AND item_id=?`, ids[0]).Scan(&reviews); err != nil || reviews != 1 {
		t.Fatalf("review_count double-counted: %d, %v", reviews, err)
	}
}

// The local day follows the client's UTC offset: a card answered at a UTC
// moment that is "midday today" in one longitude is "yesterday evening" in
// another, and only the latter frees the card for a new pass.
func TestDailyQuizTimezone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Kim", 1)

	answer(t, c, kindBook, ids[0], "got", "daily")
	// Backdate the answer to 6 hours ago (UTC) and push its next due date out so
	// only the local-day boundary (not due-ness) can bring it back.
	if _, err := srv.Store.DB.Exec(`UPDATE item_reviews
		SET stability = 30, last_reviewed_at = datetime('now', '-6 hours'),
		    last_touched_at = datetime('now', '-6 hours') WHERE kind='book' AND item_id=?`, ids[0]); err != nil {
		t.Fatal(err)
	}
	_ = ids

	now := time.Now().UTC()
	toOffset := func(targetHour int) int {
		o := (targetHour-now.Hour())*60 - now.Minute()
		if o < -720 {
			o += 1440
		}
		if o > 840 {
			o -= 1440
		}
		return o
	}
	sameDay, straddling := toOffset(12), toOffset(3)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", fmt.Sprintf("/review/daily?offset=%d", sameDay), nil, 200))
	if deck.AnsweredToday != 1 || len(deck.Items) != 0 {
		t.Fatalf("same local day: %+v", deck)
	}
	deck = decode[reviewDeckResp](t, c.mustDo("GET", fmt.Sprintf("/review/daily?offset=%d", straddling), nil, 200))
	if deck.AnsweredToday != 0 {
		t.Fatalf("across local midnight: %+v", deck)
	}
}

// Practice is unlimited, skippable, and by default schedule-neutral; opting in
// (srPracticeCounts) makes it move the half-life like the Daily Quiz. Its score
// is separate and resettable.
func TestPracticeMode(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 3)

	// The whole in-scope pool comes back for the client to walk.
	pd := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if pd.Pool != 3 || len(pd.Items) != 3 {
		t.Fatalf("practice pool: %+v", pd)
	}

	// A practice "got" by default does NOT create/move a schedule row, but it
	// does log the practice score. The card's status stays unseen.
	res := answer(t, c, kindBook, ids[0], "got", "practice")
	if res.Status != "unseen" || res.Answered != 1 || res.Got != 1 {
		t.Fatalf("practice got (default): %+v", res)
	}
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("practice must not touch the schedule by default: %d, %v", n, err)
	}

	// Skip is allowed in practice and is not counted as an answer.
	res = answer(t, c, kindBook, ids[1], "skip", "practice")
	if res.Answered != 1 {
		t.Fatalf("skip counted as an answer: %+v", res)
	}

	// The daily deck is untouched by practice.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 3 || deck.AnsweredToday != 0 {
		t.Fatalf("practice leaked into daily: %+v", deck)
	}

	// Opt Practice into the schedule; now a practice "got" moves the half-life.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, 200)
	res = answer(t, c, kindBook, ids[2], "got", "practice")
	if res.Status != "remembered" || res.Stability != 2.5 {
		t.Fatalf("practice got (counting): %+v", res)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind='book' AND item_id=?`, ids[2]).Scan(&n); err != nil || n != 1 {
		t.Fatalf("counting practice must move the schedule: %d, %v", n, err)
	}

	// Reset the practice score: the tally clears, the schedule row survives.
	c.mustDo("DELETE", "/review/practice", nil, 200)
	scores := decode[scoresResp](t, c.mustDo("GET", "/review/scores", nil, 200))
	if scores.Practice.Answered != 0 || scores.Practice.Sessions != 0 {
		t.Fatalf("practice score not reset: %+v", scores.Practice)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind='book' AND item_id=?`, ids[2]).Scan(&n); err != nil || n != 1 {
		t.Fatalf("reset wrongly cleared the schedule: %d, %v", n, err)
	}
}

// Scores keep the Daily Quiz (permanent) and Practice (resettable) tallies
// apart, and expose accuracy + the library-wide status breakdown.
func TestReviewScores(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 4)

	answer(t, c, kindBook, ids[0], "got", "daily")
	answer(t, c, kindBook, ids[1], "got", "daily")
	answer(t, c, kindBook, ids[2], "forgot", "daily")
	answer(t, c, kindBook, ids[3], "got", "practice")

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
	// All three dailied cards were just reviewed, so their instantaneous recall
	// probability is ≈1 → remembered (the forgot card differs only in its short
	// half-life, which will slide it back within a day). The practice card never
	// entered the schedule → unseen.
	if scores.States.Remembered != 3 || scores.States.Unseen != 1 || scores.States.Total != 4 {
		t.Fatalf("states: %+v", scores.States)
	}
}

// Films/shows (dialogues) are first-class review items: they enter the deck,
// grade like books, expose status on the list, and their review row dies with
// the line (the polymorphic cleanup trigger).
func TestReviewScreenCards(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Heat"}, http.StatusCreated))
	dlg := decode[dialogueRow](t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": movie.ID, "quote": "Don't let yourself get attached", "character": "Neil"}, http.StatusCreated))

	// Scope "both": the screen line is in the daily deck as a screen card.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 1 || deck.Items[0].Kind != kindScreen || deck.Items[0].Title != "Heat" || deck.Items[0].Character != "Neil" {
		t.Fatalf("screen deck: %+v", deck)
	}

	res := answer(t, c, kindScreen, dlg.ID, "got", "daily")
	if res.Stability != 2.5 || res.Status != "remembered" {
		t.Fatalf("screen answer: %+v", res)
	}
	var stability float64
	if err := srv.Store.DB.QueryRow(`SELECT stability FROM item_reviews WHERE kind='screen' AND item_id=?`, dlg.ID).Scan(&stability); err != nil || stability != 2.5 {
		t.Fatalf("screen schedule row: %v, %v", stability, err)
	}

	// The list surfaces the status fields.
	list := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, 200))
	if len(list.Dialogues) != 1 || !list.Dialogues[0].Reviewed || list.Dialogues[0].Stability != 2.5 {
		t.Fatalf("dialogue list review state: %+v", list.Dialogues)
	}

	// Deleting the line cascades its review row via the trigger.
	c.mustDo("DELETE", fmt.Sprintf("/dialogues/%d", dlg.ID), nil, 200)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind='screen'`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("screen review row survived line delete: %d, %v", n, err)
	}

	// A scope of just books hides screen lines from the deck.
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie.ID, "quote": "another line"}, http.StatusCreated)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srReviewScope": "books"}, 200)
	deck = decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) != 0 {
		t.Fatalf("books-only scope still served a screen card: %+v", deck)
	}
}

// GET /annotations exposes the review status fields, and a full-state PUT (edit,
// heart-toggle) must not clobber the schedule (it lives in its own table).
func TestReviewStatusInList(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 2)

	// Unseen until reviewed.
	list := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	for _, a := range list.Annotations {
		if a.Reviewed {
			t.Fatalf("fresh annotation marked reviewed: %+v", a)
		}
	}

	answer(t, c, kindBook, ids[0], "got", "daily")
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), map[string]any{
		"quote": "Dune passage 0", "color": "blue", "favorite": true}, 200)

	list = decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	var seen int
	for _, a := range list.Annotations {
		if a.ID == ids[0] {
			if !a.Reviewed || a.Stability != 2.5 {
				t.Fatalf("review state lost across PUT: %+v", a)
			}
			seen++
		}
	}
	if seen != 1 {
		t.Fatalf("annotation missing from list")
	}

	// Deleting the annotation cascades its review row.
	c.mustDo("DELETE", fmt.Sprintf("/annotations/%d", ids[0]), nil, 200)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM item_reviews WHERE kind='book' AND item_id=?`, ids[0]).Scan(&n); err != nil || n != 0 {
		t.Fatalf("review row survived annotation delete: %d, %v", n, err)
	}
}

func TestReviewOwnership(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bob := addUser(t, h, c, "bob")
	_, ids := seedReviewBook(t, c, "Dune", 1)

	// Foreign items answer 404 and never enter the deck.
	bob.mustDo("POST", "/review/answer", map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}, http.StatusNotFound)
	if deck := decode[reviewDeckResp](t, bob.mustDo("GET", "/review/daily", nil, 200)); len(deck.Items) != 0 {
		t.Fatalf("bob deck leaked: %+v", deck)
	}
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
