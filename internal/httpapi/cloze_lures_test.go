package httpapi

// THE WRONG ANSWERS ON A FILL-IN-THE-BLANK CARD, AND THE TWO THINGS THEY MUST BE.
//
// The card hides a phrase and offers four. `docs/plans/spaced-repetition-difficulty.md`
// §2 asks for the wrong three to be CLOSE — "rank those by surface similarity
// (length, initial letter, shared stem) as well as by parent-work similarity" —
// because a competitive alternative is what makes the reader read both options
// and retrieve why one is wrong (Little, Bjork, Bjork & Angello, 2012). Options
// that merely have the right word count are chosen by the shape of the sentence
// rather than by remembering the line.
//
// AND THE SECOND THING IS NOT IN THE PLAN AT ALL: a wrong option must not be a
// phrase the TYPED version of the same card would accept. The two directions ask
// about one span, and if the multiple-choice one offers a synonym of the answer as
// a wrong option, a reader who picks the words the typed card would have marked
// right is told they forgot the line. That is two cards over one span disagreeing
// about what the answer is.
//
// NEITHER TEST KNOWS HOW THE RANKING IS DONE. The first asks whether the offered
// options resemble the answer, using the repo's own stem fold — the same one
// clozeJudge uses — rather than the scorer the ranking is written with. The second
// asks the GRADER about every option, which is the only authority on whether a
// phrase is the answer.

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// seedVocabularyBook adds a book whose quote is built from `words` in some order,
// so that whatever span the card's own quote yields, this book can yield a phrase
// sharing a stem with it.
func seedVocabularyBook(t *testing.T, c *testClient, title, author, quote string) {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": title, "author": author}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": quote}, http.StatusCreated)
}

// clozeMCQCards asks for a deck of nothing but multiple-choice blanks.
func clozeMCQCards(t *testing.T, c *testClient) []reviewCard {
	t.Helper()
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{
		"srDaily": 10, "srTier": tierMedium,
		"srQuestions": `{"daily":["cloze-mcq"]}`}, http.StatusOK)
	var out []reviewCard
	for _, card := range decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).Items {
		if card.Direction == dirClozeMCQ && len(card.Options) > 1 {
			out = append(out, card)
		}
	}
	return out
}

// parkAt puts one item at a chosen half-life, reviewed long enough ago to be due.
//
// IT IS HOW A MULTI-WORD BLANK IS REACHED AT ALL. clozeMaxWordsFor gates the wider
// span on the stored half-life (30 days by default), so a freshly seeded card can
// only ever hide one word — and at one word the strongest of the plan's three
// signals cannot be measured, because a single word that shares the answer's stem
// IS the answer and the grader refuses it.
func parkAt(t *testing.T, srv *Server, kind string, id int64, stability float64) {
	t.Helper()
	if _, err := srv.Store.DB.Exec(`INSERT INTO item_reviews
		(kind, item_id, stability, review_count, last_result, last_reviewed_at, last_touched_at)
		VALUES (?, ?, ?, 3, 'got', datetime('now', '-400 days'), datetime('now', '-400 days'))`,
		kind, id, stability); err != nil {
		t.Fatal(err)
	}
}

// THE INITIAL LETTER, at the width every new card is asked at.
//
// A ONE-WORD BLANK IS THE COMMON CASE and it is the case where "shared stem" is
// unreachable: at one word, a phrase sharing the answer's stem is the answer, and
// attachClozeMCQ refuses it. So what is left to make a one-word option close is
// its first letter and its length, and this is the fixture that can tell the
// difference — every content word of the card's own quote begins with the same
// letter, so whatever span is picked, the answer does too.
func TestAOneWordBlankOffersWordsThatStartLikeTheAnswer(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	seedVocabularyBook(t, c, "Dune", "Frank Herbert",
		"the sleeper stirs, the spice settles, and the sand shifts silently")
	// THREE BOOKS OF OTHER S-WORDS, so there are enough same-initial phrases to
	// fill every wrong slot without any of them being the answer.
	//
	// BY THE CARD'S OWN AUTHOR, which is the realistic case and NOT a guard for the
	// same-author cap — a claim written here first and disproved by mutating it.
	// The cap only changes the ORDER the candidates arrive in, and the surface sort
	// below re-orders the whole pool, so a demoted candidate still wins on
	// resemblance and this test passes either way. The cap's reach into the phrase
	// lures is observable only in a library with more than clozeLurePool usable
	// quotes, where the bound truncates the list before the sort sees it. What
	// keeps it out is structural rather than tested: attachClozeMCQ no longer takes
	// an allowance to pass, so there is no parameter to thread one into.
	for i, w := range []string{
		"sailors sing softly, sirens summon storms, and September sighs",
		"the surgeon sharpened scissors, sealed the satchel, and slept",
		"seven sparrows scattered, a shutter slammed, and snow settled",
	} {
		seedVocabularyBook(t, c, fmt.Sprintf("Echo %d", i), "Frank Herbert", w)
	}
	// AND TWELVE WITH NO S-WORD IN THEM. Without the ranking the options come from
	// these, because they are most of the pool.
	for i, w := range []string{
		"knitting bicycles rumble quietly through frozen orchards",
		"vinegar puddings quiver under municipal lamplight tonight",
		"eleven judges yawned politely, then bought umbrellas",
		"my grandmother pickled onions every rainy Tuesday morning",
		"tin whistles echo in an empty railway waiting room",
		"nobody counted the pigeons on that iron bridge",
		"bright yellow tramcars grumble uphill towards evening markets",
		"her typewriter jammed, again, halfway through page nine",
		"cold porridge, burnt toast, and one indifferent egg",
		"rubber boots creaked along the linoleum hospital corridor",
		"three violins, badly tuned, opened the village concert",
		"a marmalade cat merely blinked once, then left the room",
	} {
		seedVocabularyBook(t, c, fmt.Sprintf("Far %d", i), fmt.Sprintf("Author F%d", i), w)
	}
	ageSeededItems(t, srv)

	cards := clozeMCQCards(t, c)
	checked, alike, total := 0, 0, 0
	for _, card := range cards {
		if card.Title != "Dune" {
			continue // an Echo or Far card's own answer is not what this measures
		}
		answer := strings.Fields(clozeNormalise(card.Options[card.Answer]))
		if len(answer) != 1 {
			t.Fatalf("the card hid %d words, want 1 — this case is about the common width", len(answer))
		}
		checked++
		for i, opt := range card.Options {
			if i == card.Answer {
				continue
			}
			total++
			w := strings.Fields(clozeNormalise(opt))
			if len(w) == 1 && strings.HasPrefix(w[0], answer[0][:1]) {
				alike++
			}
		}
	}
	if checked == 0 {
		t.Fatal("no Dune card reached the deck, so nothing here was measured")
	}
	if alike != total {
		t.Errorf("%d of %d wrong options begin with a different letter from the answer, though three "+
			"books of same-letter words were on the shelf — a one-word option is chosen by its shape "+
			"when nothing else about it resembles the answer", total-alike, total)
	}
}

// AND THE SHARED STEM, AT THE WIDTH WHERE IT MEANS SOMETHING.
//
// It is the strongest of the plan's three signals and the reason it exists: "must
// flow" beside "must awaken" makes the reader read both. It can only be measured
// on a multi-word blank, so the card is parked at a half-life past the wider-span
// gate rather than seeded fresh.
func TestAWiderBlankOffersPhrasesSharingTheAnswersWords(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	const vocab = "the sleeper must awaken and the spice must flow across the desert"
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated))
	row := decode[annotationRow](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book.ID, "quote": vocab}, http.StatusCreated))
	// THREE BOOKS OF THE SAME WORDS IN OTHER ORDERS, so whatever three-word span is
	// picked, a phrase sharing one of its words but not all of them exists.
	// SIX, NOT THREE, and the count is load-bearing. Each source quote yields ONE
	// candidate phrase, and a candidate the grader would accept as the answer is
	// thrown away — so three books for three slots leaves nothing when one is
	// rejected, and the third option came from a book sharing no vocabulary at all.
	// That is what this test caught on its first run.
	for i, w := range []string{
		"the desert sleeper will flow, awaken, and cross the spice",
		"awaken the spice, sleeper, across the desert the flow must go",
		"flow across the sleeper, awaken the desert, and the spice must wait",
		"the spice sleeper, awaken, must cross the flowing desert alone",
		"across the flowing spice the sleeper will awaken in a desert",
		"a desert must awaken; the spice sleeper flows across it",
	} {
		// The card's own author again — see the note in the one-word case for why
		// that is realism and not a guard for the same-author cap.
		seedVocabularyBook(t, c, fmt.Sprintf("Echo %d", i), "Frank Herbert", w)
	}
	for i, w := range []string{
		"knitting bicycles rumble quietly through frozen orchards at dawn",
		"vinegar puddings quiver under municipal lamplight every Tuesday",
		"eleven judges yawned politely, then bought umbrellas for nobody",
		"her typewriter jammed, again, halfway through page nine tonight",
		"cold porridge, burnt toast, and one indifferent egg for breakfast",
		"three violins, badly tuned, opened the village concert regardless",
	} {
		seedVocabularyBook(t, c, fmt.Sprintf("Far %d", i), fmt.Sprintf("Author F%d", i), w)
	}
	ageSeededItems(t, srv)
	parkAt(t, srv, kindBook, row.ID, 60) // past clozeMultiWordFrom, and due

	var card *reviewCard
	for _, got := range clozeMCQCards(t, c) {
		if got.Kind == kindBook && got.ID == row.ID {
			card = &got
			break
		}
	}
	if card == nil {
		t.Fatal("the parked card did not reach the deck, so nothing here was measured")
	}
	answer := strings.Fields(clozeNormalise(card.Options[card.Answer]))
	if len(answer) < 2 {
		t.Fatalf("the parked card hid %d word(s) (%q) — this case needs the wider span",
			len(answer), card.Options[card.Answer])
	}
	stems := map[string]bool{}
	for _, w := range answer {
		stems[clozeStemFold(w)] = true
	}
	shared, total := 0, 0
	for i, opt := range card.Options {
		if i == card.Answer {
			continue
		}
		total++
		for _, w := range strings.Fields(clozeNormalise(opt)) {
			if stems[clozeStemFold(w)] {
				shared++
				break
			}
		}
	}
	if shared != total {
		t.Errorf("%d of %d wrong options share no word with the answer %q, though three books of its "+
			"own vocabulary were on the shelf — the closest lure a library can offer is a phrase built "+
			"from the answer's own words, and it is not being reached",
			total-shared, total, card.Options[card.Answer])
	}
}

// AND NO OPTION IS ONE THE TYPED CARD WOULD HAVE ACCEPTED.
//
// A UNIVERSAL PROPERTY, over whatever deck the fixture produces: for a
// multiple-choice blank the right answer IS one of the options, so the grader can
// be asked about every other one with nothing but the payload. It needs no
// special fixture and cannot pass by luck of a seed.
func TestNoWrongPhraseOnABlankCardWouldBeGradedRight(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	// EVERY CONTENT WORD OF THE CARD INFLECTS CLEANLY, so whatever span is picked
	// the library below holds a form of it that the grader gives FULL CREDIT to —
	// clozeSameWord forgives a plural and a tense, "the reader who typed
	// 'fortunes' for 'fortune' had the word". That is the second right answer this
	// guards against, and it is the shape that can reach the top of the ranking:
	// an inflection shares the answer's stem, which is the strongest signal the
	// lure scorer has.
	//
	// THE FIXTURE IS WHAT MAKES THIS A REAL GUARD, and the first version was not.
	// It used the app's synonym pairs — almost/nearly, whole/entire — which the
	// grader also accepts, but no pair shares an initial or a stem, so a synonym
	// candidate ranked no higher than any stranger and was never chosen anyway.
	// The test passed with the fix REVERTED, which is the only way to find that
	// out and the reason the mutation was run.
	seedVocabularyBook(t, c, "Dune", "Frank Herbert",
		"the sleeper awakens, the harvest begins, the mountain remembers, the desert waits")
	for i, w := range []string{
		"the sleepers awaken, the harvests begin, the mountains remember, the deserts wait",
		"deserts wait while sleepers awaken; mountains remember every harvest",
		"harvests begin, mountains remember, deserts wait, and sleepers awaken",
		"remember the mountains, wait in the deserts, awaken the sleepers, begin",
		"awaken, sleepers; begin, harvests; remember, mountains; wait, deserts",
		"the deserts remember what the sleepers awaken and the harvests begin",
		"mountains wait, deserts remember, sleepers begin, and harvests awaken",
		"wait for the harvests, remember the sleepers, awaken in the mountains",
	} {
		seedVocabularyBook(t, c, fmt.Sprintf("Twin %d", i), fmt.Sprintf("Author T%d", i), w)
	}
	// AND SIX SHARING NOTHING, so the card still has three honest wrong answers to
	// offer once every inflection is refused. Without them the card would be
	// dropped for want of options and this would measure an empty deck.
	for i, w := range []string{
		"knitting bicycles rumble quietly through frozen orchards at dawn",
		"vinegar puddings quiver under municipal lamplight every Tuesday",
		"eleven judges yawned politely, then bought umbrellas for nobody",
		"her typewriter jammed, again, halfway through page nine tonight",
		"cold porridge, burnt toast, and one indifferent egg for breakfast",
		"three violins, badly tuned, opened the village concert regardless",
	} {
		seedVocabularyBook(t, c, fmt.Sprintf("Far %d", i), fmt.Sprintf("Author F%d", i), w)
	}
	ageSeededItems(t, srv)

	cards := clozeMCQCards(t, c)
	if len(cards) == 0 {
		t.Fatal("the deck served no multiple-choice blanks, so nothing here was measured")
	}
	checked := 0
	for _, card := range cards {
		answer := card.Options[card.Answer]
		for i, opt := range card.Options {
			if i == card.Answer {
				continue
			}
			checked++
			if got := clozeJudge(answer, opt); got != clozeMiss {
				t.Errorf("card %s:%d offers %q as a wrong answer beside %q, and the grader calls it %v — "+
					"a reader who picks the words the typed version of this card would accept is told "+
					"they forgot the line", card.Kind, card.ID, opt, answer, got)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no card offered a wrong answer, so nothing here was measured")
	}
}

// BREADTH BEATS REPETITION, which is the one property of the lure scale that no
// deck can show.
//
// A LIBRARY CANNOT BE MADE TO CHOOSE BETWEEN THESE TWO PHRASES. Both would have to
// exist, in works of equal similarity, with the same word count as the answer and
// with clozePhraseOf cutting exactly them out — so the endpoint tests above pass
// whether the scale counts distinct stems or occurrences, which a mutation proved.
// It is still a claim the scale makes in its own comment, and this is the level it
// can be asked at.
func TestARepeatedWordResemblesTheAnswerLessThanThreeDifferentOnes(t *testing.T) {
	const answer = "spice must flow"
	cases := []struct{ name, closer, further string }{
		{"three of the answer's words beat one said three times",
			"spice must flow", "spice spice spice"},
		{"two beat one repeated", "the spice flow", "flow flow flow"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			near, far := clozeSurfaceScore(answer, tc.closer), clozeSurfaceScore(answer, tc.further)
			if near <= far {
				t.Errorf("%q scores %d against %q's %d — a lure that says one of the answer's words "+
					"over and over resembles it LESS than one carrying several of them, and scoring "+
					"per occurrence rather than per distinct stem gets that backwards",
					tc.closer, near, tc.further, far)
			}
		})
	}
}
