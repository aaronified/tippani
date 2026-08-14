package httpapi

// What KIND of standalone quote a row is (0035), and the two fields that come
// with it: the language it belongs to and what it says in English.
//
// The board splits three ways — proverbs, speeches, others — and these are the
// tests for the half of that split the server owns. Three things here are rules
// rather than plumbing, and each has its own case:
//
//   - an omitted category is 'other', NOT a 400, so a client that predates 0035
//     goes on saving quotes;
//   - recategorising does not change the dedupe hash, because moving a line from
//     Others to Proverbs is one saved line under a different heading;
//   - the category is on the LIST row, unlike the book credits added in 0034 —
//     the category IS the board, so a client cannot draw the board without it.

import (
	"net/http"
	"testing"
)

// proverb is the fixture the migration's own header uses: a line with no
// speaker, no occasion, no date and no place — the shape that lands in the
// residual bucket of every grouping the old single board offered.
func proverb() map[string]any {
	return map[string]any{
		"quote":       "চোরের মায়ের বড় গলা",
		"category":    "proverb",
		"language":    "Bengali",
		"translation": "The thief's mother has the loudest voice",
	}
}

func TestAQuoteKnowsWhatKindItIs(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, proverb())
	if u.Category != "proverb" || u.Language != "Bengali" {
		t.Fatalf("create did not keep the category: %+v", u)
	}
	if u.Translation != "The thief's mother has the loudest voice" {
		t.Fatalf("translation: %q", u.Translation)
	}
	// A proverb legitimately has none of the occasion fields. Asserted rather
	// than assumed: the review deck reads exactly this to keep proverbs out of
	// the quiz, since there is nothing to recall but the words on the card.
	if u.Speaker != "" || u.Occasion != "" {
		t.Fatalf("a proverb should carry no attribution: %+v", u)
	}

	// THE LIST ROW, not just the single read. 0034's credits are deliberately
	// absent from a list row; these three cannot be, because the client sorts
	// quotes into three boards from this response alone.
	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 {
		t.Fatalf("list: %d", len(list.Utterances))
	}
	if got := list.Utterances[0]; got.Category != "proverb" || got.Language != "Bengali" ||
		got.Translation == "" {
		t.Fatalf("the list row must carry all three — it is what draws the board: %+v", got)
	}

	// PUT is full-state, so a save that carries the three keeps them.
	body := proverb()
	body["language"] = "Bangla"
	up := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(u.ID), body, http.StatusOK))
	if up.Language != "Bangla" || up.Category != "proverb" {
		t.Fatalf("update: %+v", up)
	}
}

// An older client has never heard of 0035 and never sends a category. It must go
// on working, and its quotes must land in the bucket that claims nothing about
// them — which is what the column default says too.
func TestAQuoteWithNoCategoryIsAnOther(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose()) // no category, no language, no translation
	if u.Category != "other" {
		t.Fatalf("an omitted category must default to other, got %q", u.Category)
	}
	if u.Language != "" || u.Translation != "" {
		t.Fatalf("nothing should be invented: %+v", u)
	}
}

func TestAnUnknownCategoryIsRefused(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// 'aphorism' is a perfectly reasonable word and is not one of the three. The
	// CHECK in 0035 would refuse it anyway, as a 500 — this is the 400.
	body := proverb()
	body["category"] = "aphorism"
	c.mustDo("POST", "/quotes", body, http.StatusBadRequest)

	// And on the way in through an edit, not only on create.
	u := newUtterance(t, c, proverb())
	bad := proverb()
	bad["category"] = "APHORISM"
	c.mustDo("PUT", "/quotes/"+itoa(u.ID), bad, http.StatusBadRequest)
}

func TestTheThreeBoardsAreOneFilter(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, proverb())
	hindi := proverb()
	hindi["quote"] = "अब पछताए होत क्या"
	hindi["language"] = "Hindi"
	hindi["translation"] = "What good is regret now"
	newUtterance(t, c, hindi)
	speech := bose()
	speech["category"] = "speech"
	newUtterance(t, c, speech)
	newUtterance(t, c, map[string]any{"quote": "Something a friend said"}) // an 'other'

	for _, tc := range []struct {
		query string
		want  int
	}{
		{"", 4},
		{"?category=proverb", 2},
		{"?category=speech", 1},
		{"?category=other", 1},
		{"?language=Bengali", 1},
		{"?language=Hindi", 1},
		{"?category=proverb&language=Hindi", 1},
		{"?category=speech&language=Hindi", 0}, // the two filters AND, they do not replace
		// A language nobody has typed is an empty board rather than an error:
		// unlike the category, the set of languages is the reader's.
		{"?language=Marathi", 0},
	} {
		got := decode[utterancesResp](t, c.mustDo("GET", "/quotes"+tc.query, nil, http.StatusOK))
		if len(got.Utterances) != tc.want {
			t.Errorf("GET /quotes%s: %d quotes, want %d", tc.query, len(got.Utterances), tc.want)
		}
	}

	// A category outside the three IS a 400, though. An empty board would hide
	// the client bug that asked for it.
	c.mustDo("GET", "/quotes?category=aphorism", nil, http.StatusBadRequest)
}

// RECATEGORISING IS NOT A NEW QUOTE, and this is the decision 0035 turns on.
//
// The dedupe hash covers the words and the occasion, because the same words said
// on two occasions are two quotes. It does NOT cover the category: the occasion
// is part of what the quote IS, while the category is where you have decided to
// file it. So a line moved from Others to Proverbs is still the one row, and
// saving those same words again still collides with it.
func TestRecategorisingIsNotANewQuote(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, map[string]any{"quote": "Still waters run deep"})
	if u.Category != "other" {
		t.Fatalf("setup: %q", u.Category)
	}

	moved := map[string]any{
		"quote":    "Still waters run deep",
		"category": "proverb",
		"language": "English",
	}
	up := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(u.ID), moved, http.StatusOK))
	if up.Category != "proverb" {
		t.Fatalf("the move did not take: %+v", up)
	}
	if up.ID != u.ID {
		t.Fatalf("recategorising must not make a second row: %d then %d", u.ID, up.ID)
	}

	// The words are still spoken for. A 409 here is the hash having stayed put.
	c.mustDo("POST", "/quotes", map[string]any{"quote": "Still waters run deep"}, http.StatusConflict)

	list := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(list.Utterances) != 1 {
		t.Fatalf("one line moved between boards, so there is one row: %d", len(list.Utterances))
	}
}

// Somebody searching a shelf of Bengali proverbs types the ENGLISH, because the
// English is the half they can type. 0035 indexes the translation for exactly
// this.
//
// THE DECOY BOOK IS THE TEST, for the reason TestSearchFindsAQuoteByItsOccasion
// records: a faceted pass that finds nothing falls through to a cross-column
// fallback which matches every indexed column, so without something else in the
// results this would pass even if the quote facet never searched the
// translation at all.
func TestSearchFindsAProverbByItsTranslation(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, proverb())
	c.mustDo("POST", "/books", map[string]any{"title": "The Thief and Other Stories"}, http.StatusCreated)

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=thief", nil, http.StatusOK))
	if len(res.Books) == 0 {
		t.Fatal("the decoy did not match, so the fallback could still be rescuing this")
	}
	if len(res.Quotes) != 1 {
		t.Fatalf("the translation is indexed, so this should find the proverb: %d quotes", len(res.Quotes))
	}
	got := res.Quotes[0]
	if got.Quote != "চোরের মায়ের বড় গলা" {
		t.Fatalf("quote: %q", got.Quote)
	}
	// A HIT IS A LINK, and with three boards it needs to know which one it opens.
	if got.Category != "proverb" || got.Language != "Bengali" {
		t.Fatalf("a hit must say which board it is on: %+v", got)
	}
	if got.Translation == "" {
		t.Fatal("the translation is what matched; a card that cannot show it reads as a wrong result")
	}
}
