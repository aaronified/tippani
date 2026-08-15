package httpapi

// Themed practice: "quiz me on this book / tag / colour / person".
//
// Two claims, and the second is the one that would fail silently. A theme has to
// actually narrow the round — and it must not touch Daily, whose badge and
// status row are drawn by two queries that splice the same eligibility string
// the deck does.

import (
	"net/http"
	"testing"
)

// themedPool asks Practice for a round and reports what came back.
func themedPool(t *testing.T, c *testClient, query string) []reviewCard {
	t.Helper()
	pd := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice"+query, nil, http.StatusOK))
	return pd.Items
}

func TestThemedPracticeNarrowsTheRound(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	austen := createBook(t, c, "Persuasion")
	eliot := createBook(t, c, "Middlemarch")
	c.mustDo("PUT", "/books/"+itoa(austen), map[string]any{"title": "Persuasion", "author": "Jane Austen"}, http.StatusOK)
	c.mustDo("PUT", "/books/"+itoa(eliot), map[string]any{"title": "Middlemarch", "author": "George Eliot"}, http.StatusOK)

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": austen, "quote": "the first Austen line", "color": "blue", "tags": []string{"grief"},
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": austen, "quote": "the second Austen line", "color": "pink",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": eliot, "quote": "the Eliot line", "color": "blue",
	}, http.StatusCreated)
	ageSeededItems(t, srv)

	if n := len(themedPool(t, c, "")); n != 3 {
		t.Fatalf("an unthemed round should hold everything: %d", n)
	}

	// By work.
	byBook := themedPool(t, c, "?book="+itoa(austen))
	if len(byBook) != 2 {
		t.Fatalf("book theme: %d cards, want 2", len(byBook))
	}
	for _, it := range byBook {
		if it.Title != "Persuasion" {
			t.Errorf("book theme let in %q", it.Title)
		}
	}

	// By colour, which every kind of quote has.
	if n := len(themedPool(t, c, "?color=blue")); n != 2 {
		t.Fatalf("colour theme: %d cards, want 2", n)
	}

	// By tag.
	if n := len(themedPool(t, c, "?tag=grief")); n != 1 {
		t.Fatalf("tag theme: %d cards, want 1", n)
	}

	// By person — an author here, matched case-insensitively and by part.
	if n := len(themedPool(t, c, "?person=austen")); n != 2 {
		t.Fatalf("person theme: %d cards, want 2", n)
	}

	// Themes compose.
	if n := len(themedPool(t, c, "?book="+itoa(austen)+"&color=pink")); n != 1 {
		t.Fatalf("book+colour: %d cards, want 1", n)
	}

	// A theme nothing matches is an empty round, not a full one — which is the
	// failure an ignored clause produces.
	if n := len(themedPool(t, c, "?tag=nothing-has-this")); n != 0 {
		t.Fatalf("an unmatched theme served %d cards", n)
	}
}

// "Quiz me on this book" must return NO film lines, not all of them. A kind the
// theme cannot apply to is dropped rather than left unfiltered.
func TestAWorkThemeExcludesTheOtherKinds(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "a highlight"}, http.StatusCreated)
	movie := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Heat"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie, "quote": "a film line"}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{"quote": "a standalone line", "speaker": "Someone"}, http.StatusCreated)
	ageSeededItems(t, srv)

	for _, it := range themedPool(t, c, "?book="+itoa(book)) {
		if it.Kind != kindBook {
			t.Errorf("a book theme served a %s card: %+v", it.Kind, it)
		}
	}
	for _, it := range themedPool(t, c, "?movie="+itoa(movie)) {
		if it.Kind != kindScreen {
			t.Errorf("a film theme served a %s card: %+v", it.Kind, it)
		}
	}
}

// THE CONSTRAINT THAT WOULD FAIL IN SILENCE. Five queries splice
// reviewSource.where(), and two of them are Daily's own — dailyRemaining draws
// the badge, reviewStates draws "where you stand". A theme spliced there would
// narrow both, so opening a themed round would change how many cards the app
// said were due today.
func TestDailyIgnoresATheme(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	austen := createBook(t, c, "Persuasion")
	eliot := createBook(t, c, "Middlemarch")
	for i := 0; i < 2; i++ {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": austen, "quote": "austen line " + itoa(int64(i))}, http.StatusCreated)
		c.mustDo("POST", "/annotations", map[string]any{"book_id": eliot, "quote": "eliot line " + itoa(int64(i))}, http.StatusCreated)
	}
	ageSeededItems(t, srv)

	plain := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK))
	themed := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily?book="+itoa(austen)+"&color=blue", nil, http.StatusOK))

	if len(themed.Items) != len(plain.Items) {
		t.Fatalf("a theme changed the daily deck: %d cards vs %d", len(themed.Items), len(plain.Items))
	}
	// The counts beside it, which are the half that would break quietly.
	if themed.States.Total != plain.States.Total {
		t.Fatalf("a theme changed the status counts: %+v vs %+v", themed.States, plain.States)
	}
	// And the deck still holds both books, because it was never filtered.
	seen := map[string]bool{}
	for _, it := range themed.Items {
		seen[it.Title] = true
	}
	if !seen["Persuasion"] || !seen["Middlemarch"] {
		t.Fatalf("the daily deck was narrowed after all: %+v", seen)
	}
}
