package httpapi

// Cloze cards: blank out a phrase and recall it.
//
// The most natural way to test a QUOTE as opposed to a fact, and the one thing
// in this section nobody else in the category does. Everything here is computed
// at request time from the quote's own words — no schema, nothing stored, the
// same discipline the forgetting curve itself follows.
//
// THE MASK IS DETERMINISTIC AND DAY-INDEPENDENT. It is derived from (kind, id)
// alone, deliberately not from the day seed: the grading endpoint has to
// recompute the same span the card was built with, and a mask that moved with
// the date would grade tomorrow's answer against today's blank. It also means
// daily and practice blank the same words, so a card does not become a different
// question depending on which screen you met it on.

import (
	"strings"
	"unicode"

	"tippani/internal/search"
)

const (
	// The blank, and it is a character rather than a run of underscores because
	// the client renders it as a gap of its own — and because underscores in the
	// quote's own text would be indistinguishable from the mask.
	clozeBlank = "￼" // OBJECT REPLACEMENT CHARACTER

	clozeMinWords = 1 // shortest span worth blanking
	clozeMaxWords = 3 // longest — a blank of four words is a rewrite, not a recall
	// THE SPAN GROWS WITH THE CARD (1.16.0). One word is the ordinary blank and
	// the widest is earned: a three-word hole in a quote you met yesterday is not
	// a harder version of the same question, it is a different and much worse one
	// — there is not enough of the sentence left to reason from, so it tests
	// verbatim memory of something you have barely read. A quote whose half-life
	// has already reached the ladder's second rung is one you demonstrably know,
	// and widening the blank is the only way left to ask more of it.
	//
	// 30 days is that rung (reviewLadder[1]) rather than a number picked to feel
	// right, and it is written as the literal here because cloze.go is deliberately
	// free of the scheduler's imports.
	clozeMultiWordFrom = 30.0
	clozeMinContext    = 15 // runes that must remain around the blank, or there is no question
	clozeMinTokens     = 6  // a quote shorter than this has nothing to hide
)

// clozeStopwords is a small, explicit English list. NOT a dependency, and not a
// general-purpose one: its only job is to keep the blank off words whose recall
// proves nothing. Blanking "the" tests typing, not memory.
//
// Deliberately short. A larger list drawn from a corpus would also strike words
// that carry real weight in a literary quote ("never", "nothing", "all"), and
// this list is read by exactly one caller for exactly one purpose.
var clozeStopwords = map[string]bool{
	"a": true, "an": true, "and": true, "are": true, "as": true, "at": true,
	"be": true, "been": true, "but": true, "by": true, "did": true, "do": true,
	"for": true, "from": true, "had": true, "has": true, "have": true, "he": true,
	"her": true, "his": true, "i": true, "if": true, "in": true, "is": true,
	"it": true, "its": true, "me": true, "my": true, "not": true, "of": true,
	"on": true, "or": true, "our": true, "she": true, "so": true, "than": true,
	"that": true, "the": true, "their": true, "them": true, "then": true,
	"there": true, "they": true, "this": true, "to": true, "up": true, "was": true,
	"we": true, "were": true, "what": true, "when": true, "which": true,
	"who": true, "will": true, "with": true, "would": true, "you": true, "your": true,
}

// clozeReadable reports whether this text is one the stopword list actually
// understands.
//
// THE PLAN WAS WRONG ABOUT THIS, and the failure is silent, which is why the
// gate exists. It claimed a quote in another script "simply will not produce a
// good span" — but an English stopword list matches ZERO Devanagari or Cyrillic
// or Han tokens, so every token reads as a content word and the selector
// happily blanks a phrase out of text it understands nothing about. Far from
// producing no span, it produces a confident one.
//
// So a cloze card is offered only where the list means something: predominantly
// Latin script. Everything else gets one of the other directions, which are all
// script-agnostic. This is a limit of the stopword list and is written here
// rather than in the plan so that whoever adds a second list knows what to
// change.
func clozeReadable(s string) bool {
	var latin, other int
	for _, r := range s {
		if !unicode.IsLetter(r) {
			continue
		}
		if unicode.Is(unicode.Latin, r) {
			latin++
		} else {
			other++
		}
	}
	if latin+other == 0 {
		return false
	}
	return latin*4 >= (latin+other)*3 // at least three quarters Latin
}

// clozeToken is one word of the quote with its position, so a span can be cut
// out of the ORIGINAL text rather than rebuilt from the tokens — rebuilding
// would normalise the reader's own spacing and punctuation.
type clozeToken struct {
	start, end int // byte offsets into the source text
	word       string
	content    bool // not a stopword, and long enough to be worth recalling
}

func clozeTokens(text string) []clozeToken {
	var out []clozeToken
	inWord := false
	start := 0
	for i, r := range text {
		isWord := unicode.IsLetter(r) || unicode.IsNumber(r) || r == '\''
		switch {
		case isWord && !inWord:
			inWord, start = true, i
		case !isWord && inWord:
			out = append(out, clozeTokenAt(text, start, i))
			inWord = false
		}
	}
	if inWord {
		out = append(out, clozeTokenAt(text, start, len(text)))
	}
	return out
}

func clozeTokenAt(text string, start, end int) clozeToken {
	w := text[start:end]
	folded := strings.ToLower(strings.Trim(w, "'"))
	return clozeToken{
		start: start, end: end, word: w,
		// Three runes is the floor: shorter words carry too little signal to be
		// worth recalling and too many near-neighbours to grade fairly.
		content: !clozeStopwords[folded] && len([]rune(folded)) >= 3,
	}
}

// clozeSpan picks the run of words to blank: the longest run of content words,
// capped at clozeMaxWords, chosen deterministically by the card's own hash when
// several runs tie.
//
// Returns the masked text and the answer, or ok=false when this quote cannot
// make a decent card — too short, too little context left, or a script the
// stopword list does not read.
// clozeMaxWordsFor is how wide this card's blank may be. See clozeMultiWordFrom.
func clozeMaxWordsFor(stability, multiWordFrom float64) int {
	if stability >= multiWordFrom {
		return clozeMaxWords
	}
	return 1
}

func clozeSpan(text string, kind string, id int64, maxWords int) (masked, answer string, ok bool) {
	if maxWords < 1 {
		maxWords = 1
	}
	if maxWords > clozeMaxWords {
		maxWords = clozeMaxWords
	}
	text = strings.TrimSpace(text)
	if !clozeReadable(text) {
		return "", "", false
	}
	toks := clozeTokens(text)
	if len(toks) < clozeMinTokens {
		return "", "", false
	}
	// Every maximal run of content words, clipped to the cap.
	type run struct{ lo, hi int } // inclusive token indices
	var runs []run
	for i := 0; i < len(toks); {
		if !toks[i].content {
			i++
			continue
		}
		j := i
		for j+1 < len(toks) && toks[j+1].content && j-i+1 < maxWords {
			j++
		}
		runs = append(runs, run{i, j})
		i = j + 1
	}
	if len(runs) == 0 {
		return "", "", false
	}
	// Longest first; ties broken by the card's own hash so the choice is stable
	// per card and not merely "the first one".
	best := 0
	bestLen := 0
	h := uint64(id)*0x9E3779B97F4A7C15 + kindSalt(kind)
	for i, r := range runs {
		n := r.hi - r.lo + 1
		if n > bestLen || (n == bestLen && (h+uint64(i))%2 == 0) {
			best, bestLen = i, n
		}
	}
	r := runs[best]
	if bestLen < clozeMinWords {
		return "", "", false
	}
	lo, hi := toks[r.lo].start, toks[r.hi].end
	// Enough of the quote has to survive for the blank to be a question rather
	// than the whole card.
	if len([]rune(text))-len([]rune(text[lo:hi])) < clozeMinContext {
		return "", "", false
	}
	return text[:lo] + clozeBlank + text[hi:], text[lo:hi], true
}

// clozeCorrect grades an attempt against the answer.
//
// FUZZY, because this is recall of a phrase and not a spelling test: case,
// surrounding punctuation and inner whitespace are all normalised away, and a
// small edit distance is forgiven on top.
//
// TOKEN BY TOKEN, NOT WHOLE-STRING, and this is the correction that matters.
// The first version banded the budget on the length of the whole answer, which
// is the failure the plan predicted in as many words: a budget earned by long
// neighbours pays for a wholly wrong short word. Measured before the fix, on
// real spans out of Austen:
//
//	"man in possession"  accepted  "man ON possession"
//	"single man in"      accepted  "single MEN in"
//	"want of a wife"     accepted  "want of a LIFE"
//
// Every one of those is a different word, and the last one is a different
// sentence. "vast" and "fast" were correctly refused in isolation the whole
// time — the budget only became wrong once a short word had long company.
//
// So each word carries its own budget, and the count has to match: three words
// recalled as two is not a typo. The banding is the same shape as before and
// derived from the same fact — how far you can travel from a word before landing
// on another real one, which is a function of its length.
func clozeCorrect(answer, attempt string) bool {
	a, b := clozeNormalise(answer), clozeNormalise(attempt)
	if a == "" || b == "" {
		return false
	}
	if a == b {
		return true
	}
	aw, bw := strings.Fields(a), strings.Fields(b)
	// A missing or an extra word is never a typo, whatever the distances say.
	if len(aw) != len(bw) {
		return false
	}
	for i := range aw {
		if aw[i] == bw[i] {
			continue
		}
		budget := clozeBudget(len([]rune(aw[i])))
		if budget == 0 {
			return false
		}
		if search.Distance(aw[i], bw[i], budget) > budget {
			return false
		}
	}
	return true
}

// clozeBudget is how many edits one word of n characters may be wrong by.
//
// Nothing under five, because at four characters almost every other word is one
// edit away — "vast" and "fast" are different words, not a slip. This mirrors
// editBudget in text.js and budgetFor in internal/search/levenshtein.go in
// shape but NOT in numbers, and deliberately: search wants to be generous
// because a near miss there costs a wasted glance, and this wants to be strict
// because a near miss here is a false pass on something you did not recall.
func clozeBudget(n int) int {
	switch {
	case n <= 4:
		return 0
	case n <= 7:
		return 1
	default:
		return 2
	}
}

// clozeNormalise folds everything that is not the words themselves: case, outer
// punctuation, and runs of whitespace.
func clozeNormalise(s string) string {
	var b strings.Builder
	lastSpace := false
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		switch {
		case unicode.IsLetter(r) || unicode.IsNumber(r):
			b.WriteRune(r)
			lastSpace = false
		case unicode.IsSpace(r):
			if !lastSpace && b.Len() > 0 {
				b.WriteRune(' ')
				lastSpace = true
			}
		}
	}
	return strings.TrimSpace(b.String())
}
