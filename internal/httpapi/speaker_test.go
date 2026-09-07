package httpapi

// "Who said this?" — options are ACTORS, drawn from the film's own billed cast.
//
// The requirement was explicit: actor cards, not character cards. The reviewer
// picks a face, and the faces that make it a real question are the other people
// in this same film — three actors the reader has quoted elsewhere would make
// the answer guessable from familiarity rather than from the film.

import (
	"strings"
	"testing"
)

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

	if !attachSpeaker(&card, "screen:1", p, 99) {
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
	if attachSpeaker(&noActor, "screen:1", p, 1) {
		t.Error("asked who said a line that has no actor recorded")
	}

	bare := workRef{key: "screen:2", kind: kindScreen, title: "Solo"}
	bareP := quizPools{byKey: map[string]workRef{"screen:2": bare}, works: []workRef{bare}}
	thin := reviewCard{Kind: kindScreen, ID: 2, Direction: dirSpeaker, Title: "Solo", Actor: "Someone"}
	if attachSpeaker(&thin, "screen:2", bareP, 1) {
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

	if !attachSpeaker(&card, own.key, p, 7) {
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

	if !attachAuthor(&card, own.key, p, 7) {
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

	if !attachSpeaker(&card, "screen:1", p, 99) {
		t.Fatal("no speaker card from a five-strong cast")
	}
	if !strings.Contains(card.Quote, "Neil") {
		t.Fatalf("the character's name was masked on a card whose answer is the actor: %q", card.Quote)
	}
	if strings.Contains(card.Quote, clozeBlank) {
		t.Fatalf("nothing on this line is the answer, so nothing should be blanked: %q", card.Quote)
	}
}

// ...but an actor named in the dialogue IS the answer, whoever else is in it.
func TestAFilmLineNamingItsActorIsMasked(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: heatCast}
	p := quizPools{byKey: map[string]workRef{"screen:1": own}, works: []workRef{own}}
	card := reviewCard{Kind: kindScreen, ID: 1, Direction: dirSpeaker,
		Quote: "Robert De Niro says the line about the coffee here.",
		Title: "Heat", Character: "Neil", Actor: "Robert De Niro"}

	if !attachSpeaker(&card, "screen:1", p, 99) {
		t.Fatal("no speaker card from a five-strong cast")
	}
	if strings.Contains(card.Quote, "Robert De Niro") {
		t.Fatalf("the answer is printed above its own options: %q", card.Quote)
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

	if attachSpeaker(&card, own.key, p, 7) {
		t.Fatalf("a line with nothing left to read was served as a question: %q", card.Quote)
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

	if !attachSpeaker(&card, own.key, p, 7) {
		t.Fatal("no speaker card from four speakers")
	}
	if strings.Contains(card.Note, "Thomas Paine") {
		t.Fatalf("the note names the speaker the card is asking for: %q", card.Note)
	}
}

// NOT GATED ON SCRIPT, which `\b` would have made it. The cloze SPAN selection
// requires mostly-Latin text because its stopword list is English; a name match
// needs no stopword list, so a Bengali line naming its speaker is masked like
// any other. `\b` is an ASCII-word rule and would never have fired here.
func TestANameIsMaskedOutsideTheLatinScript(t *testing.T) {
	own := workRef{key: "utterance:z", kind: kindUtterance, title: "একটি ভাষণ", author: "রবীন্দ্রনাথ ঠাকুর"}
	others := []workRef{
		{key: "utterance:a", kind: kindUtterance, author: "কাজী নজরুল ইসলাম"},
		{key: "utterance:b", kind: kindUtterance, author: "বেগম রোকেয়া"},
		{key: "utterance:c", kind: kindUtterance, author: "ঈশ্বরচন্দ্র বিদ্যাসাগর"},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	card := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Quote: "এই কথাটি রবীন্দ্রনাথ ঠাকুর বহুবার বলেছেন।",
		Title: "একটি ভাষণ", Speaker: "রবীন্দ্রনাথ ঠাকুর"}

	if !attachSpeaker(&card, own.key, p, 7) {
		t.Fatal("no speaker card from four speakers")
	}
	if strings.Contains(card.Quote, "রবীন্দ্রনাথ ঠাকুর") {
		t.Fatalf("a non-Latin line still names its own speaker: %q", card.Quote)
	}
	if !strings.Contains(card.Quote, "বহুবার") {
		t.Fatalf("masking took more than the name: %q", card.Quote)
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
	if !attachAuthor(&lower, own.key, p, 7) {
		t.Fatal("no author card from four books")
	}
	if !strings.Contains(lower.Quote, "king was dead") {
		t.Fatalf("a common noun was masked because it happens to be an author's surname: %q", lower.Quote)
	}

	// The capitalised name does not.
	named := reviewCard{Kind: kindBook, ID: 2, Direction: dirAuthor,
		Quote: "It is the sort of ending King would never have written.",
		Title: "The Stand", Author: "Stephen King"}
	if !attachAuthor(&named, own.key, p, 7) {
		t.Fatal("no author card from four books")
	}
	if strings.Contains(named.Quote, "King") {
		t.Fatalf("a capitalised surname is the answer and is still readable: %q", named.Quote)
	}
}
