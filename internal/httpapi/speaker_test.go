package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// "Who said this?" — options are ACTORS, drawn from the film's own billed cast.
//
// The requirement was explicit: actor cards, not character cards. The reviewer
// picks a face, and the faces that make it a real question are the other people
// in this same film — three actors the reader has quoted elsewhere would make
// the answer guessable from familiarity rather than from the film.

// heatCast is one film's pool as quizPools builds it: the actors of `work_cast`
// in billing order, de-duplicated, tombstones and actorless rows already left
// out. The loading of it is pinned where it happens (cast_speaker_test.go, against
// real rows); what these tests are about is what attachSpeaker does with a pool,
// so they take one directly rather than through a database.
var heatCast = []string{"Robert De Niro", "Al Pacino", "Val Kilmer", "Jon Voight", "Amy Brenneman"}

func TestSpeakerOptionsAreActorsFromTheSameFilm(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: heatCast}
	p := quizPools{byKey: map[string]workRef{"screen:1": own}, works: []workRef{own}}
	card := reviewCard{Kind: kindScreen, ID: 1, Direction: dirSpeaker,
		Quote: "Don't let yourself get attached", Title: "Heat", Character: "Neil", Actor: "Robert De Niro"}

	if !attachSpeaker(&card, "screen:1", p, 99, tierMedium) {
		t.Fatal("no speaker card from a five-strong cast")
	}
	if len(card.Options) < speakerMinOptions {
		t.Fatalf("too few faces to be a question: %v", card.Options)
	}
	if card.Options[card.Answer] != "Robert De Niro" {
		t.Fatalf("the answer option is not the line's actor: %v (answer %d)", card.Options, card.Answer)
	}
	// EVERY option is a person, so every option carries a face.
	if len(card.OptionMeta) != len(card.Options) {
		t.Fatalf("option_meta does not mirror the options: %+v", card.OptionMeta)
	}
	for i, om := range card.OptionMeta {
		if om.Kind != "actor" || om.Person != card.Options[i] {
			t.Errorf("option %d meta = %+v, want the actor's own name", i, om)
		}
	}
	// ACTORS, NOT CHARACTERS. This is the requirement, stated as a test: the
	// character name must not appear among the things you are choosing between.
	for _, o := range card.Options {
		if strings.EqualFold(o, "Neil") || strings.EqualFold(o, "Vincent") {
			t.Errorf("a character name is being offered as an option: %v", card.Options)
		}
	}
	// And the distractors come from this film.
	billed := map[string]bool{}
	for _, a := range own.cast {
		billed[a] = true
	}
	for _, o := range card.Options {
		if !billed[o] {
			t.Errorf("option %q is not in this film's cast", o)
		}
	}
}

// A line with no actor recorded cannot ask who said it, and a film whose cast
// was never fetched cannot offer enough faces. Both fall back rather than
// producing a degenerate card — which costs nothing now, because buildQuestion
// tries the rest of the table and ends at the flip card.
func TestSpeakerRefusesWhatItCannotAsk(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: heatCast}
	p := quizPools{byKey: map[string]workRef{"screen:1": own}, works: []workRef{own}}

	noActor := reviewCard{Kind: kindScreen, ID: 1, Direction: dirSpeaker, Title: "Heat"}
	if attachSpeaker(&noActor, "screen:1", p, 1, tierMedium) {
		t.Error("asked who said a line that has no actor recorded")
	}

	bare := workRef{key: "screen:2", kind: kindScreen, title: "Solo"}
	bareP := quizPools{byKey: map[string]workRef{"screen:2": bare}, works: []workRef{bare}}
	thin := reviewCard{Kind: kindScreen, ID: 2, Direction: dirSpeaker, Title: "Solo", Actor: "Someone"}
	if attachSpeaker(&thin, "screen:2", bareP, 1, tierMedium) {
		t.Error("made a question out of one face and no distractors")
	}

	// A book has no cast at all, and the direction is not even in its table.
	for _, d := range directionsFor(kindBook) {
		if d == dirSpeaker {
			t.Fatal("a book can be asked who said the line")
		}
	}
}

// ---- a card must not print the answer above its own options ------------------
//
// THE LEAK. `speaker` and `author` cards show the WORDS and ask who is behind
// them, so a line whose own text names that person answers itself. review.jsx
// already stopped sending these directions down the attribution path — the
// comment there records the actor chip and character meta line that used to sit
// straight above the four options — and this is the half that was left: the
// quote's own text.
//
// EVERY CASE BELOW IS ABOUT WHAT THE READER CAN SEE, not about the shape of the
// helper. The masked text is read back off the card, and the one case that must
// NOT be masked is here beside the ones that must.

func TestASpeechDoesNotPrintTheNameItIsAsking(t *testing.T) {
	own := workRef{key: "utterance:the crisis", kind: kindUtterance, title: "The Crisis", author: "Thomas Paine"}
	others := []workRef{
		{key: "utterance:a", kind: kindUtterance, author: "Patrick Henry"},
		{key: "utterance:b", kind: kindUtterance, author: "Frederick Douglass"},
		{key: "utterance:c", kind: kindUtterance, author: "Sojourner Truth"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	card := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Quote: "These are the times that try men's souls, wrote Thomas Paine.",
		Title: "The Crisis", Speaker: "Thomas Paine"}

	if !attachSpeaker(&card, own.key, p, 7, tierMedium) {
		t.Fatal("no speaker card from four speakers")
	}
	if strings.Contains(card.Quote, "Thomas Paine") {
		t.Fatalf("the quote still names its own speaker: %q", card.Quote)
	}
	if !strings.Contains(card.Quote, clozeBlank) {
		t.Fatalf("the name was removed without leaving a blank behind: %q", card.Quote)
	}
	// The rest of the line survives — this hides one name, it does not redact.
	if !strings.Contains(card.Quote, "try men's souls") {
		t.Fatalf("masking took more than the name: %q", card.Quote)
	}
}

// A JOINT CREDIT IS ALSO ITS PARTS: "Gaiman & Pratchett" is one option, and a
// line containing either half picks it out just as surely as the whole string.
func TestHalfAJointCreditLeaksTheWholeAnswer(t *testing.T) {
	own := workRef{key: "book:1", kind: kindBook, title: "Good Omens", author: "Neil Gaiman & Terry Pratchett"}
	others := []workRef{
		{key: "book:2", kind: kindBook, title: "Jonathan Strange", author: "Susanna Clarke"},
		{key: "book:3", kind: kindBook, title: "Piranesi", author: "Diana Wynne Jones"},
		{key: "book:4", kind: kindBook, title: "Titus Groan", author: "Mervyn Peake"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	card := reviewCard{Kind: kindBook, ID: 1, Direction: dirAuthor,
		Quote: "It may help to understand human affairs, as Pratchett put it, to be clear.",
		Title: "Good Omens", Author: "Neil Gaiman & Terry Pratchett"}

	if !attachAuthor(&card, own.key, p, 7, tierMedium) {
		t.Fatal("no author card from four books")
	}
	if strings.Contains(card.Quote, "Pratchett") {
		t.Fatalf("half the joint credit is still readable above its own options: %q", card.Quote)
	}
	if !strings.Contains(card.Quote, "human affairs") {
		t.Fatalf("masking took more than the name: %q", card.Quote)
	}
}

// THE CASE THAT MUST NOT BE MASKED, and it is the commonest one in the library.
// A film line's answer is the ACTOR. A line naming its CHARACTER gives that away
// only to a reader who knows the film — which is exactly what the card asks — so
// masking it would blank half the dialogue in the library to remove the
// knowledge being tested for.
func TestAFilmLineKeepsTheCharacterNameItIsNotAskingAbout(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: heatCast}
	p := quizPools{byKey: map[string]workRef{"screen:1": own}, works: []workRef{own}}
	card := reviewCard{Kind: kindScreen, ID: 1, Direction: dirSpeaker,
		Quote: "Neil, what are you doing here?", Title: "Heat", Character: "Neil", Actor: "Robert De Niro"}

	if !attachSpeaker(&card, "screen:1", p, 99, tierMedium) {
		t.Fatal("no speaker card from a five-strong cast")
	}
	if !strings.Contains(card.Quote, "Neil") {
		t.Fatalf("the character's name was masked on a card whose answer is the actor: %q", card.Quote)
	}
	if strings.Contains(card.Quote, clozeBlank) {
		t.Fatalf("nothing on this line is the answer, so nothing should be blanked: %q", card.Quote)
	}
}

// A LINE THAT IS ONLY A NAME IS NOT A QUESTION, so the card is refused and
// buildQuestion falls through to another direction — the same rule
// TestClozeRefusesWhatItCannotAsk applies to a quote that is all stopwords.
func TestALineThatIsOnlyItsSpeakersNameIsRefused(t *testing.T) {
	own := workRef{key: "utterance:x", kind: kindUtterance, title: "An occasion", author: "Thomas Paine"}
	others := []workRef{
		{key: "utterance:a", kind: kindUtterance, author: "Patrick Henry"},
		{key: "utterance:b", kind: kindUtterance, author: "Frederick Douglass"},
		{key: "utterance:c", kind: kindUtterance, author: "Sojourner Truth"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	card := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Quote: "Thomas Paine.", Title: "An occasion", Speaker: "Thomas Paine"}

	if attachSpeaker(&card, own.key, p, 7, tierMedium) {
		t.Fatalf("a line with nothing left to read was served as a question: %q", card.Quote)
	}

	// AND A NOTE DOES NOT RESCUE IT, which is the case this test could not reach
	// for a release: the fixture above carries no note, and the refusal read "no
	// words in the quote AND none in the note". So the same line with any remark
	// beside it was masked to a glyph and a full stop and served — review.jsx
	// prints `card.quote || card.note`, so the PROMPT was "￼." with the reader's
	// own margin note under it, on a card two documents said would be refused.
	withNote := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Quote: "Thomas Paine.", Note: "worth remembering", Title: "An occasion", Speaker: "Thomas Paine"}
	if attachSpeaker(&withNote, own.key, p, 7, tierMedium) {
		t.Fatalf("a line masked down to %q was served because it happened to carry a note (%q) — "+
			"the prompt IS the quote, so a note cannot make a wordless one a question",
			withNote.Quote, withNote.Note)
	}

	// A NOTE-ONLY ROW IS STILL A CARD, and this is the line the fix above must not
	// cross. A highlight can be a remark with no quote at all; its prompt is
	// honestly the note, and refusing it would drop a legitimate row rather than a
	// broken one. Masked to nothing and never having had any are different.
	noteOnly := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Note: "said on the eve of the crossing, to nobody in particular", Title: "An occasion", Speaker: "Thomas Paine"}
	if !attachSpeaker(&noteOnly, own.key, p, 7, tierMedium) {
		t.Errorf("a row that is a note with no quote was refused — its prompt is the note, " +
			"and it had words left after masking")
	}
}

// A NOTE IS SHOWN TOO, so a name hidden in the quote and left standing in the
// note is the same leak with an extra step.
func TestTheNoteIsMaskedAsWellAsTheQuote(t *testing.T) {
	own := workRef{key: "utterance:y", kind: kindUtterance, title: "An occasion", author: "Thomas Paine"}
	others := []workRef{
		{key: "utterance:a", kind: kindUtterance, author: "Patrick Henry"},
		{key: "utterance:b", kind: kindUtterance, author: "Frederick Douglass"},
		{key: "utterance:c", kind: kindUtterance, author: "Sojourner Truth"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	card := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Quote: "These are the times that try men's souls.",
		Note:  "Written by Thomas Paine in December.",
		Title: "An occasion", Speaker: "Thomas Paine"}

	if !attachSpeaker(&card, own.key, p, 7, tierMedium) {
		t.Fatal("no speaker card from four speakers")
	}
	if strings.Contains(card.Note, "Thomas Paine") {
		t.Fatalf("the note names the speaker the card is asking for: %q", card.Note)
	}
}

// A SURNAME IS A NAME WHEN IT IS CAPITALISED AND A WORD WHEN IT IS NOT, and that
// discriminator is the whole reason the surname rule is safe to have. An author
// called "Stephen King" would otherwise have this blanking "the king was dead"
// in every line of the library — prose naming a person capitalises them, prose
// using the same word as a common noun does not.
func TestASurnameThatIsAlsoACommonWordIsLeftAlone(t *testing.T) {
	own := workRef{key: "book:1", kind: kindBook, title: "The Stand", author: "Stephen King"}
	others := []workRef{
		{key: "book:2", kind: kindBook, title: "Ghost Story", author: "Peter Straub"},
		{key: "book:3", kind: kindBook, title: "Interview", author: "Anne Rice"},
		{key: "book:4", kind: kindBook, title: "Books of Blood", author: "Clive Barker"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}

	// The common noun survives.
	lower := reviewCard{Kind: kindBook, ID: 1, Direction: dirAuthor,
		Quote: "The king was dead, and the crown lay in the dust of the road.",
		Title: "The Stand", Author: "Stephen King"}
	if !attachAuthor(&lower, own.key, p, 7, tierMedium) {
		t.Fatal("no author card from four books")
	}
	if !strings.Contains(lower.Quote, "king was dead") {
		t.Fatalf("a common noun was masked because it happens to be an author's surname: %q", lower.Quote)
	}

	// The capitalised name does not.
	named := reviewCard{Kind: kindBook, ID: 2, Direction: dirAuthor,
		Quote: "It is the sort of ending King would never have written.",
		Title: "The Stand", Author: "Stephen King"}
	if !attachAuthor(&named, own.key, p, 7, tierMedium) {
		t.Fatal("no author card from four books")
	}
	if strings.Contains(named.Quote, "King") {
		t.Fatalf("a capitalised surname is the answer and is still readable: %q", named.Quote)
	}
}

// THE THREE EDGES A RATER FOUND, each of which served a card with its own answer
// printed on it.

// ADJACENT OCCURRENCES BOTH GO. The boundary characters are CONSUMED by a match,
// so the space between two occurrences belonged to the first and the second had
// nothing left to start on — leaving the exact string the function exists to
// hide, in plain sight, one word along.
func TestEveryOccurrenceOfTheNameGoes(t *testing.T) {
	own := workRef{key: "book:1", kind: kindBook, title: "The Stand", author: "Stephen King"}
	others := []workRef{
		{key: "book:2", kind: kindBook, title: "Ghost Story", author: "Peter Straub"},
		{key: "book:3", kind: kindBook, title: "Interview", author: "Anne Rice"},
		{key: "book:4", kind: kindBook, title: "Books of Blood", author: "Clive Barker"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	card := reviewCard{Kind: kindBook, ID: 1, Direction: dirAuthor,
		Quote: "King King said so, and King said it again.", Title: "The Stand", Author: "Stephen King"}

	if !attachAuthor(&card, own.key, p, 7, tierMedium) {
		t.Fatal("no author card from four books")
	}
	if strings.Contains(card.Quote, "King") {
		t.Fatalf("an occurrence of the answer survived: %q", card.Quote)
	}
}

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
