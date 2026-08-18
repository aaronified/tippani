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

// TestAnAnthologyThemeDrawsOnlyItsEntries — the sixth theme, and the first that is
// a JOIN rather than a predicate on a column.
//
// The five before it ask "does this row look like that?" and can be got right by
// spelling one column name. This one asks "is this row in that list?", across three
// tables, and there are two ways for it to be quietly wrong: matching too much (a
// missing kind clause, so an entry files every kind at that id) and matching too
// little (a kind spelled with the wrong vocabulary, so the arm returns nothing and
// the anthology looks empty). Both are asserted, per kind.
func TestAnAnthologyThemeDrawsOnlyItsEntries(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// One quote of each kind IN the anthology, and one of each kind outside it, so
	// "only its entries" is a claim about every arm of the union rather than about
	// the one kind a single-quote test would happen to exercise.
	book := createBook(t, c, "Invisible Cities")
	inBook := decode[annotationRow](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "the highlight in the anthology"}, http.StatusCreated))
	c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "the highlight left out of it"}, http.StatusCreated)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated))
	inScreen := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "the line in the anthology", "character": "Stalker",
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "the line left out of it", "character": "Writer",
	}, http.StatusCreated)

	inUtt := newUtterance(t, c, bose())
	other := bose()
	other["quote"] = "a different speech entirely"
	newUtterance(t, c, other)

	a := decode[anthologyRow](t, c.mustDo("POST", "/anthologies",
		map[string]any{"title": "Three in, three out"}, http.StatusCreated))
	c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/entries", map[string]any{"items": []map[string]any{
		{"kind": "book", "item_id": inBook.ID},
		{"kind": "screen", "item_id": inScreen.ID},
		{"kind": "utterance", "item_id": inUtt.ID},
	}}, http.StatusOK)

	got := themedPool(t, c, "?anthology="+itoa(a.ID))
	kinds := map[string]int{}
	for _, card := range got {
		kinds[card.Kind]++
		switch card.Kind {
		case kindBook:
			if card.ID != inBook.ID {
				t.Errorf("a highlight outside the anthology was drawn: %d", card.ID)
			}
		case kindScreen:
			if card.ID != inScreen.ID {
				t.Errorf("a film line outside the anthology was drawn: %d", card.ID)
			}
		case kindUtterance:
			if card.ID != inUtt.ID {
				t.Errorf("a standalone quote outside the anthology was drawn: %d", card.ID)
			}
		}
	}
	// ALL THREE ARMS, named individually: a missing kind is the failure that reads
	// as "the anthology is short" rather than as a bug, and a count-only assertion
	// would pass with three cards of one kind.
	for _, k := range []string{kindBook, kindScreen, kindUtterance} {
		if kinds[k] != 1 {
			t.Errorf("the themed round drew %d %s cards, want exactly 1", kinds[k], k)
		}
	}
	if len(got) != 3 {
		t.Fatalf("the themed round drew %d cards, want 3", len(got))
	}

	// A theme naming an anthology that is not the caller's is a 404 rather than an
	// empty round: the clause already matches nothing, but "no cards" and "not
	// yours" look identical on screen and only the first is fixable by the reader.
	bob := addUser(t, h, c, "bob")
	bob.mustDo("GET", "/review/practice?anthology="+itoa(a.ID), nil, http.StatusNotFound)
}

// TestDailyIgnoresAnAnthologyTheme is the same assertion TestDailyIgnoresATheme
// makes, for the theme that arrived after it.
//
// Its own file's header is emphatic about where a theme clause may go, and the
// reason is exactly this: dailyRemaining draws the badge and reviewStates draws the
// status row, and a theme spliced into either would change the number of cards the
// app says are due today. The anthology clause is the first one that joins another
// table, so it is the first that could have been put somewhere convenient.
func TestDailyIgnoresAnAnthologyTheme(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Invisible Cities")
	var inIt int64
	for i := 0; i < 4; i++ {
		row := decode[annotationRow](t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book, "quote": "line " + itoa(int64(i))}, http.StatusCreated))
		if i == 0 {
			inIt = row.ID
		}
	}
	ageSeededItems(t, srv)

	a := decode[anthologyRow](t, c.mustDo("POST", "/anthologies",
		map[string]any{"title": "One of four"}, http.StatusCreated))
	c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/entries",
		map[string]any{"items": []map[string]any{{"kind": "book", "item_id": inIt}}}, http.StatusOK)

	plain := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, http.StatusOK))
	themed := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily?anthology="+itoa(a.ID), nil, http.StatusOK))

	if len(themed.Items) != len(plain.Items) {
		t.Fatalf("an anthology theme changed the daily deck: %d cards vs %d", len(themed.Items), len(plain.Items))
	}
	if themed.States.Total != plain.States.Total {
		t.Fatalf("an anthology theme changed the status counts: %+v vs %+v", themed.States, plain.States)
	}
	// The specific thing the header warns about: the badge, which is a separate
	// query (dailyRemaining) from the deck and is the one a theme could narrow
	// without anybody noticing until the number stopped matching the cards.
	badge := func(query string) int {
		t.Helper()
		var out struct {
			Remaining int `json:"remaining"`
		}
		out = decode[struct {
			Remaining int `json:"remaining"`
		}](t, c.mustDo("GET", "/review/scores"+query, nil, http.StatusOK))
		return out.Remaining
	}
	if b, p := badge("?anthology="+itoa(a.ID)), badge(""); b != p {
		t.Fatalf("an anthology theme changed the badge: %d vs %d", b, p)
	}
}
