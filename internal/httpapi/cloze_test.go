package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// Cloze cards — blank a phrase out of the quote and type it back.
//
// Three claims are worth pinning, and each fails silently if it breaks: the mask
// is stable per card and independent of the day (or the grader recomputes a
// different blank from the one the reader saw), the answer never reaches the
// client before the attempt is in, and the English stopword list is never
// applied to text it cannot read.

const clozeQuote = "It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife"

func TestClozeSpanIsStableAndIndependentOfTheDay(t *testing.T) {
	masked, answer, ok := clozeSpan(clozeQuote, kindBook, 42, clozeMaxWords)
	if !ok {
		t.Fatal("no span for a long English quote")
	}
	// The blank is IN the text and the answer is OUT of it.
	if !strings.Contains(masked, clozeBlank) {
		t.Fatalf("masked text carries no blank: %q", masked)
	}
	if strings.Contains(masked, answer) {
		t.Fatalf("the answer is still in the masked text: answer=%q masked=%q", answer, masked)
	}
	// Same card, same blank — every time, on every device. clozeSpan takes no
	// day seed at all, which is what makes the grading endpoint able to
	// reconstruct the question the reader actually saw.
	for i := 0; i < 5; i++ {
		m2, a2, _ := clozeSpan(clozeQuote, kindBook, 42, clozeMaxWords)
		if m2 != masked || a2 != answer {
			t.Fatalf("span moved between calls: %q/%q then %q/%q", masked, answer, m2, a2)
		}
	}
	// A different card gets its own.
	if _, a3, _ := clozeSpan(clozeQuote, kindBook, 43, clozeMaxWords); a3 == "" {
		t.Fatal("a different id produced no span at all")
	}
}

func TestClozeNeverBlanksStopwordsOrTheWholeQuote(t *testing.T) {
	for _, id := range []int64{1, 2, 3, 5, 8, 13, 21, 34} {
		masked, answer, ok := clozeSpan(clozeQuote, kindBook, id, clozeMaxWords)
		if !ok {
			t.Fatalf("id %d: no span", id)
		}
		for _, w := range strings.Fields(strings.ToLower(answer)) {
			if clozeStopwords[strings.Trim(w, ".,;:!?'\"")] {
				t.Errorf("id %d blanked the stopword %q (answer %q)", id, w, answer)
			}
		}
		if n := len(strings.Fields(answer)); n > clozeMaxWords {
			t.Errorf("id %d blanked %d words, cap is %d", id, n, clozeMaxWords)
		}
		if len([]rune(masked)) < clozeMinContext {
			t.Errorf("id %d left almost nothing to read: %q", id, masked)
		}
	}
}

// THE GATE THE PLAN GOT WRONG. It said a quote in another script "simply will
// not produce a good span". It produces a confident one: an English stopword
// list matches zero Devanagari or Cyrillic tokens, so every token reads as a
// content word and the selector blanks a phrase out of text it understands
// nothing about.
func TestClozeIsOfferedOnlyWhereTheStopwordListMeansSomething(t *testing.T) {
	cases := []struct {
		name string
		text string
		want bool
	}{
		{"english", clozeQuote, true},
		{"bengali", "যে জীবন ফড়িঙের দোয়েলের মানুষের সাথে তার হয়নাকো দেখা", false},
		{"hindi", "जो बीत गई सो बात गई जीवन में एक सितारा था माना वह बेहद प्यारा था", false},
		{"russian", "Все счастливые семьи похожи друг на друга каждая несчастливая семья несчастлива по своему", false},
		// Latin with a few accented or foreign words is still Latin, and still
		// readable by the list — the gate is a proportion, not a purity test.
		{"latin with diacritics", "The café was crowded but the séance had already begun and nobody noticed the door", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := clozeReadable(c.text); got != c.want {
				t.Errorf("clozeReadable(%s) = %v, want %v", c.name, got, c.want)
			}
			if _, _, ok := clozeSpan(c.text, kindBook, 7, clozeMaxWords); ok != c.want {
				t.Errorf("clozeSpan(%s) ok = %v, want %v", c.name, ok, c.want)
			}
		})
	}
}

func TestClozeGradingIsForgivingButNotBlind(t *testing.T) {
	cases := []struct {
		answer, attempt string
		want            bool
	}{
		{"universally acknowledged", "universally acknowledged", true},
		{"universally acknowledged", "  Universally Acknowledged  ", true}, // case and space
		{"universally acknowledged", "universally acknowledged.", true},    // punctuation
		{"universally acknowledged", "universaly acknowledged", true},      // one slip in a long phrase
		{"universally acknowledged", "widely acknowledged", false},         // a different word
		{"fortune", "fortune", true},
		{"fortune", "fortunes", true}, // one letter, in a word long enough to forgive it
		{"vast", "fast", false},       // short words are not typos of each other
		{"fortune", "", false},
		{"fortune", "misfortune", false},

		// THE BUG THE FIRST VERSION HAD, and the reason grading is token by
		// token. A budget banded on the whole answer is earned by the long words
		// and spent on the short ones — so a wholly different short word passed
		// as long as it had long company. Every one of these was accepted before
		// the fix, and the last is a different sentence.
		{"man in possession", "man on possession", false},
		{"single man in", "single men in", false},
		{"want of a wife", "want of a life", false},
		// A typo in a long word inside a phrase is still forgiven — the fix
		// tightens the short words, it does not make the whole thing a spelling
		// test.
		{"truth universally acknowledged", "truth universaly acknowledged", true},
		// A missing or an extra word is never a typo, whatever the distances say.
		{"in possession of", "in possession", false},
		{"a good fortune", "a very good fortune", false},

		// CLOSE SYNONYMS COUNT AS RECALL (3.0). The edit distance above measures
		// how far the LETTERS travelled, which is the wrong instrument for a word
		// somebody remembered correctly and wrote another way: "nearly" is six
		// edits from "almost" and is the same sentence, while "fast" is one edit
		// from "vast" and is not.
		{"almost", "nearly", true},
		{"perhaps", "maybe", true},
		{"whole", "entire", true},
		{"almost lost", "nearly lost", true}, // one synonym inside a phrase
		// THE SAME WORD, WRITTEN ANOTHER WAY, which is a different thing from a
		// synonym and is worth more — see TestASynonymIsWorthLessThanTheWord.
		{"colour", "color", true},
		{"realise", "realize", true},
		{"travelling", "traveling", true},
		{"theatre", "theater", true},
		{"fortunes", "fortune", true},
		{"beginning", "beginnings", true},
		// THE LIST IS NARROW AND THESE ARE THE CUTS THAT MAKE IT SO. Each of them
		// was accepted by the first version, and each changes something a
		// quotation is made of: the strength of a word, its register, or its era.
		// "A large man" is not "a big man"; "silent" is not "quiet"; "wise" is not
		// "clever". A reader who wrote one for the other did not recall the line.
		{"big", "large", false},
		{"small", "little", false},
		{"quiet", "silent", false},
		{"wise", "clever", false},
		{"beautiful", "lovely", false},
		{"always", "forever", false},
		// AND THE FOLD MUST NOT INVENT AN EQUIVALENCE, which is why every rule in
		// clozeSpellingFold is anchored: an unanchored "oe"→"e" folds "poet" onto
		// "pet", and both would be accepted as the same recall. (The unanchored
		// version passed this pair before the anchors went in.)
		{"poet", "pet", false},
		{"great", "wonderful", false}, // a thesaurus would take this; a quote must not
		{"blood", "sweat", false},
	}
	for _, c := range cases {
		if got := clozeCorrect(c.answer, c.attempt); got != c.want {
			t.Errorf("clozeCorrect(%q, %q) = %v, want %v", c.answer, c.attempt, got, c.want)
		}
	}
}

// THE ANSWER MUST NOT TRAVEL until the attempt is in. Unlike an MCQ, whose
// `answer` is an index that means nothing without the options, a cloze answer IS
// the words being recalled.
func TestClozeCardCarriesNoAnswer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Pride and Prejudice")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": clozeQuote}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	// The live card is fresh, so its blank is one word wide (clozeMultiWordFrom).
	_, answer, ok := clozeSpan(clozeQuote, kindBook, id, clozeMaxWordsFor(reviewMinStability, clozeMultiWordFrom))
	if !ok {
		t.Fatal("the seeded quote makes no cloze card")
	}

	// Practice draws directions at random, so ask until a cloze card turns up.
	var card reviewCard
	for i := 0; i < 40 && card.Direction == ""; i++ {
		pd := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, http.StatusOK))
		for _, it := range pd.Items {
			if it.Direction == dirCloze {
				card = it
			}
		}
	}
	if card.Direction == "" {
		t.Skip("no cloze card drawn in 40 rounds")
	}
	if strings.Contains(card.Quote, answer) {
		t.Fatalf("the cloze card carries its own answer: %q", card.Quote)
	}
	if !strings.Contains(card.Quote, clozeBlank) {
		t.Fatalf("the cloze card has no blank: %q", card.Quote)
	}
	if len(card.Options) != 0 {
		t.Fatalf("a cloze card should have no options: %+v", card.Options)
	}
}

// The attempt is graded on the server, and the reply says what was recorded.
func TestClozeAttemptIsGradedServerSide(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Pride and Prejudice")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": clozeQuote}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)
	// The width the SERVER will use for a card at the starting half-life — not
	// clozeMaxWords, which is only earned at the 30-day rung. Deriving it keeps this
	// test about grading rather than about which words happen to be masked.
	_, answer, _ := clozeSpan(clozeQuote, kindBook, id, clozeMaxWordsFor(reviewMinStability, clozeMultiWordFrom))

	// A wrong attempt, sent with result "got" — the server must ignore the
	// client's claim and grade the words.
	res := decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "got", "mode": "practice", "attempt": "something else entirely",
	}, http.StatusOK))
	if res.Result != "forgot" {
		t.Fatalf("a wrong attempt was recorded as %q — the client's claim was believed", res.Result)
	}
	if res.Answer != answer {
		t.Fatalf("the reply did not carry the answer after grading: %q, want %q", res.Answer, answer)
	}

	// And the right one, sent with result "forgot".
	res = decode[answerResp](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "forgot", "mode": "practice", "attempt": answer,
	}, http.StatusOK))
	if res.Result != "got" {
		t.Fatalf("a correct attempt was recorded as %q", res.Result)
	}
}

// ---- a synonym is a third answer, not a second ------------------------------

// The grader has to distinguish three outcomes, because the schedule pays them
// three different amounts. A boolean cannot carry that, and the two ways of
// collapsing it are both wrong: "correct" tells a reader who wrote "nearly" for
// "almost" that they reproduced the line, and "wrong" tells somebody who has the
// sentence that they have forgotten it.
func TestClozeJudgeSeparatesTheWordFromAWordThatMeansTheSame(t *testing.T) {
	cases := []struct {
		answer, attempt string
		want            clozeResult
	}{
		{"almost", "almost", clozeGot},
		{"almost", "  Almost. ", clozeGot},      // normalisation is not forgiveness
		{"colour", "color", clozeGot},           // the same word, two spellings
		{"fortunes", "fortune", clozeGot},       // the same word, two numbers
		{"universally", "universaly", clozeGot}, // a typo is still the word
		{"almost", "nearly", clozeGotSynonym},
		{"begin", "start", clozeGotSynonym},
		{"begin", "starting", clozeGotSynonym}, // a regular inflection reaches the row
		// AN IRREGULAR PAST IS NOT COVERED, and is a miss rather than a synonym: a
		// suffix trim cannot fold "began" onto "begin", and a row for every
		// irregular verb is the thesaurus this list exists not to be.
		{"began", "started", clozeMiss},
		{"almost lost", "nearly lost", clozeGotSynonym},
		{"almost", "never", clozeMiss},
		{"quiet", "silent", clozeMiss}, // cut from the list: not the same word
	}
	for _, c := range cases {
		if got := clozeJudge(c.answer, c.attempt); got != c.want {
			t.Errorf("clozeJudge(%q, %q) = %v, want %v", c.answer, c.attempt, got, c.want)
		}
	}
}

// THE SCHEDULE PAYS THEM DIFFERENTLY, which is the whole point of separating
// them — and the arithmetic is on the MOVE rather than on the value landed on,
// the same shape as every other weight in this file.
func TestASynonymIsWorthLessThanTheWord(t *testing.T) {
	tune := defaultReviewTuning()
	const was = 7.0
	// What the baseline rules earned before any weighting.
	earned := 20.0
	exact := weighByDifficulty(dirCloze, "got", was, earned, tune)
	syn := weighSynonym(was, exact, tune.ClozeSynonym)
	if syn >= exact {
		t.Fatalf("a synonym earned %.2f and the word itself %.2f", syn, exact)
	}
	// Half the stretch at the default, which is what "the word is worth twice a
	// synonym" means when the thing being weighed is the distance travelled.
	if want := was + (exact-was)*0.5; syn != want {
		t.Errorf("synonym half-life = %.4f, want %.4f", syn, want)
	}
	// The slider's two ends: at 1 the reader has said they do not want the
	// distinction made, and at 0 the answer counts without moving the card.
	if got := weighSynonym(was, exact, 1); got != exact {
		t.Errorf("at 1.0 a synonym should be worth exactly the word: %.4f vs %.4f", got, exact)
	}
	if got := weighSynonym(was, exact, 0); got != was {
		t.Errorf("at 0 a synonym should leave the card where it was: %.4f vs %.4f", got, was)
	}
}

// A LAPSE IS NEVER DISCOUNTED. The weight says "you knew the meaning and not the
// words", which is a thing to say about a right answer; a wrong one is wrong for
// its own reasons.
func TestTheSynonymWeightNeverTouchesALapse(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	// Adaptive is the default now, so nothing has to be asked for here — the
	// PUT that used to turn it on is gone rather than restated as srLadder:false.

	book := createBook(t, c, "Pride and Prejudice")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": clozeQuote}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)
	// A wrong answer that is also not a synonym of anything.
	got := decode[struct {
		Result  string `json:"result"`
		Synonym bool   `json:"synonym"`
	}](t, c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "got", "mode": "daily", "attempt": "elephants",
	}, 200))
	if got.Result != "forgot" || got.Synonym {
		t.Fatalf("a wrong answer came back as %+v", got)
	}
}

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
