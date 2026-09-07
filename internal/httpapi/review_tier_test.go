package httpapi

import (
	"net/http"
	"slices"
	"testing"
)

// The three difficulties, and the one claim the whole change rests on.
//
// MEDIUM IS TODAY, EXACTLY. That is the risk argument for landing a new axis of
// question generation near a release, so it is asserted rather than asserted-in-a
// -comment: every tier function has to return its argument untouched for medium,
// and the rest of this package's suite — which pins today's behaviour in a few
// hundred cases and passes tierMedium everywhere — is the other half of it.

func TestMediumChangesNothingAtAll(t *testing.T) {
	dirs := []string{dirSource, dirQuote, dirCloze, dirClozeMCQ, dirSpeaker, dirAuthor, dirFlip}
	if got := tierDirections(tierMedium, dirs); !slices.Equal(got, dirs) {
		t.Errorf("tierDirections(medium) = %v, want the list unchanged", got)
	}
	if got := tierOptions(tierMedium); got != quizOptions {
		t.Errorf("tierOptions(medium) = %d, want quizOptions %d", got, quizOptions)
	}
	if got := tierMinOptions(tierMedium); got != speakerMinOptions {
		t.Errorf("tierMinOptions(medium) = %d, want speakerMinOptions %d", got, speakerMinOptions)
	}
	for _, stored := range []float64{1, 30, 100, 365} {
		if got := tierClozeThreshold(tierMedium, stored); got != stored {
			t.Errorf("tierClozeThreshold(medium, %g) = %g, want it unchanged", stored, got)
		}
	}
	if got := tierPrefers(tierMedium); got != "" {
		t.Errorf("tierPrefers(medium) = %q, want no opinion", got)
	}
}

// An unknown or empty tier is medium, so a corrupt preference cannot change how
// hard the quiz is — the same rule parseReviewQuestions follows for a corrupt
// repertoire, and for the same reason.
func TestAnUnreadableTierIsTheOneThatChangesNothing(t *testing.T) {
	for _, in := range []string{"", "  ", "EASY", "hardest", "nightmare", "0", "random "} {
		if got := normalizeReviewTier(in); got != tierMedium {
			t.Errorf("normalizeReviewTier(%q) = %q, want medium", in, got)
		}
	}
	for _, in := range reviewTiers {
		if got := normalizeReviewTier(in); got != in {
			t.Errorf("normalizeReviewTier(%q) = %q, want it kept", in, got)
		}
	}
}

// WHAT EACH TIER ACTUALLY CHANGES, stated as the rule rather than as the shape of
// the switch: Easy widens nothing and offers fewer choices; Hard gives up
// recognition.
func TestTheTiersDifferWhereTheyClaimTo(t *testing.T) {
	all := []string{dirSource, dirQuote, dirCloze, dirClozeMCQ, dirSpeaker, dirAuthor, dirFlip}

	easy := tierDirections(tierEasy, all)
	if slices.Contains(easy, dirCloze) {
		t.Error("easy offers the typed blank, which is the opposite of a floor")
	}
	if slices.Contains(easy, dirFlip) {
		t.Error("easy offers the self-marked card, which is a different activity rather than an easier one")
	}
	if !slices.Contains(easy, dirClozeMCQ) {
		t.Error("easy dropped the multiple-choice blank, which is the card it is built around")
	}
	if got := tierOptions(tierEasy); got != 2 {
		t.Errorf("tierOptions(easy) = %d, want 2", got)
	}
	// AND THE FLOOR FOLLOWS THE CEILING. Holding easy to speakerMinOptions would
	// refuse every card it is defined by, which is the bug this pairing exists to
	// prevent.
	if tierMinOptions(tierEasy) > tierOptions(tierEasy) {
		t.Errorf("easy refuses at %d options while offering %d — it can never draw a card",
			tierMinOptions(tierEasy), tierOptions(tierEasy))
	}

	hard := tierDirections(tierHard, all)
	for _, d := range []string{dirSource, dirQuote, dirClozeMCQ} {
		if slices.Contains(hard, d) {
			t.Errorf("hard still offers %q, which is recognition with three quarters of the work done", d)
		}
	}
	if !slices.Contains(hard, dirCloze) {
		t.Error("hard dropped the typed blank, which is the card it is built around")
	}
	if got := tierPrefers(tierHard); got != dirCloze {
		t.Errorf("tierPrefers(hard) = %q, want the typed blank weighted up rather than left to the hash", got)
	}
	// The widest blank, whatever the half-life: the tier is the gate, not the age.
	if got := tierClozeThreshold(tierHard, 30); got > reviewMinStability {
		t.Errorf("tierClozeThreshold(hard, 30) = %g, want a gate a new card already passes", got)
	}
	// And easy's is one nothing reaches, so the blank is one word at any age.
	if clozeMaxWordsFor(reviewMaxStability, tierClozeThreshold(tierEasy, 30)) != 1 {
		t.Error("easy allows a multi-word blank on a well-known card")
	}
}

// A TIER NARROWS AND NEVER WIDENS. The reader's own repertoire is the outer
// bound, so a question they turned off stays off at every difficulty — and no
// tier may empty a deck, which is rule 3 of review_questions.go restated where it
// could be broken again.
func TestNoTierWidensOrEmptiesTheReadersOwnRepertoire(t *testing.T) {
	for _, chosen := range [][]string{
		{dirSource, dirQuote, dirCloze, dirClozeMCQ, dirSpeaker, dirAuthor, dirFlip},
		{dirSource, dirQuote},          // recognition only — hard has nothing left
		{dirCloze},                     // typed only — easy has nothing left
		{dirFlip},                      // self-marked only
		{dirClozeMCQ, dirSpeaker},      //
		{dirSource, dirCloze, dirFlip}, //
	} {
		for _, tier := range reviewTiers {
			got := tierDirections(tier, chosen)
			if len(got) == 0 {
				t.Errorf("tier %q emptied a deck of %v", tier, chosen)
			}
			for _, d := range got {
				if !slices.Contains(chosen, d) {
					t.Errorf("tier %q added %q, which the reader had turned off", tier, d)
				}
			}
		}
	}
}

// RANDOM IS PER CARD AND STABLE, which is the whole of what makes it usable: a
// refresh must not reshuffle the difficulty of a card the reader is halfway
// through thinking about, and it has to actually reach all three tiers or it is
// an expensive way of saying "medium".
func TestRandomIsStablePerCardAndReachesEveryTier(t *testing.T) {
	const seed = 20260907
	seen := map[string]int{}
	for id := int64(1); id <= 300; id++ {
		got := tierForCard(tierRandom, kindBook, id, seed)
		if again := tierForCard(tierRandom, kindBook, id, seed); again != got {
			t.Fatalf("card %d drew %q then %q on the same day — a refresh changes the question", id, got, again)
		}
		if got == tierRandom {
			t.Fatalf("card %d resolved to %q, which is a choice about the other three and not one of them", id, got)
		}
		seen[got]++
	}
	for _, want := range []string{tierEasy, tierMedium, tierHard} {
		if seen[want] == 0 {
			t.Errorf("300 cards drew no %q at all: %v", want, seen)
		}
	}
	// A DIFFERENT DAY IS A DIFFERENT DRAW. Otherwise "random" is a fixed
	// per-card tier the reader can never shake off.
	moved := 0
	for id := int64(1); id <= 300; id++ {
		if tierForCard(tierRandom, kindBook, id, seed+1) != tierForCard(tierRandom, kindBook, id, seed) {
			moved++
		}
	}
	if moved == 0 {
		t.Error("no card changed tier between two days — random is frozen per card")
	}
	// The three fixed tiers ignore the hash entirely.
	for _, fixed := range []string{tierEasy, tierMedium, tierHard} {
		if got := tierForCard(fixed, kindBook, 42, seed); got != fixed {
			t.Errorf("tierForCard(%q) = %q — a chosen tier is not a suggestion", fixed, got)
		}
	}
}

// AND IT REACHES THE DECK, which is a different claim from any of the above and
// is the one that would be silently false if the preference never arrived at
// buildQuestion. Asserted over HTTP, on the thing a reader would see: how many
// choices the card offers.
func TestTheTierPreferenceReachesTheDeck(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, ids := seedReviewBook(t, c, "Emma", 6)
	seedDistractorBook(t, srv, c, "Dune")
	seedDistractorBook(t, srv, c, "Persuasion")
	seedDistractorBook(t, srv, c, "Villette")
	ageSeededItems(t, srv)
	_ = ids

	widest := func(tier string) int {
		t.Helper()
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srTier": tier}, http.StatusOK)
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
		n := 0
		for _, it := range deck.Items {
			if len(it.Options) > n {
				n = len(it.Options)
			}
		}
		if len(deck.Items) == 0 {
			t.Fatalf("tier %q served an empty deck, so this measured nothing", tier)
		}
		return n
	}
	if got := widest(tierEasy); got > 2 {
		t.Errorf("an easy round offered a card with %d choices, want at most 2 — the preference is not reaching buildQuestion", got)
	}
	if got := widest(tierMedium); got != quizOptions {
		t.Errorf("a medium round offered at most %d choices, want %d — medium must be exactly what the quiz has always done", got, quizOptions)
	}
}
