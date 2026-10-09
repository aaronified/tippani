package httpapi

// A LONG QUOTE IS NOT ASKED ITS WORDS. The owner, 9 October: "there is no point
// testing for exact words (cloze, in either easy or hard modes) in longer quotes.
// this is important only for smaller quotes." Asked where a short quote ends, the
// owner chose "A setting, default 25"; asked what Hard should do with a long quote
// once the blank is gone, "Ask which work".
//
// SETUP KNOWS POST /books (title, author), POST /annotations (book_id, quote),
// PUT /auth/me/preferences (srTier, srQuestions, srTuning) and GET /review/daily,
// and reads each card's id, direction and quote — the fields every deck test in
// this package reads. seedDistractorBook and ageSeededItems are review_test.go's.

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// The two lengths, counted in words: one under the default line and one well
// over it.
const (
	shortLine = "the growing good of the world is partly dependent on unhistoric acts"
	longLine  = "for the growing good of the world is partly dependent on unhistoric acts; and " +
		"that things are not so ill with you and me as they might have been, is half owing to " +
		"the number who lived faithfully a hidden life, and rest in unvisited tombs"
)

func seedLengthBook(t *testing.T, srv *Server, c *testClient) (short, long int64) {
	t.Helper()
	if n := len(clozeTokens(shortLine)); n > clozeMaxQuoteWords || n < clozeMinTokens {
		t.Fatalf("the short line is %d words, which does not sit under the default line", n)
	}
	if n := len(clozeTokens(longLine)); n <= 40 {
		t.Fatalf("the long line is %d words, which is not far enough over the default line", n)
	}
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Middlemarch", "author": "George Eliot"}, http.StatusCreated))
	s := decode[annotationRow](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": shortLine}, http.StatusCreated))
	l := decode[annotationRow](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": longLine}, http.StatusCreated))
	seedDistractorBook(t, srv, c, "Emma")
	ageSeededItems(t, srv)
	return s.ID, l.ID
}

func dailyCard(t *testing.T, c *testClient, id int64) (reviewCard, bool) {
	t.Helper()
	for _, card := range decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).Items {
		if card.Kind == kindBook && card.ID == id {
			return card, true
		}
	}
	return reviewCard{}, false
}

func blank(dir string) bool { return dir == dirCloze || dir == dirClozeMCQ }

// At every tier, the long quote is asked something other than a blank, and the
// short one keeps its blank wherever the tier prefers one (Easy the choice, Hard
// the typed one; Medium's pick is the day's hash, so it is not asserted).
func TestALongQuoteIsNeverAskedItsWords(t *testing.T) {
	for _, tier := range []string{tierEasy, tierMedium, tierHard} {
		srv := newTestServer(t)
		c := signupAdmin(t, srv.Handler())
		short, long := seedLengthBook(t, srv, c)
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{
			"srTier": tier, "srQuestions": `{"daily":["source","quote","cloze","cloze-mcq"]}`}, http.StatusOK)

		card, ok := dailyCard(t, c, long)
		if !ok {
			t.Fatalf("%s: the long quote was left out of the deck", tier)
		}
		if blank(card.Direction) || strings.Contains(card.Quote, clozeBlank) {
			t.Errorf("%s: the long quote was asked its words (%s): %q", tier, card.Direction, card.Quote)
		}
		if tier == tierMedium {
			continue
		}
		if card, ok := dailyCard(t, c, short); !ok || !blank(card.Direction) {
			t.Errorf("%s: the short quote lost its blank: %+v (in deck: %v)", tier, card.Direction, ok)
		}
	}
}

// HARD ASKS WHICH WORK when the blank is gone and its own "who?" cannot be built.
// Hard keeps "who wrote it?" as its first choice; this library has one author, too
// few to choose between, so the card has to come down to "which work?" or "which
// quote?" rather than leaving the round.
func TestHardAsksALongQuoteWhichWork(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, long := seedLengthBook(t, srv, c)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierHard, "srQuestions": `{"daily":["source","quote","cloze","cloze-mcq","author"]}`}, http.StatusOK)

	card, ok := dailyCard(t, c, long)
	if !ok {
		t.Fatal("on Hard the long quote was dropped from the deck instead of being asked which work")
	}
	if card.Direction != dirSource && card.Direction != dirQuote {
		t.Errorf("on Hard the long quote was asked %q, want which work or which quote", card.Direction)
	}
}

// THE LINE IS THE READER'S. Moved past the long quote's length, the long quote is
// a blank again on Hard, whose first choice is the typed one.
func TestTheLengthLineIsTheReaders(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, long := seedLengthBook(t, srv, c)
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierHard, "srQuestions": `{"daily":["source","cloze"]}`,
		"srTuning": `{"clozeMaxWords":80}`}, http.StatusOK)

	card, ok := dailyCard(t, c, long)
	if !ok || card.Direction != dirCloze {
		t.Errorf("with the line at 80 words, the long quote on Hard was asked %q (in deck: %v), want the typed blank",
			card.Direction, ok)
	}
}

// A LINE UNDER SIX WORDS IS NOT A LINE: no quote that short can be blanked at all,
// so the setting would switch the blanks off by itself. It falls back to the
// default, the way every out-of-range tuning number does.
func TestALineTooShortToBlankFallsBackToTheDefault(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srTuning": `{"clozeMaxWords":3}`}, http.StatusOK)
	var me struct {
		Preferences struct {
			SRTuning string `json:"srTuning"`
		} `json:"preferences"`
	}
	if err := json.Unmarshal(c.mustDo("GET", "/auth/me", nil, 200).Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(me.Preferences.SRTuning, `"clozeMaxWords":3`) {
		t.Fatalf("a line of 3 words was kept: %s", me.Preferences.SRTuning)
	}
}

// AND ONLY WHEN THE "WHO?" CANNOT BE BUILT. With enough authors in the library to
// choose between, every long quote on Hard is asked who wrote it: "which work?" is
// the fallback the owner chose, and the day's hash used to pick it first for some
// cards.
func TestHardAsksWhoWroteALongQuoteBeforeWhichWork(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	var long []int64
	for i, author := range []string{"George Eliot", "Jane Austen", "Charlotte Bronte", "Thomas Hardy", "Henry James", "Edith Wharton"} {
		book := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": author + " novel " + string(rune('A'+i)), "author": author}, http.StatusCreated))
		a := decode[annotationRow](t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": book.ID, "quote": longLine}, http.StatusCreated))
		long = append(long, a.ID)
	}
	ageSeededItems(t, srv)
	// PRACTICE, AND SEVERAL ROUNDS OF IT: the daily deck's pick is one hash per
	// card per day, so on a given day it can miss the case altogether; Practice
	// draws afresh each round. Counted, so it is scored and never a flip card.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierHard, "srPracticeCounts": true,
		"srQuestions": `{"practice":["source","quote","cloze","cloze-mcq","author"]}`}, http.StatusOK)
	isLong := map[int64]bool{}
	for _, id := range long {
		isLong[id] = true
	}
	asked := 0
	for round := 0; round < 6; round++ {
		for _, card := range decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200)).Items {
			if card.Kind != kindBook || !isLong[card.ID] {
				continue
			}
			asked++
			if card.Direction != dirAuthor {
				t.Errorf("round %d, card %d: a long quote on Hard with authors to choose from was asked %q, want who wrote it",
					round, card.ID, card.Direction)
			}
		}
	}
	if asked < 12 {
		t.Fatalf("only %d long-quote cards came up in six rounds, which measured almost nothing", asked)
	}
}
