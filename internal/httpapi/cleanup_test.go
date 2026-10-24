package httpapi

import (
	"testing"
)

// The cleanup rules, and mostly the text they must LEAVE ALONE.
//
// Every rule here has a false positive that is somebody's real writing, which is
// why the feature reports instead of fixing — and why the negative cases below
// outnumber the positive ones. A rule that fires on correct Bengali, on an
// ellipsis, or on a hyphenated word is worse than no rule: the reader stops
// reading the list, and the one real finding in it goes with them.

func fired(t *testing.T, field, text string) map[string]int {
	t.Helper()
	out := map[string]int{}
	for _, f := range scanCleanup(field, text) {
		out[f.Rule] = f.Count
	}
	return out
}

func TestCleanupFindsWhatAPageLeavesBehind(t *testing.T) {
	cases := []struct {
		name string
		text string
		rule string
	}{
		{"a footnote index welded to the last word", "the end of conscience12", "reference-mark"},
		{"a superscript reference", "a matter of conscience¹", "reference-mark"},
		{"a bracketed reference", "a matter of conscience [12] and no more", "reference-mark"},
		{"a justified line's double space", "two  spaces here", "double-space"},
		{"a space before a full stop", "the end .", "space-before-punctuation"},
		{"a non-breaking space from HTML", "one two", "invisible"},
		{"a zero-width space from a PDF", "one​two", "invisible"},
		{"a soft hyphen inside a word", "con­science", "invisible"},
		{"a hyphen left from a line break", "con- science", "hyphen-break"},
		{"an IPA pronunciation gloss", "conscience /ˈkɒnʃəns/ is the word", "pronunciation"},
		{"a printed pronunciation note", "conscience (pronounced KON-shuns)", "pronunciation"},
		{"doubled commas", "one,, two", "repeated-punctuation"},
		{"padding at the ends", "  the words  ", "edge-space"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := fired(t, "quote", c.text); got[c.rule] == 0 {
				t.Errorf("%q did not fire %s; fired %v", c.text, c.rule, got)
			}
		})
	}
}

// THE HALF THAT MATTERS MORE. Each of these is text somebody wrote on purpose.
func TestCleanupLeavesRealWritingAlone(t *testing.T) {
	cases := []struct {
		name string
		text string
	}{
		{"an ellipsis", "and then… nothing"},
		{"an ellipsis as three dots", "and then... nothing"},
		{"a year", "it was 1984 and cold"},
		{"a numbered chapter", "see chapter 12 for more"},
		{"a hyphenated word", "a well-known fact"},
		{"an em-dash aside", "the fact — a known one — stood"},
		{"a single sentence space", "One. Two. Three."},
		{"a question", "Who goes there?"},
		{"an exclamation", "Stop!"},
		// THE ONE THAT SETTLES THE INVISIBLE RULE. ক্ষ is built with a zero-width
		// joiner, so a rule that flagged every format character would flag correct
		// Bengali on every line it appears in.
		{"a Bengali conjunct built with a joiner", "রক্ষা করো"},
		{"a Bengali proverb", "যেমন কর্ম তেমন ফল"},
		{"a Bengali sentence ending in a dāṛi", "সে চলে গেল।"},
		{"a Devanagari conjunct", "क्षमा करें"},
		{"a quoted aside in brackets", "the fact [as he put it] stood"},
		{"a date", "on 2026-08-24 it rained"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := fired(t, "quote", c.text); len(got) != 0 {
				t.Errorf("%q fired %v; real writing must be left alone", c.text, got)
			}
		})
	}
}

// ONE FINDING PER RULE, WITH A COUNT. Forty double spaces in a long quote is one
// decision to make, and listing forty would bury the other seven rules.
func TestCleanupCollapsesRepeatsIntoACount(t *testing.T) {
	got := scanCleanup("quote", "a  b  c  d")
	if len(got) != 1 {
		t.Fatalf("want one finding, got %+v", got)
	}
	if got[0].Rule != "double-space" || got[0].Count != 3 {
		t.Fatalf("finding = %+v, want double-space × 3", got[0])
	}
	if got[0].Field != "quote" {
		t.Errorf("field = %q, want the field it was asked about", got[0].Field)
	}
}

