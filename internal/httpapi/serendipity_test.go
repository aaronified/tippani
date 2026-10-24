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

func TestSerendipityNeedsAuth(t *testing.T) {
	srv := newTestServer(t)
	c := &testClient{t: t, h: srv.Handler()}
	c.mustDo("GET", "/shuffle", nil, http.StatusUnauthorized)
	c.mustDo("GET", "/on-this-day", nil, http.StatusUnauthorized)
}

// The card these draw is meant to look like a favourite tile — cover, faces,
// tags, a heart — and every one of those is a field on the row. It is a shape
// test because the failure it guards against is silent: a card whose poster is
// always missing looks like a library with no posters.
func TestAShuffledQuoteCarriesWhatTheCardDraws(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// A film line, because it is the kind with the most to carry: a poster, a
	// media type, a character AND an actor, which are two different people.
	m := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca", "media_type": "movie", "release_year": 1942}, 201).Body.Bytes())
	if _, err := srv.Store.DB.Exec(`UPDATE movies SET poster_path = ? WHERE id = ?`, "covers/casablanca.jpg", m); err != nil {
		t.Fatalf("poster: %v", err)
	}
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": m, "quote": "Here's looking at you, kid.",
		"character": "Rick Blaine", "actor": "Humphrey Bogart",
		"color": "blue", "favorite": true, "tags": []string{"noir", "goodbye"},
	}, 201)

	got := decode[shuffleResp](t, c.mustDo("GET", "/shuffle", nil, 200))
	q := got.Quote
	if q == nil {
		t.Fatal("no quote")
	}
	// Values, not counts: "got 5 fields" passes happily while they are the wrong five.
	if q.CoverPath != "covers/casablanca.jpg" {
		t.Errorf("cover_path = %q, want the film's poster", q.CoverPath)
	}
	if q.MediaType != "movie" {
		t.Errorf("media_type = %q, want movie", q.MediaType)
	}
	// The year is what lets the card say "Casablanca (1942)" and the share picture
	// say the same — it is the one field the full-row fetch cannot supply, because
	// a dialogue row carries no parent at all.
	if q.Year != 1942 {
		t.Errorf("year = %d, want 1942", q.Year)
	}
	// The distinction the old row could not make: Credit is who ACTED, Character
	// is who SPOKE, and a card that names only the actor is naming the wrong person.
	if q.Character != "Rick Blaine" || q.Credit != "Humphrey Bogart" {
		t.Errorf("character/credit = %q/%q, want Rick Blaine/Humphrey Bogart", q.Character, q.Credit)
	}
	if !q.Favourite {
		t.Error("favorite = false, so the heart on the card would start empty on a quote you had hearted")
	}
	if len(q.Tags) != 2 || q.Tags[0] != "goodbye" || q.Tags[1] != "noir" {
		t.Errorf("tags = %v, want [goodbye noir] — alphabetical, as every other list is", q.Tags)
	}
	if q.Colour != "blue" {
		t.Errorf("color = %q, want blue", q.Colour)
	}
}
