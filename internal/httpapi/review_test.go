package httpapi

// Tests for the §3c spaced-repetition daily review: deck construction (unseen
// pool, due-ness, quota, per-day exclusion), the half-life update rules, the
// timezone-aware local day, ownership isolation, and review-state survival
// across full-state annotation PUTs.

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

type reviewDeck struct {
	Items         []reviewItem `json:"items"`
	ReviewedToday int          `json:"reviewed_today"`
	Quota         int          `json:"quota"`
}

type reviewResp struct {
	OK            bool    `json:"ok"`
	Result        string  `json:"result"`
	Stability     float64 `json:"stability"`
	Mastery       string  `json:"mastery"`
	Remaining     int     `json:"remaining"`
	ReviewedToday int     `json:"reviewed_today"`
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

func TestDailyReviewFlow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Empty pool: an empty deck, not an error.
	deck := decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != 0 || deck.ReviewedToday != 0 || deck.Quota != reviewQuota {
		t.Fatalf("empty pool deck: %+v", deck)
	}

	_, ids := seedReviewBook(t, c, "Dune", 3)

	// Three unseen cards, all in today's deck, soon mastery, book metadata attached.
	deck = decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != 3 {
		t.Fatalf("deck size: %+v", deck)
	}
	for _, it := range deck.Items {
		if it.BookTitle != "Dune" || it.Mastery != "soon" || it.ReviewCount != 0 || it.Quote == "" {
			t.Fatalf("unseen item: %+v", it)
		}
	}

	// got: half-life 1 -> 2.5; the card leaves today's deck.
	res := decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]),
		map[string]any{"result": "got"}, 200))
	if !res.OK || res.Stability != 2.5 || res.Mastery != "soon" || res.Remaining != 2 || res.ReviewedToday != 1 {
		t.Fatalf("got: %+v", res)
	}

	// forgot on a fresh card: floor holds at 1 and the lapse is counted.
	res = decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[1]),
		map[string]any{"result": "forgot"}, 200))
	if res.Stability != 1 || res.Remaining != 1 || res.ReviewedToday != 2 {
		t.Fatalf("forgot: %+v", res)
	}
	var lapses int
	if err := srv.Store.DB.QueryRow(`SELECT lapse_count FROM annotation_reviews WHERE annotation_id = ?`, ids[1]).Scan(&lapses); err != nil || lapses != 1 {
		t.Fatalf("lapse_count %d, %v", lapses, err)
	}

	// skip: benched for the day, stability untouched, no review recorded.
	res = decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[2]),
		map[string]any{"result": "skip"}, 200))
	if res.Stability != 1 || res.Remaining != 0 || res.ReviewedToday != 3 {
		t.Fatalf("skip: %+v", res)
	}
	var reviews int
	var lastReviewed *string
	if err := srv.Store.DB.QueryRow(`SELECT review_count, last_reviewed_at FROM annotation_reviews WHERE annotation_id = ?`, ids[2]).Scan(&reviews, &lastReviewed); err != nil || reviews != 0 || lastReviewed != nil {
		t.Fatalf("skip state: count %d reviewed %v, %v", reviews, lastReviewed, err)
	}

	// Everything touched today: deck empty, tally carried.
	deck = decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != 0 || deck.ReviewedToday != 3 {
		t.Fatalf("deck after answers: %+v", deck)
	}

	// Yesterday's touches don't count against today: bench the skip a day back
	// and it returns (still unseen — the forgot card stays scheduled ~1 day out).
	if _, err := srv.Store.DB.Exec(`UPDATE annotation_reviews
		SET last_touched_at = datetime('now', '-1 day') WHERE annotation_id = ?`, ids[2]); err != nil {
		t.Fatal(err)
	}
	deck = decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != 1 || deck.Items[0].ID != ids[2] || deck.ReviewedToday != 2 {
		t.Fatalf("returned card: %+v", deck)
	}

	// Validation.
	c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]), map[string]any{"result": "aced"}, http.StatusBadRequest)
	c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]), map[string]any{"result": "got", "offset": 2000}, http.StatusBadRequest)
	c.mustDo("GET", "/annotations/daily-review?offset=abc", nil, http.StatusBadRequest)
	c.mustDo("GET", "/annotations/daily-review?offset=900", nil, http.StatusBadRequest)
}

func TestDailyReviewScheduling(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Emma", 3)

	seed := func(id int64, stability float64, reviewedDaysAgo int) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(`
			INSERT INTO annotation_reviews (annotation_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
			VALUES (?, ?, 1, 'got', datetime('now', ?), datetime('now', ?))`,
			id, stability, fmt.Sprintf("-%d days", reviewedDaysAgo), fmt.Sprintf("-%d days", reviewedDaysAgo)); err != nil {
			t.Fatal(err)
		}
	}
	seed(ids[0], 10, 3) // p = 2^(-0.3) ≈ .81 — not due
	seed(ids[1], 2, 3)  // p = 2^(-1.5) ≈ .35 — due
	seed(ids[2], 1, 3)  // p = 2^(-3)   = .125 — the most forgotten

	deck := decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != 2 {
		t.Fatalf("due filter: %+v", deck)
	}
	// Most forgotten first.
	if deck.Items[0].ID != ids[2] || deck.Items[1].ID != ids[1] {
		t.Fatalf("due order: %d, %d (want %d, %d)", deck.Items[0].ID, deck.Items[1].ID, ids[2], ids[1])
	}
	if deck.Items[0].Mastery != "soon" || deck.Items[0].ReviewCount != 1 {
		t.Fatalf("due item state: %+v", deck.Items[0])
	}

	// A late successful recall earns the elapsed-time credit:
	// stability 2, reviewed 3 days ago -> max(2*2.5, ~3*1.2) = 5.
	res := decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[1]),
		map[string]any{"result": "got"}, 200))
	if res.Stability < 4.9 || res.Stability > 5.1 {
		t.Fatalf("regrown stability: %+v", res)
	}

	// A long-stable card that lapses shrinks but keeps a footing:
	// 40 * 0.25 = 10 -> mastery drops someday -> later.
	if _, err := srv.Store.DB.Exec(`UPDATE annotation_reviews
		SET stability = 40, last_reviewed_at = datetime('now', '-50 days'),
		    last_touched_at = datetime('now', '-50 days') WHERE annotation_id = ?`, ids[2]); err != nil {
		t.Fatal(err)
	}
	res = decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[2]),
		map[string]any{"result": "forgot"}, 200))
	if res.Stability != 10 || res.Mastery != "later" {
		t.Fatalf("lapse: %+v", res)
	}
}

func TestDailyReviewQuota(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Middlemarch", reviewQuota+2)

	deck := decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != reviewQuota {
		t.Fatalf("deck capped at quota: got %d", len(deck.Items))
	}
	// The deck order is stable within a day.
	again := decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	for i := range deck.Items {
		if again.Items[i].ID != deck.Items[i].ID {
			t.Fatalf("deck order changed between fetches: %v vs %v", deck.Items[i].ID, again.Items[i].ID)
		}
	}
	// Answer the whole deck; the day is then done even with unseen cards left.
	for i, it := range deck.Items {
		res := decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", it.ID),
			map[string]any{"result": "got"}, 200))
		if res.Remaining != reviewQuota-i-1 {
			t.Fatalf("remaining after %d answers: %+v", i+1, res)
		}
	}
	deck = decode[reviewDeck](t, c.mustDo("GET", "/annotations/daily-review", nil, 200))
	if len(deck.Items) != 0 || deck.ReviewedToday != reviewQuota {
		t.Fatalf("quota spent: %+v", deck)
	}
	_ = ids
}

// The local day follows the client's UTC offset: a card touched at a UTC
// moment that is "midday today" in one longitude is "yesterday evening" in
// another, and only the latter frees the card for a new pass.
func TestDailyReviewTimezone(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Kim", 1)

	// Touch the card 6 hours ago (UTC).
	c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]), map[string]any{"result": "skip"}, 200)
	if _, err := srv.Store.DB.Exec(`UPDATE annotation_reviews
		SET last_touched_at = datetime('now', '-6 hours') WHERE annotation_id = ?`, ids[0]); err != nil {
		t.Fatal(err)
	}

	// Pick offsets so that "6 hours ago" is the same local day for one client
	// and across local midnight for the other, whatever the wall clock now is:
	// local noon (same day) vs local 3am (straddles midnight).
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

	deck := decode[reviewDeck](t, c.mustDo("GET", fmt.Sprintf("/annotations/daily-review?offset=%d", sameDay), nil, 200))
	if len(deck.Items) != 0 || deck.ReviewedToday != 1 {
		t.Fatalf("same local day: %+v", deck)
	}
	deck = decode[reviewDeck](t, c.mustDo("GET", fmt.Sprintf("/annotations/daily-review?offset=%d", straddling), nil, 200))
	if len(deck.Items) != 1 || deck.ReviewedToday != 0 {
		t.Fatalf("across local midnight: %+v", deck)
	}
}

// A stale second device (or a retried POST) answering the same card on the
// same local day must be an idempotent no-op — not a second SM-2 application
// that compounds stability (1→2.5→6.25) and double-counts the tally.
func TestDailyReviewIdempotentSameDay(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 1)

	first := decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]),
		map[string]any{"result": "got"}, 200))
	if first.Stability != 2.5 {
		t.Fatalf("first got: %+v", first)
	}
	again := decode[reviewResp](t, c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]),
		map[string]any{"result": "got"}, 200))
	if again.Stability != 2.5 {
		t.Fatalf("same-day repeat recompounded stability: %+v", again)
	}
	var reviews int
	if err := srv.Store.DB.QueryRow(`SELECT review_count FROM annotation_reviews WHERE annotation_id = ?`, ids[0]).Scan(&reviews); err != nil || reviews != 1 {
		t.Fatalf("review_count double-counted: %d, %v", reviews, err)
	}
}

// GET /annotations?limit=N caps the list (the Home "recently favourited" pair
// only needs two); a bad limit is a 400.
func TestAnnotationListLimit(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_, ids := seedReviewBook(t, c, "Dune", 5)
	_ = ids
	got := decode[annList](t, c.mustDo("GET", "/annotations?limit=2", nil, 200))
	if len(got.Annotations) != 2 {
		t.Fatalf("limit=2 returned %d", len(got.Annotations))
	}
	c.mustDo("GET", "/annotations?limit=0", nil, http.StatusBadRequest)
	c.mustDo("GET", "/annotations?limit=nope", nil, http.StatusBadRequest)
}

func TestDailyReviewOwnershipAndLifecycle(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bob := addUser(t, h, c, "bob")
	_, ids := seedReviewBook(t, c, "Dune", 1)

	// Foreign annotations answer 404 and never enter the deck.
	bob.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]), map[string]any{"result": "got"}, http.StatusNotFound)
	if deck := decode[reviewDeck](t, bob.mustDo("GET", "/annotations/daily-review", nil, 200)); len(deck.Items) != 0 {
		t.Fatalf("bob deck leaked: %+v", deck)
	}

	// A full-state annotation PUT (edit, heart-toggle) must not clobber review
	// state — it lives in its own table.
	c.mustDo("POST", fmt.Sprintf("/annotations/%d/review", ids[0]), map[string]any{"result": "got"}, 200)
	c.mustDo("PUT", fmt.Sprintf("/annotations/%d", ids[0]), map[string]any{
		"quote": "Dune passage 0", "color": "blue", "favorite": true}, 200)
	var stability float64
	if err := srv.Store.DB.QueryRow(`SELECT stability FROM annotation_reviews WHERE annotation_id = ?`, ids[0]).Scan(&stability); err != nil || stability != 2.5 {
		t.Fatalf("review state after PUT: %v, %v", stability, err)
	}

	// Deleting the annotation cascades its review row.
	c.mustDo("DELETE", fmt.Sprintf("/annotations/%d", ids[0]), nil, 200)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM annotation_reviews`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("review rows after annotation delete: %d, %v", n, err)
	}
}
