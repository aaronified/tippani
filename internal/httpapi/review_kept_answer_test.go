package httpapi

import (
	"net/http"
	"testing"
	"time"
)

// AN ANSWER THE BROWSER KEPT AND SENT LATER.
//
// The Daily Quiz posted each grade the moment it was given and forgot it when the
// post failed, so the card came back after a refresh. The owner, 1 October: "4
// registered. 1 didn't. Now on page refresh, that will come back." The browser
// now keeps every answer and sends it until the server takes it, so an answer
// can arrive twice (a reply lost after the write) and late (sent the next
// morning). These are the server's half of that: a second arrival writes
// nothing, and a late one is counted on the day it was given.
//
// SETUP KNOWS the addresses and fields the review tests already use, and two
// tables a reader cannot see from any screen — item_recalls and quiz_sessions —
// because "logged once" and "on which day" have no number on a screen to read.

func keptAnswer(t *testing.T, c *testClient, body map[string]any, want int) answerResp {
	t.Helper()
	rec := c.mustDo("POST", "/review/answer", body, want)
	if want != http.StatusOK {
		return answerResp{}
	}
	return decode[answerResp](t, rec)
}

func TestAnAnswerSentTwiceIsOneAnswer(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma")
	// PRACTICE, WITH ITS ANSWERS COUNTED, because a Daily repeat was already an
	// echo by day and a Practice repeat was not: it logged, tallied and grew the
	// half-life a second time.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, http.StatusOK)

	body := map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "practice", "client_id": "a1b2c3"}
	first := keptAnswer(t, c, body, http.StatusOK)
	again := keptAnswer(t, c, body, http.StatusOK)
	if again.Stability != first.Stability {
		t.Errorf("the second arrival grew the half-life again: %v then %v", first.Stability, again.Stability)
	}
	var logged, tallied int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM item_recalls WHERE client_id = 'a1b2c3'`).Scan(&logged); err != nil || logged != 1 {
		t.Errorf("the answer was logged %d times (%v)", logged, err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(SUM(answered), 0) FROM quiz_sessions WHERE mode = 'practice'`).Scan(&tallied); err != nil || tallied != 1 {
		t.Errorf("practice tallied %d answers for one (%v)", tallied, err)
	}

	// A DIFFERENT ID IS A DIFFERENT ANSWER, and is taken.
	body["client_id"] = "d4e5f6"
	keptAnswer(t, c, body, http.StatusOK)
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(SUM(answered), 0) FROM quiz_sessions WHERE mode = 'practice'`).Scan(&tallied); err != nil || tallied != 2 {
		t.Errorf("a second answer with its own id tallied as %d (%v)", tallied, err)
	}
}

func TestAKeptAnswerCountsOnTheDayItWasGiven(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma")
	ageSeededItems(t, srv)

	ago := 26 * time.Hour
	given := time.Now().UTC().Add(-ago)
	yesterday := given.Format("2006-01-02")
	keptAnswer(t, c, map[string]any{
		"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily", "offset": 0,
		"client_id": "kept-1", "answered_ago_ms": ago.Milliseconds(),
	}, http.StatusOK)

	var day, answeredAt, reviewedAt string
	if err := srv.Store.DB.QueryRow(`SELECT day FROM quiz_sessions WHERE mode = 'daily'`).Scan(&day); err != nil || day != yesterday {
		t.Errorf("the kept answer was tallied on %q, want the day it was given, %q (%v)", day, yesterday, err)
	}
	// Within a few seconds of the moment it was given: the request took a moment.
	near := func(stored string) bool {
		got, err := time.Parse("2006-01-02 15:04:05", stored)
		return err == nil && got.Sub(given).Abs() < 5*time.Second
	}
	if err := srv.Store.DB.QueryRow(`SELECT answered_at FROM item_recalls WHERE client_id = 'kept-1'`).Scan(&answeredAt); err != nil || !near(answeredAt) {
		t.Errorf("the log says it was answered at %q, want about %s (%v)", answeredAt, given.Format("2006-01-02 15:04:05"), err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT last_reviewed_at FROM item_reviews WHERE kind = 'book' AND item_id = ?`, ids[0]).Scan(&reviewedAt); err != nil || !near(reviewedAt) {
		t.Errorf("the schedule was set from %q, want the moment it was given (%v)", reviewedAt, err)
	}
	// AND YESTERDAY IS A DAY ON THE STREAK, which an answer counted on the day it
	// arrived would have taken from yesterday and given to today.
	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily?offset=0", nil, http.StatusOK))
	if deck.Streak != 1 {
		t.Errorf("the streak after an answer kept from yesterday is %d, want 1", deck.Streak)
	}
}

// A KEPT ANSWER OLDER THAN THE CARD'S LAST REVIEW moves nothing: another device's
// later answer already set the schedule, and measuring from this one would run
// the gap backwards. It is still logged and tallied.
func TestAKeptAnswerOlderThanTheLastReviewMovesNothing(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma")
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, http.StatusOK)

	now := keptAnswer(t, c, map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "practice", "client_id": "later"}, http.StatusOK)
	old := keptAnswer(t, c, map[string]any{
		"kind": kindBook, "id": ids[0], "result": "forgot", "mode": "practice",
		"client_id": "earlier", "answered_ago_ms": (2 * time.Hour).Milliseconds(),
	}, http.StatusOK)
	if old.Stability != now.Stability || old.LapseCount != 0 {
		t.Errorf("an answer older than the last review moved the schedule: %+v after %+v", old, now)
	}
	var counted int
	if err := srv.Store.DB.QueryRow(`SELECT counted FROM item_recalls WHERE client_id = 'earlier'`).Scan(&counted); err != nil || counted != 0 {
		t.Errorf("the older answer was logged as counted=%d (%v)", counted, err)
	}
}

func TestAKeptAnswerTooLongAgoOrFromNowhereIsRefused(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Dune", 1)
	base := map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "daily"}
	with := func(k string, v any) map[string]any {
		m := map[string]any{}
		for kk, vv := range base {
			m[kk] = vv
		}
		m[k] = v
		return m
	}
	keptAnswer(t, c, with("answered_ago_ms", -1000), http.StatusBadRequest)
	keptAnswer(t, c, with("answered_ago_ms", (31*24*time.Hour).Milliseconds()), http.StatusBadRequest)
	keptAnswer(t, c, with("answered_ago_ms", "yesterday"), http.StatusBadRequest)
	keptAnswer(t, c, with("client_id", "has spaces"), http.StatusBadRequest)
	keptAnswer(t, c, with("answered_ago_ms", (29*24*time.Hour).Milliseconds()), http.StatusOK)
}

// THE SAME KEPT ANSWER FROM SEVERAL TABS AT ONCE is still one answer. Each tab
// reads the same queue, so each can send its head before any reply lands.
//
// NOT EVERY ARRIVAL IS ANSWERED 200, and the test says so rather than hiding it.
// An arrival that read "not seen" before another tab's answer committed cannot
// then write: SQLite refuses a write on a stale snapshot, the transaction rolls
// back, and the reply is a 5xx. That refusal is what keeps a second copy out, so
// no arrival can get past the "seen" check and commit. The queue treats a 5xx as
// "try again", so what has to hold is that a refused arrival leaves nothing
// behind, and that after the queue's retry exactly one answer was taken.
func TestTheSameKeptAnswerFromSeveralTabsIsOneAnswer(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Dune", 1)
	seedDistractorBook(t, srv, c, "Emma")
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srPracticeCounts": true}, http.StatusOK)

	body := map[string]any{"kind": kindBook, "id": ids[0], "result": "got", "mode": "practice", "client_id": "tabs"}
	codes := make(chan int, 8)
	for range 8 {
		go func() { codes <- c.do("POST", "/review/answer", body).Code }()
	}
	for range 8 {
		if code := <-codes; code != http.StatusOK && code < 500 {
			t.Errorf("an arrival of a kept answer was refused for good, with %d; the queue would drop it", code)
		}
	}
	// The queue's retry of whatever was refused.
	c.mustDo("POST", "/review/answer", body, http.StatusOK)

	var logged, tallied int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM item_recalls WHERE client_id = 'tabs'`).Scan(&logged); err != nil || logged != 1 {
		t.Errorf("nine arrivals of one answer were logged %d times (%v)", logged, err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT COALESCE(SUM(answered), 0) FROM quiz_sessions WHERE mode = 'practice'`).Scan(&tallied); err != nil || tallied != 1 {
		t.Errorf("nine arrivals of one answer tallied %d (%v)", tallied, err)
	}
}
