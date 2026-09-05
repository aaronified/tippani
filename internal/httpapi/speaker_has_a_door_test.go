package httpapi

import (
	"net/http"
	"testing"
)

// A NAME ON A CARD OPENS SOMETHING, INCLUDING AFTER THE READER HAS TIDIED THE
// CAST LIST.
//
// THE REPORT, from the owner's own library, on the film Anand: "anand still
// doesn't open. rajesh khanna still doesn't show any work." Both were the same
// row. The film's cast had come from TheTVDB, the reader had deleted its two
// provider rows — one of them spelled "Dr. Bhaskar K. Bannerjee / Babu Moshai",
// which is why they were deleted — and had then typed both characters onto
// quotes of that film. One came back, because the reader's spelling folded to a
// different key and was adopted as a new row. The other did not, because it
// folded to the same key as the row they had deleted.
//
// So the card printed "Anand", the chip opened nothing, and the performer's own
// page said the film was not one of his works while that film's quote credited
// him three lines above it. Nothing on any screen could explain the difference,
// because the difference was a spelling.
//
// WHAT THE PROPERTY IS. Every character named on a line of a work is one of that
// work's people, and stays one for as long as the line names them. A deletion
// answers the PROVIDER — a refetch cannot put the row back — and it answers the
// reader for as long as no line of theirs names that character. It does not
// outrank a line they have written.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the three
// facts asserted here are the three the reader was looking at — the row on the
// list, the door on the chip, and the film on the performer's page.

type speakerChip struct {
	Name        string `json:"name"`
	CharacterID int64  `json:"character_id"`
	CastID      int64  `json:"cast_id"`
}

// speakerCast is the stacked chip's own shape — the character with the performer
// UNDER THE NAME rather than on a credit line of its own, which is the owner's
// ruling: "the pill should have character and actor both". The card draws it only
// when the line is linked to a cast row, so a line whose row was deleted printed
// the flat chip and then repeated the performer on a line below it.
type stackedChip struct {
	Name  string `json:"name"`
	Actor string `json:"actor"`
}

type speakerLine struct {
	ID              int64         `json:"id"`
	Character       string        `json:"character"`
	SpeakerCast     *stackedChip  `json:"speaker_cast"`
	CharacterImages []speakerChip `json:"character_images"`
}

// cardFor reads the card a reader is actually looking at, through the list the
// Quotes screen draws from — not through the cast endpoint, because a reader on a
// card has not opened the cast list and the bug was invisible from there.
func cardFor(t *testing.T, c *testClient, character string) *speakerLine {
	t.Helper()
	lines := decode[struct {
		Dialogues []speakerLine `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, http.StatusOK)).Dialogues
	for i := range lines {
		if lines[i].Character == character {
			return &lines[i]
		}
	}
	return nil
}

func chipOn(line *speakerLine, character string) *speakerChip {
	for j := range line.CharacterImages {
		if line.CharacterImages[j].Name == character {
			return &line.CharacterImages[j]
		}
	}
	return nil
}

func TestASpeakerTheReaderDeletedFromTheCastStillOpensFromItsOwnLine(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := createFilm(t, c, "Anand", "Hrishikesh Mukherjee")
	c.mustDo("POST", "/movies/"+itoa(film)+"/cast",
		map[string]any{"character": "Anand", "actor": "Rajesh Khanna"}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film, "quote": "Babumoshai, zindagi badi honi chahiye.",
		"character": "Anand", "actor": "Rajesh Khanna",
	}, http.StatusCreated)

	rows := castList(t, c, "movies", film)
	if len(rows) != 1 {
		t.Fatalf("cast = %v, want the one row the reader is about to delete", castNames(rows))
	}
	c.mustDo("DELETE", "/cast/"+itoa(rows[0].ID), nil, http.StatusNoContent)

	// ── the row. The line still names them, so they are still one of this film's
	// people, whatever the cast list looked like a moment ago.
	if got := castNames(castList(t, c, "movies", film)); len(got) != 1 || got[0] != "Anand" {
		t.Fatalf("cast = %v — a character this film's own quote names is not on its list", got)
	}

	// ── the door. The reader is on a card, not on a cast list.
	card := cardFor(t, c, "Anand")
	if card == nil {
		t.Fatal("the film's own line is not on the list of lines at all")
	}
	chip := chipOn(card, "Anand")
	if chip == nil {
		t.Fatal("the card draws no chip at all for the character its line names")
	}
	if chip.CharacterID == 0 {
		t.Error("the chip draws a name and a face and opens nothing — no character record behind it")
	}
	if chip.CastID == 0 {
		t.Error("the chip has no cast row, so the line cannot be shown on the character's own page")
	}
	// ── and the performer is IN the pill rather than on a line of their own.
	if card.SpeakerCast == nil || card.SpeakerCast.Actor == "" {
		t.Error("the card draws a flat chip and repeats the performer on a line of its own")
	}

	// ── the works. The film credits them on a line of its own; their page must
	// agree with it.
	person := decode[struct {
		People []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"people"`
	}](t, c.mustDo("GET", "/people/search?q=Rajesh", nil, http.StatusOK))
	if len(person.People) == 0 {
		t.Fatal("the performer named on the line has no record at all")
	}
	detail := decode[struct {
		Roles []struct {
			WorkTitle string `json:"work_title"`
		} `json:"roles"`
	}](t, c.mustDo("GET", "/people/id/"+itoa(person.People[0].ID), nil, http.StatusOK))
	if len(detail.Roles) == 0 {
		t.Fatalf("%q has no works, while the film's own quote credits them", person.People[0].Name)
	}
	if detail.Roles[0].WorkTitle != "Anand" {
		t.Errorf("the performer's one work is %q, want the film whose line names them", detail.Roles[0].WorkTitle)
	}
}
