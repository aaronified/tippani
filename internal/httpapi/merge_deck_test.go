package httpapi

// mergeDeck — how a deck is dealt, tested directly, with lists this file builds.
//
// The deck endpoints in review_test.go reach it through a seeded library, and
// Practice's seed is random per request, so what those tests can assert about
// ORDER is loose: the rotation guard there catches its own removal about two runs
// in three. Here every input is fixed, so each rule below is asserted as the exact
// sequence it deals, and a mutation to that rule turns the sequence wrong on every
// run. The file knows the function's name and its candidate type, which is the
// declared exception: the order of a deck is what this function decides, and no
// screen shows it more directly than the cards the function returns.

import (
	"strings"
	"testing"
)

// cands builds a list from "A1 B1 A2": the letter is the card's work, and the
// whole token is its id in the sequences the tests compare.
func cands(spec string) []reviewCand {
	var out []reviewCand
	for i, tok := range strings.Fields(spec) {
		out = append(out, reviewCand{card: reviewCard{ID: int64(i), Note: tok}, workKey: tok[:1]})
	}
	return out
}

func dealt(deck []reviewCand) string {
	toks := make([]string, len(deck))
	for i, c := range deck {
		toks[i] = c.card.Note
	}
	return strings.Join(toks, " ")
}

// kinds prints a deck as U (never asked) and A (already asked), telling them
// apart by the list each card came from.
func kinds(deck []reviewCand, asked []reviewCand) string {
	fromAsked := map[string]bool{}
	for _, c := range asked {
		fromAsked[c.card.Note] = true
	}
	var b strings.Builder
	for _, c := range deck {
		if fromAsked[c.card.Note] {
			b.WriteByte('A')
		} else {
			b.WriteByte('U')
		}
	}
	return b.String()
}

// The owner's ruling at 3.0.3, "Unseen get most slots": two quotes never asked,
// then one already asked. Written out as the sequence, not as a formula over the
// constant, so moving the constant is a failure here and not a new expectation.
func TestMergeDeckDealsTwoNotYetAskedToOneAsked(t *testing.T) {
	if reviewDueEvery != 3 {
		t.Fatalf("reviewDueEvery = %d; the ruling is two unseen to one asked, so every third slot", reviewDueEvery)
	}
	asked := cands("a1 b1 c1 d1")
	unseen := cands("e1 f1 g1 h1 i1 j1 k1 l1")
	deck := mergeDeck(asked, unseen, 12, reviewDueEvery, 0)
	if got := kinds(deck, asked); got != "UUAUUAUUAUUA" {
		t.Fatalf("dealt %s, want UUAUUAUUAUUA", got)
	}
}

// The Daily deck is rebuilt on every fetch with the unspent slots only, so the
// slots are numbered from the cards already dealt today. A reader who has
// answered one card is on slot two, and two cards later is owed a review.
func TestMergeDeckNumbersSlotsFromTheCardsAlreadyDealt(t *testing.T) {
	asked := cands("a1 b1 c1")
	unseen := cands("e1 f1 g1 h1 i1")
	for _, tc := range []struct {
		dealt int
		want  string
	}{
		{0, "UUAU"},
		{1, "UAUU"},
		{2, "AUUA"},
		{5, "AUUA"},
	} {
		// The first four are the slots; what follows them is spares.
		if got := kinds(mergeDeck(asked, unseen, 4, reviewDueEvery, tc.dealt)[:4], asked); got != tc.want {
			t.Errorf("after %d dealt: %s, want %s", tc.dealt, got, tc.want)
		}
	}
}

// Either kind fills the other's slots when it runs out, and whatever the slots
// did not take follows as spares — unseen first, then asked — because a card
// the question builder rejects is replaced from them.
func TestMergeDeckFillsFromWhicheverListRemains(t *testing.T) {
	if got := dealt(mergeDeck(nil, cands("e1 f1 g1"), 3, reviewDueEvery, 0)); got != "e1 f1 g1" {
		t.Errorf("unseen only: %s", got)
	}
	if got := dealt(mergeDeck(cands("a1 b1 c1"), nil, 3, reviewDueEvery, 0)); got != "a1 b1 c1" {
		t.Errorf("asked only: %s", got)
	}
	if got := dealt(mergeDeck(cands("a1 b1"), cands("e1 f1 g1 h1"), 3, reviewDueEvery, 0)); got != "e1 f1 a1 g1 h1 b1" {
		t.Errorf("with spares: %s, want the three slots then unseen spares then asked", got)
	}
}

// Two lists each rotated by work can still put one work in consecutive slots
// where they are dealt together. A slot looks a few cards down its own list for
// a work not among the last two dealt.
func TestMergeDeckKeepsOneWorkOutOfConsecutiveSlots(t *testing.T) {
	// The seam: slot three is asked, and the asked list leads with the work slot
	// one just dealt.
	asked := cands("X9 Y9")
	unseen := cands("X1 Z1 X2 Z2")
	if got := dealt(mergeDeck(asked, unseen, 4, reviewDueEvery, 0)); got != "X1 Z1 Y9 X2 Z2 X9" {
		t.Errorf("across the seam: %s, want X1 Z1 Y9 X2 Z2 X9", got)
	}
	// Inside one list, and where nothing else is left the list's own order wins.
	if got := dealt(mergeDeck(nil, cands("A1 A2 A3 B1 C1"), 5, reviewDueEvery, 0)); got != "A1 B1 C1 A2 A3" {
		t.Errorf("one list: %s, want A1 B1 C1 A2 A3", got)
	}
}

// Every card handed in comes back once: stepping past a card to reach another
// work reorders the list and must not drop or repeat one. The inputs are left
// as they were, because Daily passes the lists it fetched and reads them again.
func TestMergeDeckLosesAndRepeatsNothing(t *testing.T) {
	asked := cands("A1 A2 B1 A3 C1 A4")
	unseen := cands("A5 A6 A7 B2 A8 C2 B3 A9 A10")
	before := dealt(asked) + " | " + dealt(unseen)
	deck := mergeDeck(asked, unseen, 6, reviewDueEvery, 0)
	if len(deck) != len(asked)+len(unseen) {
		t.Fatalf("dealt %d cards from %d", len(deck), len(asked)+len(unseen))
	}
	seen := map[string]int{}
	for _, c := range deck {
		seen[c.card.Note]++
	}
	for _, c := range append(append([]reviewCand{}, asked...), unseen...) {
		if seen[c.card.Note] != 1 {
			t.Errorf("%s dealt %d times in %s", c.card.Note, seen[c.card.Note], dealt(deck))
		}
	}
	if after := dealt(asked) + " | " + dealt(unseen); after != before {
		t.Errorf("the inputs changed: %s, were %s", after, before)
	}
}
