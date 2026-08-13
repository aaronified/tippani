package httpapi

import (
	"net/http"
	"testing"
)

// Not this one. A quote you keep, and never want to be asked about.
//
// The rule is one string — reviewSource.where() — and that is exactly why it is
// worth testing from the outside. FIVE queries splice that string: the three
// candidate fetches, the count behind the "cards left" badge, and the status
// breakdown behind "where you stand". A filter that reached four of them would
// produce a badge counting a card the deck will never serve, which reads as the
// quiz being broken rather than as a filter being inconsistent — so every
// assertion here goes through the API and checks the COUNT the reader sees, not
// the column.
//
// The other half is the work-level flag, and it exists because "this book is not
// for quizzing" is a fact about the book: exclude a reference manual and the
// highlight added to it tomorrow has to be excluded too, or the exclusion is a
// chore you have to repeat.

// reviewTotal is how many quotes the app believes are in the deck's reach. It
// comes from reviewStates, which is the same `where()` the deck itself uses.
func reviewTotal(t *testing.T, c *testClient) int {
	t.Helper()
	return decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).States.Total
}

func TestExcludingQuotesFromReview(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Dispossessed")
	var ann []int64
	for _, q := range []string{"the wall was inside", "a shipment of ideas", "you cannot buy the revolution"} {
		ann = append(ann, idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": bookID, "quote": q}, http.StatusCreated).Body.Bytes()))
	}
	if got := reviewTotal(t, c); got != 3 {
		t.Fatalf("before: %d quotes in reach, want 3", got)
	}

	// Exclude one.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ann[:1], "review": false}, 200)
	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("after excluding one: %d in reach, want 2", got)
	}

	// The row says so, which is what lets the bar offer the right word rather
	// than always offering "Exclude" over a selection that already is.
	rows := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	for _, a := range rows {
		want := a.ID == ann[0]
		if a.ReviewExcluded != want {
			t.Errorf("annotation %d: review_excluded = %v, want %v", a.ID, a.ReviewExcluded, want)
		}
	}

	// And back in again. An exclusion that cannot be undone is a delete with
	// extra steps.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ann[:1], "review": true}, 200)
	if got := reviewTotal(t, c); got != 3 {
		t.Fatalf("after including it again: %d in reach, want 3", got)
	}
}

func TestExcludingAQuoteDoesNotInventReviewHistory(t *testing.T) {
	// THE REASON THIS IS A COLUMN ON THE ROW AND NOT A FLAG ON item_reviews.
	//
	// The schedule table has NO ROW for a quote that has never been reviewed, so
	// storing the exclusion there would mean INSERTing one — and four separate
	// queries read "a row exists" as "this card has been seen". Excluding a quote
	// and putting it back would silently promote it from never-seen to
	// seen-and-overdue: a lie about the reader's own history, told by a
	// preference they set for an unrelated reason.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "A Wizard of Earthsea")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "to hear, one must be silent"}, http.StatusCreated).Body.Bytes())

	before := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).States
	if before.Total != 1 {
		t.Fatalf("the one highlight should be in reach: %+v", before)
	}
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{id}, "review": false}, 200)
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{id}, "review": true}, 200)

	after := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).States
	if after != before {
		t.Errorf("a round trip through excluded changed the reader's history:\n before %+v\n after  %+v", before, after)
	}
}

func TestExcludingAWorkCoversTheQuotesAddedAfterwards(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Chicago Manual of Style")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": "see 6.19"}, http.StatusCreated)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("before: %d, want 1", got)
	}

	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": false}, 200)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("after excluding the book: %d, want 0", got)
	}

	// The whole point of the work-level flag: this one was saved AFTER the
	// exclusion, and nobody is going to remember to exclude it too.
	c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": "see 6.20"}, http.StatusCreated)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("a highlight added to an excluded book is in the deck: %d, want 0", got)
	}

	// And the book row reports it.
	books := decode[struct {
		Books []struct {
			ID             int64 `json:"id"`
			ReviewExcluded bool  `json:"review_excluded"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200)).Books
	if len(books) != 1 || !books[0].ReviewExcluded {
		t.Errorf("books = %+v, want one excluded", books)
	}

	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": true}, 200)
	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("after including the book: %d, want 2", got)
	}
}

func TestExcludingAFilmAndAStandaloneQuote(t *testing.T) {
	// The other two kinds. A dialogue is a child row like an annotation; a
	// standalone quote has no parent at all, so it carries only its own flag —
	// the same asymmetry every other part of the standalone-quote work has.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movieID, "quote": "here's looking at you, kid"}, http.StatusCreated)
	qid := idOf(t, c.mustDo("POST", "/quotes",
		map[string]any{"quote": "at the stroke of midnight", "speaker": "Jawaharlal Nehru"}, http.StatusCreated).Body.Bytes())

	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("before: %d, want 2", got)
	}
	c.mustDo("POST", "/movies/bulk", map[string]any{"ids": []int64{movieID}, "review": false}, 200)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("after excluding the film: %d, want 1", got)
	}
	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": []int64{qid}, "review": false}, 200)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("after excluding the standalone quote: %d, want 0", got)
	}
}

func TestExcludedQuotesLeaveTheDailyDeckItself(t *testing.T) {
	// The count and the deck are two different queries over one `where()`. This
	// is the one that would catch a rule added to reviewStates and forgotten in
	// the candidate fetches — a "where you stand" that says nothing is left while
	// the quiz keeps asking.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "Ficciones")
	for _, q := range []string{"the garden of forking paths", "a labyrinth of symbols",
		"time forks perpetually", "the book of sand", "mirrors and fatherhood"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": q}, http.StatusCreated)
	}
	ann := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	ids := make([]int64, 0, len(ann))
	for _, a := range ann {
		ids = append(ids, a.ID)
	}

	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ids, "review": false}, 200)

	// Practice draws the WHOLE in-scope pool with no due or age gate, so an empty
	// one here is the deck agreeing with the count.
	pool := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if len(pool.Items) != 0 {
		t.Errorf("practice served %d cards from a wholly excluded library", len(pool.Items))
	}
	daily := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(daily.Items) != 0 {
		t.Errorf("the daily deck served %d cards from a wholly excluded library", len(daily.Items))
	}
}

func TestReviewExclusionIsPerAccount(t *testing.T) {
	// The ownership filter, in both directions. One that matches nothing is a
	// bulk action reporting success and doing nothing; one that matches
	// everything is somebody else's library.
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	aBook := createBook(t, alice, "Alice's book")
	aAnn := idOf(t, alice.mustDo("POST", "/annotations",
		map[string]any{"book_id": aBook, "quote": "alice's highlight"}, http.StatusCreated).Body.Bytes())

	// Bob cannot exclude Alice's highlight, and gets the same 404 a missing id
	// gets — never a 403, which would confirm the id exists.
	bob.mustDo("POST", "/annotations/bulk",
		map[string]any{"ids": []int64{aAnn}, "review": false}, http.StatusNotFound)
	if got := reviewTotal(t, alice); got != 1 {
		t.Fatalf("Alice's deck changed from Bob's call: %d, want 1", got)
	}
	// And Alice can.
	alice.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{aAnn}, "review": false}, 200)
	if got := reviewTotal(t, alice); got != 0 {
		t.Fatalf("Alice could not exclude her own highlight: %d, want 0", got)
	}
}
