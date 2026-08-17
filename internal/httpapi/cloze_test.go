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
	if got := clozeMaxWordsFor(clozeMultiWordFrom - 0.01, clozeMultiWordFrom); got != 1 {
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
