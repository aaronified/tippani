package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
)

// CHARACTERS ARE THEIR OWN BREAKDOWN, not a relabelled actor list (2.2.0).
//
// The two are not derivable from each other, and the case that settles it is a
// BOOK: a book quote carries a character and no actor at all (0047), so a merged
// list would leave every book quote out of the only section it belongs in. This
// asserts both halves — a film line lands in both lists under different names, and
// a book line lands in characters only.
func TestStatsListsCharactersSeparatelyFromActors(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "Casablanca", "Michael Curtiz")
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Here's looking at you, kid.",
		"character": "Rick Blaine", "actor": "Humphrey Bogart",
	}, http.StatusCreated)

	book := decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Fear is the mind-killer.", "character": "Paul Atreides",
	}, http.StatusCreated)

	// The breakdown rides inside GET /stats rather than a route of its own.
	res := c.mustDo("GET", "/stats", nil, http.StatusOK)
	var body struct {
		Breakdown map[string]struct {
			Top []struct {
				Name   string `json:"name"`
				Quotes int    `json:"quotes"`
			} `json:"top"`
		} `json:"breakdown"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	out := body.Breakdown

	names := func(section string) map[string]int {
		m := map[string]int{}
		for _, r := range out[section].Top {
			m[r.Name] = r.Quotes
		}
		return m
	}
	actors, characters := names("actors"), names("characters")

	if _, ok := out["characters"]; !ok {
		t.Fatal("no characters section in the breakdown")
	}
	if characters["Rick Blaine"] == 0 {
		t.Errorf("the film's character is missing from characters: %v", characters)
	}
	if actors["Humphrey Bogart"] == 0 {
		t.Errorf("the actor is missing from actors: %v", actors)
	}
	// The lists must not bleed into each other.
	if _, ok := characters["Humphrey Bogart"]; ok {
		t.Error("an actor appears in the characters list")
	}
	if _, ok := actors["Rick Blaine"]; ok {
		t.Error("a character appears in the actors list")
	}
	// THE BOOK CASE. A character with no actor anywhere, which a merged list loses.
	if characters["Paul Atreides"] == 0 {
		t.Errorf("a book's character is missing from characters: %v", characters)
	}
	if len(actors) != 1 {
		t.Errorf("actors = %v, want only the one film actor — a book has none", actors)
	}
	// And a character is NOT a person: `people` is the actor/director merge and
	// must not have grown a character row.
	for _, r := range out["people"].Top {
		if r.Name == "Rick Blaine" || r.Name == "Paul Atreides" {
			t.Errorf("%q reached the people breakdown; a character has no portrait or page", r.Name)
		}
	}
}
