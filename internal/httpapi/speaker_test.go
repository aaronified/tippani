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

const castJSON = `[{"character":"Neil","actor":"Robert De Niro"},
                   {"character":"Vincent","actor":"Al Pacino"},
                   {"character":"Chris","actor":"Val Kilmer"},
                   {"character":"Nate","actor":"Jon Voight"},
                   {"character":"Eady","actor":"Amy Brenneman"}]`

func TestCastActorsReadsBillingOrderOnce(t *testing.T) {
	got := castActors(castJSON)
	want := []string{"Robert De Niro", "Al Pacino", "Val Kilmer", "Jon Voight", "Amy Brenneman"}
	if len(got) != len(want) {
		t.Fatalf("castActors = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("castActors[%d] = %q, want %q (billing order is the point)", i, got[i], want[i])
		}
	}
	// A film with no cast fetched is not an error, just no material.
	if castActors("") != nil || castActors("not json") != nil {
		t.Error("a missing or malformed cast should read as no cast, not as a crash")
	}
	// One actor billed twice (two roles) appears once.
	dup := castActors(`[{"actor":"Peter Sellers"},{"actor":"Peter Sellers"},{"actor":"George C. Scott"}]`)
	if len(dup) != 2 {
		t.Errorf("a double-billed actor should appear once: %v", dup)
	}
}

func TestSpeakerOptionsAreActorsFromTheSameFilm(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: castActors(castJSON)}
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
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: castActors(castJSON)}
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
