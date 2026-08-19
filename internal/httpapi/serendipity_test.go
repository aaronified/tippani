package httpapi

import (
	"net/http"
	"strings"
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

// Tags come back as [] rather than null, which is what lets a card map over them
// without checking first. The same rule every list response in the app follows.
func TestAnUntaggedShuffledQuoteHasAnEmptyTagListAndNotNull(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b, "quote": "untagged"}, 201)

	res := c.mustDo("GET", "/shuffle", nil, 200)
	if body := res.Body.String(); !strings.Contains(body, `"tags":[]`) {
		t.Errorf("want \"tags\":[] in the response, got %s", body)
	}
	got := decode[shuffleResp](t, c.mustDo("GET", "/shuffle", nil, 200))
	if got.Quote.Tags == nil {
		t.Error("tags is nil — a card mapping over it would have to check first")
	}
	// A book has no character and no poster of its own kind's making; both are
	// empty rather than absent, and the badge says which kind it is.
	if got.Quote.MediaType != "book" || got.Quote.Character != "" {
		t.Errorf("media_type/character = %q/%q, want book/empty", got.Quote.MediaType, got.Quote.Character)
	}
}

// The shuffle row reads its tags with a group_concat rather than through the
// annotation fetcher, so the two could drift. This pins them together on the
// input most likely to separate them: a submitted tag with a comma in it, which
// cleanNames() splits into two before it is ever stored.
//
// The first version of this test asserted the opposite — that "sci-fi, fantasy"
// stayed one tag — on the assumption that a comma is legal in a tag name. It is
// not: the vocabulary treats a comma as a separator on the way in. Whatever the
// canonical list endpoint says a quote's tags are, this must say the same.
func TestAShuffledQuoteAgreesWithTheListEndpointAboutItsTags(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	b := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, 201).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": b, "quote": "one line", "tags": []string{"sci-fi, fantasy", "Kept"},
	}, 201)

	listed := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(b), nil, 200))
	if len(listed.Annotations) != 1 {
		t.Fatalf("want one annotation, got %d", len(listed.Annotations))
	}
	want := listed.Annotations[0].Tags

	got := decode[shuffleResp](t, c.mustDo("GET", "/shuffle", nil, 200))
	if strings.Join(got.Quote.Tags, "|") != strings.Join(want, "|") {
		t.Errorf("shuffle tags = %v, /annotations says %v", got.Quote.Tags, want)
	}
	// And the comma really did split, so this test is measuring the case it claims.
	if len(want) != 3 {
		t.Errorf("expected the comma to split into three tags, got %v", want)
	}
}
