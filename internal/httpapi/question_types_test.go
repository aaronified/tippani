package httpapi

// The question types added in 3.0, and the one rule that runs through all of
// them: a card must never ask something it cannot answer for, and must never
// print the answer beside the question.
//
// Unit-level, against pools built by hand, for the reason speaker_test.go gives:
// the LOADING of a pool is pinned where it happens (against real rows), and what
// these are about is what each attach function does with one.

import (
	"strings"
	"testing"
)

// A small library of books by three authors — enough for four options.
func authorPools() (quizPools, string) {
	own := workRef{key: "book:1", kind: kindBook, title: "The Dispossessed", author: "Ursula K. Le Guin",
		art: "cover1.jpg", genres: map[string]bool{"scifi": true}, actors: map[string]bool{}}
	others := []workRef{
		{key: "book:2", kind: kindBook, title: "Dune", author: "Frank Herbert", genres: map[string]bool{"scifi": true}, actors: map[string]bool{}},
		{key: "book:3", kind: kindBook, title: "Solaris", author: "Stanisław Lem", genres: map[string]bool{"scifi": true}, actors: map[string]bool{}},
		{key: "book:4", kind: kindBook, title: "Middlemarch", author: "George Eliot", genres: map[string]bool{}, actors: map[string]bool{}},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	for _, w := range others {
		p.byKey[w.key] = w
	}
	return p, own.key
}

func TestWhoWroteThisOffersAuthorsWithFaces(t *testing.T) {
	p, ownKey := authorPools()
	card := reviewCard{Kind: kindBook, ID: 1, Direction: dirAuthor,
		Quote: "You cannot buy the revolution.", Title: "The Dispossessed", Author: "Ursula K. Le Guin"}
	if !attachAuthor(&card, ownKey, p, 7) {
		t.Fatal("a library of four books could not ask who wrote one of them")
	}
	if card.Options[card.Answer] != "Ursula K. Le Guin" {
		t.Fatalf("the answer is not the book's author: %v (answer %d)", card.Options, card.Answer)
	}
	if len(card.OptionMeta) != len(card.Options) {
		t.Fatalf("option_meta does not mirror the options: %+v", card.OptionMeta)
	}
	for i, om := range card.OptionMeta {
		// A PERSON IS SHOWN BY THEIR CHIP, and never by a poster.
		if om.Kind != "author" || om.Person != card.Options[i] || om.Art != "" {
			t.Errorf("option %d meta = %+v, want the author's own name and no art", i, om)
		}
	}
	// THE TITLE IS NOT THE ANSWER TO THIS QUESTION, and printing it among four
	// people would be a category error as well as a leak.
	for _, o := range card.Options {
		if strings.EqualFold(o, "The Dispossessed") {
			t.Errorf("a work title is being offered as a person: %v", card.Options)
		}
	}
}

// A highlight with no author on its book cannot be asked who wrote it, and a
// one-book library cannot offer anyone to be wrong with.
func TestWhoWroteThisRefusesWhatItCannotAsk(t *testing.T) {
	p, ownKey := authorPools()
	anon := reviewCard{Kind: kindBook, ID: 1, Direction: dirAuthor, Title: "The Dispossessed"}
	if attachAuthor(&anon, ownKey, p, 1) {
		t.Error("asked who wrote a book with no author recorded")
	}
	lonely := workRef{key: "book:9", kind: kindBook, title: "Alone", author: "Solo Writer"}
	one := quizPools{byKey: map[string]workRef{lonely.key: lonely}, works: []workRef{lonely}}
	card := reviewCard{Kind: kindBook, ID: 9, Direction: dirAuthor, Title: "Alone", Author: "Solo Writer"}
	if attachAuthor(&card, lonely.key, one, 1) {
		t.Error("offered a question with nobody to be wrong with")
	}
	// And it is a BOOK question: nobody is credited with writing a film line.
	film := reviewCard{Kind: kindScreen, ID: 1, Direction: dirAuthor, Title: "Heat", Author: "Michael Mann"}
	if attachAuthor(&film, "screen:1", p, 1) {
		t.Error("asked who wrote a film")
	}
}

// "Who said this?" reaches a speech now — the column was always there.
func TestWhoSaidThisReachesASpeech(t *testing.T) {
	own := workRef{key: "utterance:burma radio broadcast", kind: kindUtterance,
		title: "Burma Radio broadcast", author: "Subhas Chandra Bose"}
	others := []workRef{
		{key: "utterance:first inaugural", kind: kindUtterance, title: "first inaugural address", author: "Franklin D. Roosevelt"},
		{key: "utterance:finest hour", kind: kindUtterance, title: "their finest hour", author: "Winston Churchill"},
		{key: "utterance:i have a dream", kind: kindUtterance, title: "March on Washington", author: "Martin Luther King Jr."},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	for _, w := range others {
		p.byKey[w.key] = w
	}
	card := reviewCard{Kind: kindUtterance, ID: 1, Direction: dirSpeaker,
		Quote: "Give me blood and I shall give you freedom.",
		Title: "Burma Radio broadcast", Speaker: "Subhas Chandra Bose"}
	if !attachSpeaker(&card, own.key, p, 5) {
		t.Fatal("a library of four speeches could not ask who gave one of them")
	}
	if card.Options[card.Answer] != "Subhas Chandra Bose" {
		t.Fatalf("the answer is not the speaker: %v (answer %d)", card.Options, card.Answer)
	}
	for i, om := range card.OptionMeta {
		if om.Kind != "speaker" || om.Person != card.Options[i] {
			t.Errorf("option %d meta = %+v, want the speaker's own name", i, om)
		}
	}
	// A SPEECH WITH NO OCCASION IS TITLED BY ITS SPEAKER, so asking who said it
	// would be the "which source?" card with the same four answers.
	bare := reviewCard{Kind: kindUtterance, ID: 2, Direction: dirSpeaker,
		Quote: "Give me blood.", Title: "Subhas Chandra Bose", Speaker: "Subhas Chandra Bose"}
	if attachSpeaker(&bare, own.key, p, 5) {
		t.Error("asked who said a quote whose title is already the speaker's name")
	}
}

// ---- fill in the blank, with choices ---------------------------------------

func clozeMCQPools() (quizPools, string) {
	own := workRef{key: "book:1", kind: kindBook, title: "Pride and Prejudice", author: "Jane Austen",
		genres: map[string]bool{}, actors: map[string]bool{}}
	other := workRef{key: "book:2", kind: kindBook, title: "Moby-Dick", author: "Herman Melville",
		genres: map[string]bool{}, actors: map[string]bool{}}
	third := workRef{key: "book:3", kind: kindBook, title: "Middlemarch", author: "George Eliot",
		genres: map[string]bool{}, actors: map[string]bool{}}
	p := quizPools{
		byKey: map[string]workRef{own.key: own, other.key: other, third.key: third},
		works: []workRef{own, other, third},
		quotes: []quoteRef{
			{work: other, kind: kindBook, id: 20, text: "Call me Ishmael, and mind the whaling voyages of the world"},
			{work: third, kind: kindBook, id: 30, text: "Character is not cut in marble, it is something living and changing"},
			{work: other, kind: kindBook, id: 21, text: "Whenever it is a damp drizzly November in my very soul indeed"},
		},
	}
	return p, own.key
}

func TestClozeWithChoicesBlanksTheQuoteAndOffersRealPhrases(t *testing.T) {
	p, ownKey := clozeMCQPools()
	text := "It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife"
	card := reviewCard{Kind: kindBook, ID: 1, Direction: dirClozeMCQ, Quote: text, Title: "Pride and Prejudice"}
	if !attachClozeMCQ(&card, ownKey, p, 11, clozeMultiWordFrom) {
		t.Fatal("a quote this long could not be blanked with choices")
	}
	if !strings.Contains(card.Quote, clozeBlank) {
		t.Fatalf("the quote was not masked: %q", card.Quote)
	}
	if len(card.Options) < speakerMinOptions {
		t.Fatalf("too few phrases to be a question: %v", card.Options)
	}
	// THE ANSWER IS AMONG THEM, and it is the span the blank was cut from.
	answer := card.Options[card.Answer]
	if strings.Contains(card.Quote, answer) {
		t.Errorf("the answer %q is still printed in the masked quote %q", answer, card.Quote)
	}
	if !strings.Contains(text, answer) {
		t.Errorf("the answer %q is not a phrase out of the quote", answer)
	}
	// EVERY OPTION IS THE SAME SHAPE. Three one-word options beside a three-word
	// answer would give the card away without reading any of them.
	want := len(strings.Fields(answer))
	for _, o := range card.Options {
		if len(strings.Fields(o)) != want {
			t.Errorf("option %q is %d words, the answer is %d", o, len(strings.Fields(o)), want)
		}
	}
	// AND EXACTLY ONE OF THEM IS RIGHT.
	right := 0
	for _, o := range card.Options {
		if clozeCorrect(answer, o) {
			right++
		}
	}
	if right != 1 {
		t.Errorf("%d of %v grade as correct — a card with two right answers", right, card.Options)
	}
}

func TestClozeWithChoicesRefusesALibraryWithNoOtherWords(t *testing.T) {
	own := workRef{key: "book:1", kind: kindBook, title: "Alone", author: "Solo"}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: []workRef{own}}
	card := reviewCard{Kind: kindBook, ID: 1, Direction: dirClozeMCQ, Title: "Alone",
		Quote: "It is a truth universally acknowledged that a single man must want a wife"}
	if attachClozeMCQ(&card, own.key, p, 3, clozeMultiWordFrom) {
		t.Error("offered a multiple choice with nothing to choose between")
	}
	// The typed cloze still works on the same card, which is what makes refusing
	// here free — see buildQuestion.
	typed := reviewCard{Kind: kindBook, ID: 1, Direction: dirCloze, Title: "Alone",
		Quote: "It is a truth universally acknowledged that a single man must want a wife"}
	if !attachCloze(&typed, clozeMultiWordFrom) {
		t.Error("the typed cloze should still have something to ask")
	}
}

// ---- "which quote?" names its options once the card is graded ---------------

func TestQuoteOptionsCarryTheirSource(t *testing.T) {
	p, ownKey := clozeMCQPools()
	card := reviewCard{Kind: kindBook, ID: 1, Direction: dirQuote, Title: "Pride and Prejudice",
		Quote: "It is a truth universally acknowledged"}
	if !attachMCQ(&card, ownKey, p, 13) {
		t.Fatal("no quote card from a three-book pool")
	}
	if len(card.OptionMeta) != len(card.Options) {
		t.Fatalf("option_meta does not mirror the options: %+v", card.OptionMeta)
	}
	for i, om := range card.OptionMeta {
		if om.Source == "" {
			t.Errorf("option %d (%q) names no source", i, card.Options[i])
		}
		// THE ROW ITSELF, so the client can report a revealed option as seen.
		if om.ItemKind == "" || om.ItemID == 0 {
			t.Errorf("option %d names no row: %+v", i, om)
		}
		// A quote option is not a person and is not a work: no face on it.
		if om.Person != "" {
			t.Errorf("option %d wears a face: %+v", i, om)
		}
	}
	if got := card.OptionMeta[card.Answer]; got.Source != "Pride and Prejudice" || got.ItemID != 1 {
		t.Errorf("the answer names the wrong source: %+v", got)
	}
}
