package httpapi

import (
	"net/http"
	"testing"
)

// The timeline: when the library's works are FROM.
//
// The activity calendar already answers "when was I reading". This answers "how
// old is what I read", which in a library assembled around old books is a
// different and more interesting shape — and one nothing in the app could show,
// despite every book and film having carried a year since 0001 and 0003.
//
// A quote is dated by its WORK, not by when it was saved. A line copied out of
// the Analects last Tuesday belongs at 479 BCE, not at last Tuesday.

type tlBucket struct {
	Year   int `json:"year"`
	Works  int `json:"works"`
	Quotes int `json:"quotes"`
}

func timelineOf(t *testing.T, c *testClient) map[int]tlBucket {
	t.Helper()
	got := decode[struct {
		Timeline []tlBucket `json:"timeline"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	out := map[int]tlBucket{}
	for _, b := range got.Timeline {
		out[b.Year] = b
	}
	return out
}

func TestTheTimelineDatesAQuoteByItsWork(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// An ancient book with two quotes, and a modern film with one.
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Analects", "published_year": -479, "published_circa": true,
	}, http.StatusCreated))
	for _, q := range []string{"A line", "Another line"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": q}, http.StatusCreated)
	}
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Unforgiven", "release_year": 1992,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "A line from the film",
	}, http.StatusCreated)

	tl := timelineOf(t, c)
	if b := tl[-479]; b.Works != 1 || b.Quotes != 2 {
		t.Errorf("479 BCE: works=%d quotes=%d, want 1/2", b.Works, b.Quotes)
	}
	if b := tl[1992]; b.Works != 1 || b.Quotes != 1 {
		t.Errorf("1992: works=%d quotes=%d, want 1/1", b.Works, b.Quotes)
	}
	// circa never moves anything. It is how a year is written, not which year it
	// is; a "c." that shifted a bucket would put the timeline and the shelf into
	// disagreement about the same book.
	if _, ok := tl[-478]; ok {
		t.Error("an estimate moved the work off its own year")
	}
}

func TestTheTimelineOrdersBCEBeforeCE(t *testing.T) {
	// The whole reason the year columns are INTEGER rather than the partial-date
	// TEXT used elsewhere: -479 must sort before 1992 arithmetically. As text it
	// would not.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	for _, y := range []int{1992, -479, 180, -2100} {
		c.mustDo("POST", "/books", map[string]any{"title": "B", "published_year": y}, http.StatusCreated)
	}
	got := decode[struct {
		Timeline []tlBucket `json:"timeline"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	want := []int{-2100, -479, 180, 1992}
	if len(got.Timeline) != len(want) {
		t.Fatalf("got %d buckets, want %d", len(got.Timeline), len(want))
	}
	for i, y := range want {
		if got.Timeline[i].Year != y {
			t.Fatalf("bucket %d = %d, want %d (order: %+v)", i, got.Timeline[i].Year, y, got.Timeline)
		}
	}
}

func TestAWorkWithNoYearIsAbsentRatherThanZero(t *testing.T) {
	// 0 means "not recorded". A bucket at year 0 would sit between 1 BCE and 1 CE
	// and read as a point in time, which it is not — it is a gap in the
	// catalogue, and the timeline is not the place to report it.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Undated",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "A line"}, http.StatusCreated)

	if b, ok := timelineOf(t, c)[0]; ok {
		t.Errorf("a work with no year produced a year-0 bucket: %+v", b)
	}
}

func TestAStandaloneQuoteIsDatedByItsOccasion(t *testing.T) {
	// occasion_date is the only date an utterance carries that is about the
	// quote rather than about the saving of it. It is a partial date in TEXT, so
	// the year comes off the front.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, map[string]any{
		"quote": "Give me blood", "speaker": "Bose", "occasion": "A rally", "occasion_date": "1944-07-04",
	})
	newUtterance(t, c, map[string]any{
		"quote": "Year only", "speaker": "Bose", "occasion": "Broadcast", "occasion_date": "1943",
	})
	// No occasion date at all: nothing to place it with.
	newUtterance(t, c, map[string]any{"quote": "Undated", "speaker": "Bose"})

	tl := timelineOf(t, c)
	if b := tl[1944]; b.Quotes != 1 {
		t.Errorf("1944: quotes=%d, want 1", b.Quotes)
	}
	if b := tl[1943]; b.Quotes != 1 {
		t.Errorf("1943: quotes=%d, want 1", b.Quotes)
	}
	if len(tl) != 2 {
		t.Errorf("buckets = %+v, want only the two dated occasions", tl)
	}
}

func TestTheTimelineIsPerUser(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	alice.mustDo("POST", "/books", map[string]any{"title": "Hers", "published_year": 1974}, http.StatusCreated)
	if tl := timelineOf(t, bob); len(tl) != 0 {
		t.Fatalf("alice's shelf reached bob's timeline: %+v", tl)
	}
}

// The person whose quotes you have hearted most.
func TestTheMostFavouritedPerson(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Good Omens", "author": "Neil Gaiman & Terry Pratchett",
	}, http.StatusCreated))
	// Two hearted quotes on a two-author book: both authors get two each.
	for _, q := range []string{"One", "Two"} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": book.ID, "quote": q, "favorite": true,
		}, http.StatusCreated)
	}
	// One un-hearted quote, which must not count.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Three",
	}, http.StatusCreated)

	// A film where the same person directs and stars, with three hearted lines.
	// Counting both credits would give Eastwood 3 + 3 and hand him the tile.
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Unforgiven", "director": "Clint Eastwood",
	}, http.StatusCreated))
	for _, q := range []string{"A", "B", "C"} {
		c.mustDo("POST", "/dialogues", map[string]any{
			"movie_id": film.ID, "quote": q, "actor": "Clint Eastwood", "favorite": true,
		}, http.StatusCreated)
	}

	got := decode[struct {
		FavouritePerson *struct {
			Title string `json:"title"`
			Count int    `json:"count"`
		} `json:"favourite_person"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	if got.FavouritePerson == nil {
		t.Fatal("no favourite person")
	}
	if got.FavouritePerson.Title != "Clint Eastwood" || got.FavouritePerson.Count != 3 {
		t.Fatalf("favourite person = %+v, want Clint Eastwood with 3 (not 6)", *got.FavouritePerson)
	}
}

func TestNoFavouritesMeansNoFavouritePerson(t *testing.T) {
	// A tile with a name and a zero on it is worse than no tile.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "B", "author": "A Writer",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": "A line"}, http.StatusCreated)

	got := decode[struct {
		FavouritePerson *struct{} `json:"favourite_person"`
	}](t, c.mustDo("GET", "/stats", nil, http.StatusOK))
	if got.FavouritePerson != nil {
		t.Error("a library with no favourites named a favourite person")
	}
}
