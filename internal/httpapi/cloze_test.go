package httpapi

// Cloze cards — blank a phrase out of the quote and type it back.
//
// Three claims are worth pinning, and each fails silently if it breaks: the mask
// is stable per card and independent of the day (or the grader recomputes a
// different blank from the one the reader saw), the answer never reaches the
// client before the attempt is in, and the English stopword list is never
// applied to text it cannot read.

import (
	"net/http"
	"strings"
	"testing"
)

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

// A quote with nothing to hide is not a cloze card, and says so rather than
// producing a degenerate one.
func TestClozeRefusesWhatItCannotAsk(t *testing.T) {
	for _, q := range []string{"", "   ", "No.", "Yes, and?", "to be or not to be"} {
		if _, _, ok := clozeSpan(q, kindBook, 1, clozeMaxWords); ok {
			t.Errorf("made a cloze card out of %q", q)
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

// An attempt on a card that could never have been a cloze card is refused
// rather than silently graded as a lapse, which would move a schedule on the
// strength of a request nothing generated.
func TestClozeAttemptOnAnUnmaskableQuoteIsRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Short")
	id := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "No."}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	c.mustDo("POST", "/review/answer", map[string]any{
		"kind": kindBook, "id": id, "result": "got", "mode": "practice", "attempt": "anything",
	}, http.StatusBadRequest)
}

// The blank is ONE WORD until the card has earned a wider one.
//
// A three-word hole in a quote you met yesterday is not a harder version of the
// same question — it is a different and much worse one, with too little of the
// sentence left to reason from. So width is earned: a card whose half-life has
// reached the ladder's 30-day rung is one you demonstrably know, and widening the
// blank is the only way left to ask more of it.
func TestClozeSpanWidthIsEarned(t *testing.T) {
	if got := clozeMaxWordsFor(reviewMinStability, clozeMultiWordFrom); got != 1 {
		t.Fatalf("a new card gets a one-word blank, got %d", got)
	}
	if got := clozeMaxWordsFor(clozeMultiWordFrom-0.01, clozeMultiWordFrom); got != 1 {
		t.Fatalf("just under the rung is still one word, got %d", got)
	}
	if got := clozeMaxWordsFor(clozeMultiWordFrom, clozeMultiWordFrom); got != clozeMaxWords {
		t.Fatalf("at the rung the blank widens, got %d", got)
	}
	if got := clozeMaxWordsFor(reviewMaxStability, clozeMultiWordFrom); got != clozeMaxWords {
		t.Fatalf("a mature card gets the widest blank, got %d", got)
	}

	// And the width actually reaches the span: the same quote and card blanks one
	// word at the floor and more than one once it has climbed.
	_, narrow, ok := clozeSpan(clozeQuote, kindBook, 42, clozeMaxWordsFor(reviewMinStability, clozeMultiWordFrom))
	if !ok {
		t.Fatal("a one-word blank must still build")
	}
	if n := len(strings.Fields(narrow)); n != 1 {
		t.Fatalf("narrow answer %q is %d words, want 1", narrow, n)
	}
	_, wide, ok := clozeSpan(clozeQuote, kindBook, 42, clozeMaxWordsFor(reviewMaxStability, clozeMultiWordFrom))
	if !ok {
		t.Fatal("the wide blank must build too")
	}
	if len(strings.Fields(wide)) < 2 {
		t.Fatalf("wide answer %q did not widen", wide)
	}
}

// A SHORT QUOTE IS STILL ASKABLE, which is the half that makes taking the flip
// card out of the daily deck safe: a cloze needs no distractors, only a content
// word, so one quote from one book is a complete graded question.
func TestClozeAsksAShortQuoteWithOneWord(t *testing.T) {
	const short = "the sleeper must awaken across the wide desert"
	if _, _, ok := clozeSpan(short, kindBook, 9, 1); !ok {
		t.Fatalf("a one-word blank should build from %q", short)
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

// A word is never a synonym of itself, or an exact answer would be discounted
// by the very machinery that exists to be generous to a near one.
func TestAWordIsNotItsOwnSynonym(t *testing.T) {
	for _, w := range []string{"almost", "begin", "whole", "fast"} {
		if clozeSynonymOf(w, w) {
			t.Errorf("%q was called a synonym of itself", w)
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
	c.mustDo("PUT", "/auth/me/preferences", map[string]any{"srAdaptive": true}, 200)

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
