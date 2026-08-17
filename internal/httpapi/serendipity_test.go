package httpapi

import (
	"net/http"
	"testing"
	"time"
)

// Shuffle and On this day.
//
// THE ASSERTION THAT MATTERS MOST is the one about item_reviews. These render
// the same quote card the review loop does, and a "seen" bump from idly
// shuffling would quietly lengthen the half-life of whatever the random number
// generator liked — inflating a schedule through a surface meant for enjoying
// the library rather than working at it. Nothing would report it.

type shuffleResp struct {
	Quote *shuffleRow `json:"quote"`
}
type onThisDayResp struct {
	Date   string       `json:"date"`
	Quotes []shuffleRow `json:"quotes"`
}

func TestShuffleReturnsOneQuoteAndTouchesNoSchedule(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "a line worth finding again"}, 201)

	var before int
	_ = srv.Store.DB.QueryRow(`SELECT count(*) FROM item_reviews`).Scan(&before)

	got := decode[shuffleResp](t, c.mustDo("GET", "/shuffle", nil, 200))
	if got.Quote == nil || got.Quote.Quote != "a line worth finding again" {
		t.Fatalf("shuffle = %+v", got.Quote)
	}
	if got.Quote.Kind != "book" || got.Quote.Title != "A Book" {
		t.Errorf("the card needs its parent to be drawable: %+v", got.Quote)
	}

	// Ten more, because one call touching nothing proves less than ten.
	for i := 0; i < 10; i++ {
		c.mustDo("GET", "/shuffle", nil, 200)
	}
	var after int
	_ = srv.Store.DB.QueryRow(`SELECT count(*) FROM item_reviews`).Scan(&after)
	if after != before {
		t.Fatalf("shuffling wrote %d review rows — landing on a quote by chance is not answering a card", after-before)
	}
}

// An empty library is a normal state, not a failure: the screen says so.
func TestShuffleOnAnEmptyLibraryIsNotAnError(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	got := decode[shuffleResp](t, c.mustDo("GET", "/shuffle", nil, 200))
	if got.Quote != nil {
		t.Fatalf("expected nothing, got %+v", got.Quote)
	}
}

// A quote with no words — a book highlight that is only a margin note — is not
// something to shuffle to, because the card would be blank.
func TestShuffleSkipsAQuoteWithNoWords(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "note": "a thought with no quote"}, 201)
	got := decode[shuffleResp](t, c.mustDo("GET", "/shuffle", nil, 200))
	if got.Quote != nil {
		t.Fatalf("a note-only highlight has nothing to show: %+v", got.Quote)
	}
}

func TestShuffleNeverLeavesTheAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	b := idOf(t, admin.mustDo("POST", "/books", map[string]any{"title": "Mine"}, 201).Body.Bytes())
	admin.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "my private line"}, 201)

	for i := 0; i < 10; i++ {
		got := decode[shuffleResp](t, bob.mustDo("GET", "/shuffle", nil, 200))
		if got.Quote != nil {
			t.Fatalf("bob was shown somebody else's quote: %+v", got.Quote)
		}
	}
}

// ON THIS DAY MEANS OTHER YEARS. A card listing what you saved four hours ago
// repeats the screen you just came from.
func TestOnThisDayIsOtherYearsOnly(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())

	// noted_at WINS over created_at, and that is the decision the roadmap entry
	// left open. It matters on every imported row: created_at is the day of the
	// IMPORT, the same day for thousands of quotes, and means nothing to a reader.
	lastYear := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	today := time.Now().Format("2006-01-02")
	old := idOf(t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b, "quote": "a line from a year ago", "noted_at": lastYear,
	}, 201).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b, "quote": "a line from today", "noted_at": today,
	}, 201)

	got := decode[onThisDayResp](t, c.mustDo("GET", "/on-this-day", nil, 200))
	if len(got.Quotes) != 1 || got.Quotes[0].ID != old {
		t.Fatalf("on this day = %+v — want last year's line and not today's", got.Quotes)
	}
}

// A day with nothing on it is empty rather than an error, and empty rather than
// "everything" — the failure a missing WHERE would produce.
func TestOnThisDayIsEmptyWhenNothingMatches(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())
	// A date that is neither today nor this month-day in another year.
	other := time.Now().AddDate(-1, 0, 3).Format("2006-01-02")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b, "quote": "a line from another day", "noted_at": other,
	}, 201)

	got := decode[onThisDayResp](t, c.mustDo("GET", "/on-this-day", nil, 200))
	if len(got.Quotes) != 0 {
		t.Fatalf("on this day = %+v, want nothing", got.Quotes)
	}
}

func TestSerendipityNeedsAuth(t *testing.T) {
	srv := newTestServer(t)
	c := &testClient{t: t, h: srv.Handler()}
	c.mustDo("GET", "/shuffle", nil, http.StatusUnauthorized)
	c.mustDo("GET", "/on-this-day", nil, http.StatusUnauthorized)
}
