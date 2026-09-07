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

// ---- the four things the third rater pass found ------------------------------

// EASY'S DISTRACTORS ARE FAR, WHICH FIVE DOCUMENTS CLAIMED AND NOTHING DID.
//
// distractorScore rewards a candidate for sharing a medium, an author, a series
// or a genre, so the best distractor at medium is the one hardest to tell from
// the answer. Easy is defined by the opposite, and the copy under the control
// says so in as many words. It shipped ranking the same way medium does, which
// made Easy a two-option card with the SINGLE HARDEST lure in the library — the
// exact opposite of what the reader was promised, and harder than medium.
//
// Asserted on the scale rather than on the sort: the closest work must come last
// for easy and first for everything else.
func TestEasyReachesForTheFarthestWrongAnswer(t *testing.T) {
	own := workRef{key: "book:1", kind: kindBook, title: "Emma", author: "Austen", genres: map[string]bool{"novel": true}}
	near := workRef{key: "book:2", kind: kindBook, title: "Persuasion", author: "Austen", genres: map[string]bool{"novel": true}}
	far := workRef{key: "screen:9", kind: kindScreen, title: "Stalker", genres: map[string]bool{"science fiction": true}}
	pool := []workRef{near, far}

	if distractorScore(own, near) <= distractorScore(own, far) {
		t.Fatal("the fixture is wrong: `near` must score above `far` or this measures nothing")
	}
	for _, tc := range []struct {
		tier  string
		first string
	}{
		{tierEasy, far.key},
		{tierMedium, near.key},
		{tierHard, near.key},
	} {
		got := rankWorks(own, pool, seededRand(7), tc.tier)
		if got[0].key != tc.first {
			t.Errorf("%s ranks %q first, want %q", tc.tier, got[0].key, tc.first)
		}
	}
}

// AND THE HASH'S PICK GOES THROUGH THE TIER'S FILTER.
//
// `preferred` arrives from dailyDirection, which knows the reader's repertoire
// and nothing about the tier. It was tried FIRST and unfiltered, so a Hard round
// served a deck of nothing but recognition cards whenever the typed blank was
// switched off: tierDirections had removed "which book?" and the next line asked
// it anyway. Over HTTP, because that is the only place the two lists meet.
func TestAHardRoundNeverServesRecognition(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	// AUTHORS, because with the typed blank switched off `author` is the only
	// direction hard leaves a book — seedReviewBook posts no author, and a deck
	// with nothing askable would make this test pass by serving nothing.
	for _, w := range []struct{ title, author string }{
		{"Emma", "Austen"}, {"Dune", "Herbert"}, {"Persuasion", "Austen"}, {"Villette", "Bronte"},
	} {
		book := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": w.title, "author": w.author}, http.StatusCreated))
		for i := 0; i < 2; i++ {
			c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID,
				"quote": w.title + " line " + itoa(int64(i)) + ": the sleeper must awaken and the spice must flow"},
				http.StatusCreated)
		}
	}
	ageSeededItems(t, srv)

	// The typed blank OFF is the case that broke it: hard's own first choice is
	// gone, so whatever the hash picked used to go through unexamined.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier":      tierHard,
		"srQuestions": `{"daily":["source","quote","cloze-mcq","speaker","author"]}`,
	}, http.StatusOK)

	deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(deck.Items) == 0 {
		t.Fatal("an empty deck measures nothing")
	}
	for _, it := range deck.Items {
		switch it.Direction {
		case dirSource, dirQuote, dirClozeMCQ:
			t.Errorf("a hard round served %q for card %d — recognition is what hard gives up, "+
				"and the tier's filter is being bypassed", it.Direction, it.ID)
		}
	}
}

// PRACTICE IS THE OTHER DECK AND IT WAS UNGUARDED. Mutating the tier at the
// practice call site left the whole suite green, because the reach test only ever
// asked /review/daily — so half the feature could have been unwired.
func TestTheTierReachesPracticeToo(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	seedReviewBook(t, c, "Emma", 6)
	seedDistractorBook(t, srv, c, "Dune")
	seedDistractorBook(t, srv, c, "Persuasion")
	seedDistractorBook(t, srv, c, "Villette")
	ageSeededItems(t, srv)

	// ONE DIRECTION, AND ONE THAT HAS OPTIONS. A practice deck is mostly flip and
	// typed-cloze cards, both of which carry no options at all, so measuring the
	// widest card across a default practice round measures zero at every tier —
	// which would have passed while proving nothing.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"srQuestions": `{"practice":["source"]}`}, http.StatusOK)

	widest := func(tier string) int {
		t.Helper()
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srTier": tier}, http.StatusOK)
		deck := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
		if len(deck.Items) == 0 {
			t.Fatalf("tier %q served an empty practice deck, so this measured nothing", tier)
		}
		n := 0
		for _, it := range deck.Items {
			if len(it.Options) > n {
				n = len(it.Options)
			}
		}
		return n
	}
	if got := widest(tierEasy); got > 2 {
		t.Errorf("an easy practice round offered a card with %d choices, want at most 2 — "+
			"the preference is not reaching buildQuestion on the practice path", got)
	}
	if got := widest(tierMedium); got != quizOptions {
		t.Errorf("a medium practice round offered at most %d choices, want %d", got, quizOptions)
	}
}

// AND THE PERSON CARDS COUNT THEIR OPTIONS THE SAME WAY. attachSpeaker and
// attachAuthor go through personChoices rather than attachMCQ, so tierOptions
// reaching one and not the other would leave "who said this?" at four choices in
// an easy round with nothing to show it.
func TestAPersonCardHonoursTheTiersOptionCount(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: heatCast}
	p := quizPools{byKey: map[string]workRef{"screen:1": own}, works: []workRef{own}}
	for _, tc := range []struct {
		tier string
		want int
	}{{tierEasy, 2}, {tierMedium, quizOptions}, {tierHard, quizOptions}} {
		card := reviewCard{Kind: kindScreen, ID: 1, Direction: dirSpeaker,
			Quote: "Don't let yourself get attached", Title: "Heat", Character: "Neil", Actor: "Robert De Niro"}
		if !attachSpeaker(&card, "screen:1", p, 99, tc.tier) {
			t.Fatalf("%s: no speaker card from a five-strong cast", tc.tier)
		}
		if len(card.Options) != tc.want {
			t.Errorf("%s speaker card offered %d faces, want %d", tc.tier, len(card.Options), tc.want)
		}
	}
}
