package httpapi

import (
	"net/http"
	"testing"
)

// A CHIP CARRIES WHO PLAYS THE CHARACTER IT NAMES.
//
// THE REPORT, the owner's, of a two-hander on a film's page: "as for cards in
// work pages, single character cards are fine. multi-character ones still has a
// separate actor line."
//
// THE SPECIFICATION behind it, which is the app's standing rule about a fact
// appearing once per card: a chip says "this character, played by that person",
// and what the chip says does not get a line of its own underneath. A card with
// ONE character obeyed it — the chip's second line came off the stored speaker
// link — and a card with two did not, because the pairing was carried for the
// stored speaker alone and every other name on the line came back with the
// character and nothing else. So the card had to fall back to a PLAYED BY line
// naming both performers, and the reader read the same two names twice.
//
// WHY IT IS ASKED OF THE READ. The pairing lives in `work_cast`, one row per
// casting, and the chips are drawn from what the LIST endpoints serve — Quotes,
// Home and a work's own page all draw from the same payload. A test of the fold
// in isolation would say the fold works; what was wrong is that the fact never
// left the database.
//
// AND A BOOK ANSWERS EMPTY, deliberately. 0047 refuses `annotations.actor` and a
// book's cast has no performer, so an empty second line there is the honest
// answer rather than a missing one — pinned below so a later change cannot start
// inventing one.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that a line names
// its characters as free text split on the reader's separators, while the
// performer hangs off the work's cast row for that character.

type performerEntry struct {
	Name       string `json:"name"`
	Actor      string `json:"actor"`
	ActorImage string `json:"actor_image"`
	ActorID    int64  `json:"actor_id"`
}

type performerLine struct {
	ID              int64            `json:"id"`
	Quote           string           `json:"quote"`
	CharacterImages []performerEntry `json:"character_images"`
	SpeakerCast     *performerEntry  `json:"speaker_cast"`
}

func TestEveryCharacterOnALineCarriesItsOwnPerformer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	film := decode[struct{ ID int64 }](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Two for the Road", "media_type": "movie"}, http.StatusCreated))
	book := decode[struct{ ID int64 }](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Moby-Dick"}, http.StatusCreated))

	// The work's cast: two characters, two performers, which is the fact a card
	// should be able to print beside each name without asking again.
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Mark Wallace", "actor": "Albert Finney"}, http.StatusCreated)
	c.mustDo("POST", "/movies/"+itoa(film.ID)+"/cast",
		map[string]any{"character": "Joanna Wallace", "actor": "Audrey Hepburn"}, http.StatusCreated)

	// A line both of them speak. Exactly one can be the stored speaker, which is
	// the whole point: the other used to come back bare.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Just wish that you'd stop sniping.",
		"character": "Mark Wallace, Joanna Wallace", "actor": "Albert Finney, Audrey Hepburn",
	}, http.StatusCreated)
	// AND A LINE WITH ONE SPEAKER, because the stored-speaker chip is served by a
	// different query in a different file (`quote_speaker.go`) with the same hole,
	// and a two-hander gets no `speaker_cast` at all — the linker leaves it
	// deliberately unlinked, so an assertion made only against the line above
	// would be a branch that never runs.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "You don't say much, do you.",
		"character": "Mark Wallace", "actor": "Albert Finney",
	}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Call me Ishmael.", "character": "Ishmael",
	}, http.StatusCreated)

	lines := decode[struct {
		Dialogues []performerLine `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues", nil, http.StatusOK)).Dialogues

	want := map[string]string{"Mark Wallace": "Albert Finney", "Joanna Wallace": "Audrey Hepburn"}
	seen := map[string]performerEntry{}
	speakers := 0
	for i := range lines {
		for _, e := range lines[i].CharacterImages {
			if _, ok := want[e.Name]; ok {
				seen[e.Name] = e
			}
		}
		if sp := lines[i].SpeakerCast; sp != nil && sp.Name != "" {
			speakers++
			// ── AND THE STORED SPEAKER'S OWN ROW, which is served by a different
			// query in a different file and had the same hole.
			if sp.Actor != "" && sp.ActorID == 0 {
				t.Errorf("the speaker chip names %q and carries no record for them, so the chooser's third question answers no",
					sp.Actor)
			}
		}
	}
	for name, actor := range want {
		got, drawn := seen[name]
		if !drawn {
			t.Errorf("%q is named on the line and gets no chip at all", name)
			continue
		}
		if got.Actor != actor {
			t.Errorf("the chip for %q says its performer is %q, so the card has to print %q on a line of its own underneath",
				name, got.Actor, actor)
		}
		// ── AND ENOUGH TO OPEN THEM. The owner's ruling on what a chip asks is
		// "the work-character, global-character … or the people", and the chooser
		// gates that third door on the performer's record id. Without it the row
		// draws and declines, which is the state every chip was in — survivable
		// while the card printed a PLAYED BY line with a door on it, and not now
		// that the line goes wherever the chips already name them.
		if got.ActorID == 0 {
			t.Errorf("the chip for %q names %q and carries no record for them, so pressing it can never reach their page",
				name, got.Actor)
		}
	}

	if speakers == 0 {
		t.Fatal("no line came back with a stored speaker, so the speaker half of this case never ran")
	}

	// ── AND A BOOK'S CHARACTER STAYS BARE. Nothing plays Ishmael.
	notes := decode[struct {
		Annotations []performerLine `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	for i := range notes {
		for _, e := range notes[i].CharacterImages {
			if e.Name == "Ishmael" && e.Actor != "" {
				t.Errorf("a book's character came back played by %q — 0047 gives a highlight no performer to be right about", e.Actor)
			}
		}
	}
}
