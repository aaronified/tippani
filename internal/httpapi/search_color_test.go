package httpapi

// A quote keeps its colour when you search for it.
//
// Colour is not decoration here. Since 1.7.1 the six slots are CATEGORIES the
// reader names — doubt, joy, to-check — so a quote's colour is a field of the
// record in the same way its tags are. Every other surface carried it: the
// Library, a work's page, Home's favourites, the export, the share card.
//
// Search did not, and only for the two kinds that have a parent. `utteranceHit`
// selected `u.color` and had a Color field; `annotationHit` and `dialogueHit`
// had neither the column nor the field, so every book annotation and every film
// line came back with an empty colour. A library sorted into six named
// categories looked uncategorised the moment it was searched, and the share
// sheet opened from a result silently dropped the category line.
//
// The test asserts VALUES for all three kinds together, because the bug was
// exactly that two of the three disagreed with the other one, and a test for
// one kind would have gone on passing.

import (
	"net/http"
	"testing"
)

func TestSearchCarriesTheQuoteColour(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Dispossessed", "author": "Ursula K. Le Guin",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "You cannot buy the revolution.", "color": "green",
	}, http.StatusCreated)

	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Stalker", "director": "Andrei Tarkovsky", "release_year": 1979,
	}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Let everything that has been planned come true.",
		"character": "Stalker", "color": "purple",
	}, http.StatusCreated)

	newUtterance(t, c, map[string]any{
		"quote": "The revolution is not a dinner party.", "speaker": "Mao Zedong", "color": "pink",
	})

	// One query that reaches all three kinds at once, so a colour that goes
	// missing on only one of them cannot hide behind the other two.
	res := decode[searchResults](t, c.mustDo("GET", "/search?q=revolution", nil, http.StatusOK))

	if len(res.Annotations) != 1 {
		t.Fatalf("expected one annotation, got %d", len(res.Annotations))
	}
	if got := res.Annotations[0].Color; got != "green" {
		t.Errorf("annotation colour: got %q, want %q", got, "green")
	}
	if len(res.Quotes) != 1 {
		t.Fatalf("expected one quote, got %d", len(res.Quotes))
	}
	if got := res.Quotes[0].Color; got != "pink" {
		t.Errorf("quote colour: got %q, want %q", got, "pink")
	}

	// The dialogue's words do not contain "revolution", so it is fetched by its
	// own query rather than riding along on this one.
	res = decode[searchResults](t, c.mustDo("GET", "/search?q=planned", nil, http.StatusOK))
	if len(res.Dialogues) != 1 {
		t.Fatalf("expected one dialogue, got %d", len(res.Dialogues))
	}
	if got := res.Dialogues[0].Color; got != "purple" {
		t.Errorf("dialogue colour: got %q, want %q", got, "purple")
	}
}

// An uncoloured quote reports the storage default rather than an empty string.
//
// This is the half that decides what the client may do with the value. `color`
// is `TEXT NOT NULL DEFAULT 'yellow'` on all three tables, so "no colour" is
// not representable in storage — every row has one. The client therefore knows
// that an empty string means the SERVER failed to send a colour, not that the
// reader declined to choose one, and it can draw the plain border for it
// instead of asserting slot 1, which is a category somebody may have named.
func TestSearchReportsTheDefaultColourNotAnEmptyOne(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Meditations", "author": "Marcus Aurelius",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Waste no more time arguing what a good man should be.",
	}, http.StatusCreated)

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=arguing", nil, http.StatusOK))
	if len(res.Annotations) != 1 {
		t.Fatalf("expected one annotation, got %d", len(res.Annotations))
	}
	if got := res.Annotations[0].Color; got != "yellow" {
		t.Errorf("default colour: got %q, want %q", got, "yellow")
	}
}
