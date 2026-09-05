package httpapi

import (
	"net/http"
	"testing"
)

// A CHARACTER NAMED ON A LINE IS OPENABLE FROM THE LINE.
//
// THE SPECIFICATION. The app draws a chip per character named on a quote — a
// face and a name — and `chipRows` gates the press on `character_id`. So a chip
// whose entry has no id draws exactly like one that opens and does nothing at
// all, which is worse than no chip: the reader has already decided to go
// through it. The whole of 0056 was to make that possible, and
// `cast_from_quotes.go` exists to give a quoted character the cast row the id
// hangs off.
//
// WHY IT IS ASKED OF THE READ AND NOT OF THE ADOPTION FUNCTION. Testing
// `adoptQuoteCharacters` directly says the adoption works, which was never in
// doubt — it did work, and had exactly one caller, the cast-list read. So a
// character was openable if and only if somebody had happened to open that
// work's cast list first, and the two screens where a reader actually meets a
// character never do. A test per function passes on that arrangement; asking the
// property of the ENDPOINT THAT DRAWS THE CHIP is what catches it.
//
// The three cases below are the three shapes of the same question: a film line,
// a book line, and a character with no performer — the last because that is how
// the report arrived ("character cards without actors do not open"), and it is
// worth pinning that the actor has nothing to do with it.

type chipEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	CastID      int64  `json:"cast_id"`
	CharacterID int64  `json:"character_id"`
}

type chipLine struct {
	ID              int64       `json:"id"`
	Quote           string      `json:"quote"`
	Character       string      `json:"character"`
	CharacterImages []chipEntry `json:"character_images"`
}

func TestEveryCharacterNamedOnALineCanBeOpenedFromIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "The Third Man", "media_type": "movie"}, http.StatusCreated))
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "The Fires of Heaven"}, http.StatusCreated))

	// A line naming a character AND a performer.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "I never knew the old Vienna.",
		"character": "Holly Martins", "actor": "Joseph Cotten",
	}, http.StatusCreated)
	// A line naming a character and NOBODY — the case the report came in on. An
	// unperformed character is a character: a narrator, an intertitle, a voice.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "You can see now?", "character": "Intertitle",
	}, http.StatusCreated)
	// And a book's highlight, which has no performer by design — 0047 refuses
	// `annotations.actor` — so if the door depended on one, no book would have any.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Dovie'andi se tovya sagain.", "character": "Matrim Cauthon",
	}, http.StatusCreated)

	// ── THE READ A READER ACTUALLY MAKES. Not the work's cast list — the list of
	// lines, which is what Quotes and Home draw their chips from. Nothing here
	// opens a cast list first, because a reader on those screens has not.
	for _, tc := range []struct {
		what, path, character string
	}{
		{"a film line with a performer", "/dialogues", "Holly Martins"},
		{"a film line with nobody named", "/dialogues", "Intertitle"},
		{"a book highlight", "/annotations", "Matrim Cauthon"},
	} {
		var lines []chipLine
		if tc.path == "/dialogues" {
			lines = decode[struct {
				Dialogues []chipLine `json:"dialogues"`
			}](t, c.mustDo("GET", tc.path, nil, http.StatusOK)).Dialogues
		} else {
			lines = decode[struct {
				Annotations []chipLine `json:"annotations"`
			}](t, c.mustDo("GET", tc.path, nil, http.StatusOK)).Annotations
		}
		var got *chipEntry
		for i := range lines {
			for j := range lines[i].CharacterImages {
				if lines[i].CharacterImages[j].Name == tc.character {
					got = &lines[i].CharacterImages[j]
				}
			}
		}
		if got == nil {
			t.Errorf("%s: %q is named on the line and gets no chip at all", tc.what, tc.character)
			continue
		}
		if got.CharacterID == 0 {
			t.Errorf("%s: the chip for %q has no character record — it draws a name and a face and opens nothing",
				tc.what, tc.character)
		}
	}
}

// AND READING THE LINES TWICE DOES NOT MAKE TWO CHARACTERS, which is the other
// half of it and the half a careless fix breaks. The read writes, so it has to be
// idempotent: a reader refreshing Quotes must not accumulate a cast row per
// refresh, and `origin = 'removed'` — a reader saying they do not want this
// character — must stay removed however many times the list is drawn.
func TestDrawingTheChipsTwiceAddsNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Sunset Boulevard", "media_type": "movie"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "I am big.", "character": "Norma Desmond", "actor": "Gloria Swanson",
	}, http.StatusCreated)

	count := func() int {
		return len(decode[doorList](t, c.mustDo("GET", "/movies/"+itoa(film.ID)+"/cast", nil, http.StatusOK)).Cast)
	}
	c.mustDo("GET", "/dialogues", nil, http.StatusOK)
	first := count()
	if first == 0 {
		t.Fatal("drawing the chips adopted nothing at all")
	}
	for i := 0; i < 3; i++ {
		c.mustDo("GET", "/dialogues", nil, http.StatusOK)
	}
	if n := count(); n != first {
		t.Errorf("four reads of the same list left %d cast rows where one read left %d — the read is not idempotent",
			n, first)
	}
}
