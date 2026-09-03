package httpapi

import (
	"net/http"
	"testing"
)

// A QUOTE SAYS WHO SPOKE IT, on the wire.
//
// `speaker_cast_id` has been a column since 0056 and no handler ever serialised
// it, so the link was correct in the database and invisible everywhere — the app
// could answer "which lines is this character's" from the character's own page and
// could not put a name on the line itself. These pin the half that was missing.
//
// WHAT IS WORTH PINNING HERE, as opposed to what merely works:
//
//   THE CHIP IS NOT THE CHARACTER TEXT. `character` says who is NAMED on the line
//   and is split on the reader's separators; `speaker_cast` says who SPOKE it and
//   is one row or none. A line naming two people has both fields and they disagree
//   on purpose.
//
//   A TOMBSTONE IS NOT A DELETE. 0048 keeps a removed provider row so a refetch
//   recognises and skips it, which means the foreign key's ON DELETE SET NULL
//   never fires for one — a quote written before the removal keeps a live-looking
//   id pointing at a row the reader deleted. Every reader of this column has to
//   guard `origin <> 'removed'`, and this is the case that says so.
//
//   ANOTHER READER'S CAST ROW IS NOT VISIBLE. The lookup restates `user_id`
//   although the id arrives off a row already scoped to the caller; the failure it
//   prevents is silent and would print somebody else's name on your quote.

// speakerOf reads one book quote back through the list endpoint the board uses.
// Through the endpoint rather than the table, because the whole defect being fixed
// was a column that was right and a payload that was silent.
func speakerOf(t *testing.T, c *testClient, bookID int64) *quoteSpeakerCast {
	t.Helper()
	res := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, http.StatusOK))
	if len(res.Annotations) != 1 {
		t.Fatalf("want exactly one annotation, got %d", len(res.Annotations))
	}
	return res.Annotations[0].SpeakerCast
}

func dialogueSpeakerOf(t *testing.T, c *testClient, movieID int64) *quoteSpeakerCast {
	t.Helper()
	res := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(movieID), nil, http.StatusOK))
	if len(res.Dialogues) != 1 {
		t.Fatalf("want exactly one dialogue, got %d", len(res.Dialogues))
	}
	return res.Dialogues[0].SpeakerCast
}

func TestABookQuoteCarriesTheCastRowItNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "The Master and Margarita")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Manuscripts don't burn.", "character": "Woland",
	}, http.StatusCreated)

	// Reading the cast is what adopts the quoted name into a row AND links the
	// quote to it — see cast_from_quotes.go. A reader reaches this by opening the
	// People panel; the 3.1.0 one-time pass is what covers everybody else.
	castList(t, c, "books", book)

	sp := speakerOf(t, c, book)
	if sp == nil {
		t.Fatal("the quote carries no speaker_cast, so no chip can be drawn")
	}
	if sp.Name != "Woland" {
		t.Errorf("speaker name = %q, want %q", sp.Name, "Woland")
	}
	if sp.CastID == 0 {
		t.Error("speaker carries no cast_id, so the character panel cannot be opened on this billing")
	}
	// THE RECORD IS THE DESTINATION. Without it the client draws no chip, because
	// there is no page to open — so a payload with a cast id and no character id is
	// the shape that silently produces nothing on screen.
	if sp.CharacterID == 0 {
		t.Error("speaker carries no character_id, so the chip would open nothing")
	}
}

// A FILM LINE, the other half, and it is a separate case rather than a table
// because the two live in two structs whose parity is itself under test.
func TestAFilmLineCarriesTheCastRowItNames(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := newMovie(t, c, map[string]any{"title": "Stalker"}).ID
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "Let everything that's been planned come true.",
		"character": "the Stalker", "actor": "Aleksandr Kaydanovskiy",
	}, http.StatusCreated)
	castList(t, c, "movies", movie)

	sp := dialogueSpeakerOf(t, c, movie)
	if sp == nil {
		t.Fatal("the line carries no speaker_cast")
	}
	if sp.Name != "the Stalker" {
		t.Errorf("speaker name = %q, want %q", sp.Name, "the Stalker")
	}
	if sp.CharacterID == 0 {
		t.Error("speaker carries no character_id")
	}
}

// NO SPEAKER IS A REAL ANSWER, and it has to be absent rather than empty: the
// field is `omitempty` so a quote nobody has attributed carries nothing at all,
// and the card goes on printing what it always printed.
func TestAQuoteWithNoSpeakerCarriesNoChip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Moby-Dick")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "Call me Ishmael.",
	}, http.StatusCreated)
	castList(t, c, "books", book)

	if sp := speakerOf(t, c, book); sp != nil {
		t.Fatalf("an unattributed quote carries a speaker %+v", *sp)
	}
}

// A LINE NAMING TWO PEOPLE HAS NO ONE SPEAKER, and the linker refuses to guess —
// which is the behaviour that makes the chip trustworthy. The `character` text
// still names both; only the chip is absent.
func TestALineNamingTwoCharactersGetsNoChip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := newMovie(t, c, map[string]any{"title": "Casablanca"}).ID
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "We'll always have Paris.",
		"character": "Rick, Ilsa",
	}, http.StatusCreated)
	castList(t, c, "movies", movie)

	if sp := dialogueSpeakerOf(t, c, movie); sp != nil {
		t.Errorf("a two-character line was attributed to %q — the linker must not guess", sp.Name)
	}
	// And the text is untouched, so the card still says who is in the line.
	res := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(movie), nil, http.StatusOK))
	if res.Dialogues[0].Character != "Rick, Ilsa" {
		t.Errorf("character text = %q, want it left alone", res.Dialogues[0].Character)
	}
}

// A REMOVED ROW IS STILL IN THE TABLE. This is the guard that is easiest to drop
// and hardest to notice: the row survives as a tombstone so a refetch skips it, so
// the foreign key never nulls the quote's link, so a lookup without the guard
// happily resolves a speaker the reader deleted.
func TestADeletedCastRowStopsBeingASpeaker(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	movie := newMovie(t, c, map[string]any{"title": "Solaris"}).ID
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "We don't want other worlds. We want a mirror.",
		"character": "Snaut",
	}, http.StatusCreated)
	rows := castList(t, c, "movies", movie)
	if len(rows) != 1 {
		t.Fatalf("want one cast row, got %d", len(rows))
	}
	if sp := dialogueSpeakerOf(t, c, movie); sp == nil {
		t.Fatal("no speaker before the removal, so this case would prove nothing")
	}

	c.mustDo("DELETE", "/cast/"+itoa(rows[0].ID), nil, http.StatusNoContent)

	if sp := dialogueSpeakerOf(t, c, movie); sp != nil {
		t.Errorf("a deleted cast row is still being drawn as the speaker: %+v", *sp)
	}
}
