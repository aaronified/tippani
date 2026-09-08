package httpapi

import (
	"net/http"
	"slices"
	"strings"
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

// EASY'S WRONG ANSWERS ARE THE FAR ONES, ASKED OF THE DECK RATHER THAN OF A
// FUNCTION.
//
// The first version of this called rankWorks directly — a function whose
// signature the fix had just invented — which is precisely what the standing
// test rule forbids: "a test writer shouldn't even know about the fix". It
// passed while a WHOLE SECOND PATH stayed wrong, because attachSpeaker does not
// rank by distractorScore at all: it fills from the answer's own cast, so an easy
// speaker card carried the single closest lure in the library and was harder than
// medium, under five documents saying the opposite.
//
// So this asks the endpoint. The library is two clusters — one film and one
// author whose works belong together, and a set of unrelated works — and the rule
// is the same whichever direction the card turns out to be: at EASY no wrong
// answer may come from the answer's own cluster, and at MEDIUM the close ones are
// what the deck is for.
func TestEasyOffersWrongAnswersFromOutsideTheAnswersOwnWork(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	// THE NEAR CLUSTER: two Austen books, so a same-author lure exists to be
	// avoided or reached for.
	near := map[string]bool{}
	for _, w := range []struct{ title, author string }{{"Emma", "Austen"}, {"Persuasion", "Austen"}} {
		near[w.title] = true
		book := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": w.title, "author": w.author}, http.StatusCreated))
		for i := 0; i < 3; i++ {
			c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID,
				"quote": w.title + " line " + itoa(int64(i)) + ": the sleeper must awaken and the spice must flow"},
				http.StatusCreated)
		}
	}
	// THE FAR CLUSTER: unrelated works by other people.
	for _, w := range []struct{ title, author string }{
		{"Dune", "Herbert"}, {"Neuromancer", "Gibson"}, {"Villette", "Bronte"},
	} {
		book := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": w.title, "author": w.author}, http.StatusCreated))
		c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID,
			"quote": w.title + " line: a different sentence entirely about other things"}, http.StatusCreated)
	}
	ageSeededItems(t, srv)

	// "Which book is this from?" alone, so every card has options and the
	// clusters are visible in them. A deck of typed blanks would measure nothing.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"srQuestions": `{"daily":["source"]}`}, http.StatusOK)

	offers := func(tier string) (fromNear, cards int) {
		t.Helper()
		c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srTier": tier}, http.StatusOK)
		deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
		for _, it := range deck.Items {
			if len(it.Options) == 0 {
				continue
			}
			cards++
			for i, o := range it.Options {
				if i == it.Answer {
					continue
				}
				if near[o] && near[it.Title] {
					fromNear++
				}
			}
		}
		return
	}

	easyNear, easyCards := offers(tierEasy)
	if easyCards == 0 {
		t.Fatal("an easy deck with no option-bearing card measures nothing")
	}
	if easyNear != 0 {
		t.Errorf("an easy round offered %d wrong answers from the answer's own cluster — "+
			"easy is supposed to keep them far apart, which is what five documents say", easyNear)
	}

	medNear, medCards := offers(tierMedium)
	if medCards == 0 {
		t.Fatal("a medium deck with no option-bearing card measures nothing")
	}
	if medNear == 0 {
		t.Error("a medium round offered no close wrong answer at all — competitive lures are " +
			"what medium is, and a test where neither tier reaches them proves nothing about either")
	}
}

// AND THE SAME RULE ON THE PATH THAT HAS NO SCORE TO INVERT. attachSpeaker ranks
// by membership of the answer's own cast rather than by distractorScore, so
// "far" there means looking outside the work first — a second place the same
// inversion has to be made, and the one the endpoint test above would catch only
// when the deck happened to serve a speaker card.
func TestAnEasySpeakerCardLooksOutsideTheAnswersOwnFilm(t *testing.T) {
	own := workRef{key: "screen:1", kind: kindScreen, title: "Heat", cast: heatCast}
	others := []workRef{
		{key: "screen:2", kind: kindScreen, title: "Stalker", cast: []string{"Alexander Kaidanovsky", "Anatoly Solonitsyn"}},
		{key: "screen:3", kind: kindScreen, title: "Solaris", cast: []string{"Donatas Banionis", "Natalya Bondarchuk"}},
	}
	p := quizPools{byKey: map[string]workRef{own.key: own}, works: append([]workRef{own}, others...)}
	inHeat := map[string]bool{}
	for _, a := range heatCast {
		inHeat[a] = true
	}

	build := func(tier string) []string {
		t.Helper()
		card := reviewCard{Kind: kindScreen, ID: 1, Direction: dirSpeaker,
			Quote: "Don't let yourself get attached", Title: "Heat", Character: "Neil", Actor: "Robert De Niro"}
		if !attachSpeaker(&card, "screen:1", p, 99, tier) {
			t.Fatalf("%s: no speaker card from a five-strong cast", tier)
		}
		return card.Options
	}

	for i, o := range build(tierEasy) {
		if o == "Robert De Niro" {
			continue // the answer itself
		}
		if inHeat[o] {
			t.Errorf("an easy speaker card offered %q (option %d) — a face from the answer's own "+
				"billing is the closest lure in the library, not the farthest", o, i)
		}
	}
	// And medium still reaches for the same film, which is what makes it a
	// question about the film rather than about familiarity.
	sameFilm := 0
	for i, o := range build(tierMedium) {
		if o != "Robert De Niro" && inHeat[o] {
			sameFilm++
			_ = i
		}
	}
	if sameFilm == 0 {
		t.Error("a medium speaker card offered nobody from the answer's own film — that is the ranking, " +
			"and losing it would make medium easier than it has always been")
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

// RANDOM ON PRACTICE WAS FROZEN FOR EVER, and it is the DECK AND THE GRADER
// AGREEING that fixes it rather than variety for its own sake.
//
// Practice passed seed 0 to buildQuestion, so the day term vanished from
// tierForCard's hash and a card drew the same tier every round, for ever. The
// first repair here drew at random per round — and this test asserted exactly
// that, which was WRONG in a way the test could not see: a tier nothing can
// recompute is a tier the ANSWER path cannot know, and the answer path has to
// know it to grade a typed blank against the width the card was built at. A
// random tier makes every Hard cloze on Practice ungradeable.
//
// So the property is not "it varies between rounds". It is that the practice
// deck and the answer path reach the SAME tier from the same inputs — which
// tierDaySeed gives, varying by day rather than by request. Asserted through the
// option count, which is what a reader sees of the tier.
func TestPracticeUsesTheTierTheAnswerPathWillRecompute(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	for _, w := range []struct{ title, author string }{
		{"Emma", "Austen"}, {"Dune", "Herbert"}, {"Neuromancer", "Gibson"}, {"Villette", "Bronte"},
	} {
		book := decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": w.title, "author": w.author}, http.StatusCreated))
		for i := 0; i < 4; i++ {
			c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID,
				"quote": w.title + " line " + itoa(int64(i)) + ": the sleeper must awaken and the spice must flow"},
				http.StatusCreated)
		}
	}
	ageSeededItems(t, srv)
	// "Which book?" only, so every card carries options and the tier is legible in
	// how many there are — two at easy, four otherwise.
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srTier": tierRandom, "srQuestions": `{"practice":["source"]}`}, http.StatusOK)

	deck := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if len(deck.Items) == 0 {
		t.Fatal("an empty practice deck measures nothing")
	}
	checked, easies := 0, 0
	for _, it := range deck.Items {
		if len(it.Options) == 0 {
			continue
		}
		checked++
		// What the ANSWER path would work out, from the card and nothing else.
		want := tierOptions(tierForCard(tierRandom, it.Kind, it.ID, tierDaySeed()))
		if len(it.Options) != want {
			t.Errorf("practice card %d offered %d choices; the answer path resolves it to a tier "+
				"offering %d — the two disagree about which tier this card was asked at",
				it.ID, len(it.Options), want)
		}
		if len(it.Options) == 2 {
			easies++
		}
	}
	if checked == 0 {
		t.Fatal("no option-bearing card in the practice deck, so this measured nothing")
	}
	// AND RANDOM IS ACTUALLY RANDOM HERE. With seed 0 the hash still produced a
	// spread, so a distribution check alone would not have caught the freeze —
	// but a deck of one tier would mean Random had stopped reaching the others.
	if easies == 0 || easies == checked {
		t.Errorf("all %d practice cards drew the same difficulty (%d easy) — Random is not reaching "+
			"every tier on this path", checked, easies)
	}
}

// A HARD BLANK, TYPED BACK, MUST BE MARKED RIGHT.
//
// THE BUG THIS EXISTS FOR, and it corrupted schedules rather than screens. The
// card is BUILT through tierClozeThreshold — at Hard the gate opens at once, so
// the blank is the widest the quote allows — and the answer path graded against
// `tuning.ClozeWords` directly, which at a 7-day half-life is one word. So the
// deck served a three-word blank, the reader typed exactly those three words, and
// the server recorded "forgot" and lapsed the card while revealing a one-word
// answer still visible in the quote beside it.
//
// NO TEST IN THIS PACKAGE ANSWERED A CLOZE AT ANY TIER — review_tier_test.go
// contained no `attempt` at all — which is why every guard passed. This one plays
// the whole round: read the blank the deck actually served, type back what it
// hid, and read the grade.
func TestATypedBlankIsGradedAtTheWidthItWasAskedAt(t *testing.T) {
	for _, tier := range []string{tierHard, tierMedium} {
		t.Run(tier, func(t *testing.T) {
			srv := newTestServer(t)
			c := signupAdmin(t, srv.Handler())
			seedReviewBook(t, c, "Dune", 3)
			seedDistractorBook(t, srv, c, "Emma")
			ageSeededItems(t, srv)
			// The typed blank only, so every card is the one under test.
			c.mustDo("PUT", "/auth/me/preferences", map[string]any{
				"srTier": tier, "srQuestions": `{"daily":["cloze"]}`}, http.StatusOK)

			deck := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
			var card *reviewCard
			for i := range deck.Items {
				if deck.Items[i].Direction == dirCloze {
					card = &deck.Items[i]
					break
				}
			}
			if card == nil {
				t.Fatalf("%s: the deck served no typed blank, so this measured nothing: %+v", tier, deck.Items)
			}
			if !strings.Contains(card.Quote, clozeBlank) {
				t.Fatalf("%s: the card carries no blank: %q", tier, card.Quote)
			}

			// WHAT THE BLANK HID, worked out from the card and the source text
			// rather than from the function under test: the words the served quote
			// is missing, in order, are the answer.
			full, err := srv.itemText(kindBook, card.ID)
			if err != nil {
				t.Fatal(err)
			}
			head, tail, _ := strings.Cut(card.Quote, clozeBlank)
			hidden := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(full, head), tail))
			if hidden == "" {
				t.Fatalf("%s: could not read the hidden span back out of %q vs %q", tier, card.Quote, full)
			}

			res := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
				"kind": kindBook, "id": card.ID, "mode": "daily", "result": "got", "attempt": hidden}, 200))
			if res.Result != "got" {
				t.Errorf("%s: typed back exactly the %d word(s) the card hid (%q) and was graded %q — "+
					"the answer path is grading against a different width from the one the deck asked at",
					tier, len(strings.Fields(hidden)), hidden, res.Result)
			}
			if res.Answer != hidden {
				t.Errorf("%s: the card hid %q and the reveal says %q", tier, hidden, res.Answer)
			}
		})
	}
}

// AND THE TIER A CARD WAS BUILT AT IS RECOVERABLE AT ANSWER TIME, which is the
// property the grade above depends on and the reason Practice cannot draw its
// tier at random: a tier nothing can recompute is a tier the answer path cannot
// know. Both endpoints reach it from the same inputs, so tierDaySeed is the only
// day either of them may use for this.
func TestTheTierIsRecomputableFromTheCardAlone(t *testing.T) {
	seed := tierDaySeed()
	if seed == 0 {
		t.Fatal("tierDaySeed is 0, which is the value that froze Random on the practice path")
	}
	for id := int64(1); id <= 50; id++ {
		first := tierForCard(tierRandom, kindBook, id, seed)
		if again := tierForCard(tierRandom, kindBook, id, tierDaySeed()); again != first {
			t.Fatalf("card %d resolves to %q from the deck and %q from the answer path", id, first, again)
		}
	}
}
