package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

// SEARCH HITS CARRY THEIR CHARACTERS' PICTURES, IN EVERY SECTION THAT HOLDS ONE
// (0050).
//
// The sections are assembled independently, so the risk this guards is a section
// nobody remembered — and the symptom would be a chip silently falling back to the
// actor on one part of the page and not another. It walks the three sections a
// dialogue hit reaches from one query: the quote match, the ACTOR match and the
// CHARACTER match.
//
// The actor section is included on purpose. The client decides which face to draw
// from the section it is rendering — the actor under Actors, the character
// elsewhere — so the data is present either way, and withholding it here would
// make the client's choice depend on what the server guessed the reader meant.
func TestSearchHitsCarryCharacterPictures(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	film, withArt, _ := seedTVDBCast(t, srv, c)

	srv.fetchImage = func(context.Context, string, string) (string, error) {
		return "waller-stored.jpg", nil
	}
	c.mustDo("POST", "/cast/"+itoa(withArt)+"/image", nil, http.StatusOK)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Squadron is a go.",
		"character": "Amanda Waller", "actor": "Viola Davis",
	}, http.StatusCreated)

	type hit struct {
		Quote           string `json:"quote"`
		CharacterImages []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"character_images"`
	}
	type resp struct {
		Dialogues []hit `json:"dialogues"`
		Actors    []struct {
			Name      string `json:"name"`
			Dialogues []hit  `json:"dialogues"`
		} `json:"actors"`
		Characters []struct {
			Name      string `json:"name"`
			Dialogues []hit  `json:"dialogues"`
		} `json:"characters"`
	}
	search := func(q string) resp {
		t.Helper()
		res := c.mustDo("GET", "/search?q="+q+"&scope=all", nil, http.StatusOK)
		var out resp
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode search: %v", err)
		}
		return out
	}

	// 1. THE QUOTE MATCHED — the words. The chip is the character's.
	byQuote := search("squadron")
	if len(byQuote.Dialogues) == 0 {
		t.Fatal("no dialogue hits for a quote match")
	}
	if n := len(byQuote.Dialogues[0].CharacterImages); n != 1 {
		t.Errorf("quote-match hit carries %d picture(s), want 1", n)
	}

	// 2. THE CHARACTER MATCHED — the section the chip is drawn from.
	byChar := search("waller")
	if len(byChar.Characters) == 0 {
		t.Fatal("no characters section for a character match")
	}
	if n := len(byChar.Characters[0].Dialogues); n == 0 {
		t.Fatal("the characters section holds no lines")
	}
	if n := len(byChar.Characters[0].Dialogues[0].CharacterImages); n != 1 {
		t.Errorf("character-section hit carries %d picture(s), want 1", n)
	}

	// 3. THE ACTOR MATCHED. The data is still attached, even though this section's
	// chips draw the actor.
	byActor := search("viola")
	if len(byActor.Actors) == 0 {
		t.Fatal("no actors section for an actor match")
	}
	if n := len(byActor.Actors[0].Dialogues); n == 0 {
		t.Fatal("the actors section holds no lines")
	}
	if n := len(byActor.Actors[0].Dialogues[0].CharacterImages); n != 1 {
		t.Errorf("actor-section hit carries %d picture(s), want 1 — the client picks "+
			"the face, so the server must not withhold it", n)
	}
}
