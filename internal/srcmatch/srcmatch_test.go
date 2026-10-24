package srcmatch

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// Each case is a deviation the plan measured in the owner's real files, not a tidy
// example: accents dropped from a subtitle, a tidied quote, an ellipsis where two
// passages were joined, a mistyped word, a short line that appears a dozen times.

func paras(lines ...string) []Unit {
	us := make([]Unit, len(lines))
	for i, l := range lines {
		us[i] = Unit{Text: l}
	}
	return us
}

func TestFoldIgnoresPunctuationAccentsCaseAndSmartQuotes(t *testing.T) {
	for in, want := range map[string]string{
		"Don’t—stop… Voilà!":       "dont stop voila",
		"  “Hello,”   said  HE.  ": "hello said he",
		"well—well":                "well well",
		"Ünïcödé Ñandú":            "unicode nandu",
		"...":                      "",
		"o'clock":                  "oclock",
	} {
		if got := Fold(in); got != want {
			t.Errorf("Fold(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAVerbatimQuoteFindsItsParagraph(t *testing.T) {
	ix := NewIndex(paras(
		"The road ran north along the river.",
		"It was a bright cold day in April, and the clocks were striking thirteen.",
		"Nobody came.",
	))
	r := ix.Find("It was a bright cold day in April, and the clocks were striking thirteen.")
	if !r.Found || r.Match.First != 1 || r.Match.Last != 1 || !r.Match.Exact() || r.Ambiguous {
		t.Fatalf("%+v", r)
	}
}

// THE OWNER'S FILE: a correctly stored quote does not match its own subtitle line on
// a literal compare, because the subtitle lost the accented letter altogether.
func TestASubtitleThatDroppedTheAccentedLettersStillMatches(t *testing.T) {
	cues := []Unit{
		{Text: "Good evening, London."},
		{Text: "Voil ! In view humbly vendetta,"},
		{Text: "the cafe was closed."},
	}
	r := NewIndex(cues).Find("Voilà! In view, a humble vaudevillian veteran, cast vicariously as both victim and villain")
	// That quote is not in this file; what matters is the next one is, with a letter missing.
	if r.Found && !r.Ambiguous && r.Match.First == 1 {
		t.Fatalf("an unrelated long quote should not be pinned to cue 1: %+v", r)
	}
	r = NewIndex(cues).Find("Voilà! In view humbly vendetta")
	if !r.Found || r.Match.First != 1 || r.Match.Last != 1 {
		t.Fatalf("a letter dropped by the file should cost an edit, not the match: %+v", r)
	}
}

func TestPunctuationAndAnEllipsisJoinAreIgnored(t *testing.T) {
	ix := NewIndex(paras(
		"Intro paragraph that has nothing to do with it.",
		"I don't know what you mean; the answer — if there is one — is in the hills.",
	))
	// A reader's tidy: curly apostrophe, different dashes, a joined ellipsis.
	r := ix.Find("I don’t know what you mean… the answer - if there is one - is in the hills")
	if !r.Found || r.Match.First != 1 || r.Match.Dist > 1 {
		t.Fatalf("%+v", r)
	}
}

func TestASmallTypoIsToleratedAndALargeOneIsNot(t *testing.T) {
	ix := NewIndex(paras(
		"Filler about something entirely different here.",
		"The quick brown fox jumps over the lazy dog near the riverbank at dawn.",
		"More filler text so the file has some bulk to it.",
	))
	r := ix.Find("The quick brown fox jumpt over the lazy dog near the riverbank at dawn")
	if !r.Found || r.Match.First != 1 || r.Match.Dist != 1 {
		t.Fatalf("one mistyped letter: %+v", r)
	}
	r = ix.Find("The slow green cat crawled under the busy cow near the mountain at dusk")
	if r.Found {
		t.Fatalf("a different sentence must not match: %+v", r)
	}
}

func TestAQuoteSpanningCuesReturnsTheWholeRange(t *testing.T) {
	cues := []Unit{
		{Text: "Before."},
		{Text: "I am the very model"},
		{Text: "of a modern major general,"},
		{Text: "After."},
	}
	r := NewIndex(cues).Find("I am the very model of a modern major general")
	if !r.Found || r.Match.First != 1 || r.Match.Last != 2 {
		t.Fatalf("%+v", r)
	}
}

// "Yes." appears a dozen times; guessing which is worse than saying so.
func TestAShortRepeatedLineIsAmbiguousNotGuessed(t *testing.T) {
	ix := NewIndex(paras("Yes.", "Are you sure?", "Yes.", "Really?", "Yes."))
	r := ix.Find("Yes.")
	if !r.Found || !r.Ambiguous || len(r.Alternatives) != 2 {
		t.Fatalf("%+v", r)
	}
}

func TestAWordInsideAnotherWordIsNotAHit(t *testing.T) {
	ix := NewIndex(paras("Yesterday was long.", "Tomorrow too."))
	if r := ix.Find("Yes."); r.Found {
		t.Fatalf("\"yes\" is in \"yesterday\" and that is not the quote: %+v", r)
	}
}

func TestAUniqueLineAmongSimilarOnesIsNotAmbiguous(t *testing.T) {
	ix := NewIndex(paras(
		"The old man walked to the market every single morning.",
		"The old man walked to the harbour every single evening.",
		"Completely unrelated sentence about weather and rivers.",
	))
	r := ix.Find("The old man walked to the market every single morning")
	if !r.Found || r.Match.First != 0 || r.Ambiguous {
		t.Fatalf("%+v", r)
	}
}

func TestNothingFoundSaysSoAndAnEmptyQuoteOrFileIsSafe(t *testing.T) {
	ix := NewIndex(paras("Some text here."))
	if r := ix.Find("no overlap whatsoever with anything above"); r.Found {
		t.Fatalf("%+v", r)
	}
	if r := ix.Find("   ...  "); r.Found {
		t.Fatalf("%+v", r)
	}
	if r := NewIndex(nil).Find("anything"); r.Found {
		t.Fatalf("%+v", r)
	}
	// Units that fold to nothing keep their place and are never a match.
	ix = NewIndex([]Unit{{Text: "♪"}, {Text: "real line of speech here"}, {Text: "..."}})
	if r := ix.Find("real line of speech here"); !r.Found || r.Match.First != 1 {
		t.Fatalf("%+v", r)
	}
}

// A book is 1.5 MB. Aligning every quote against all of it is hundreds of millions of
// steps for one quote; the word index chooses where to look, and this is the guard
// that it does.
func TestAQuoteIsFoundInABookSizedFileQuickly(t *testing.T) {
	var us []Unit
	for i := 0; i < 20000; i++ {
		us = append(us, Unit{Text: fmt.Sprintf("Paragraph number %d talks about subject%d and also object%d in some detail.", i, i%97, i%89)})
	}
	us[17321].Text = "A singular sentence about the zeppelin harvest and the quiet lighthouse keeper's ledger."
	ix := NewIndex(us)
	start := time.Now()
	r := ix.Find("A singular sentence about the zeppelin harvest and the quiet lighthouse keepers ledger")
	if took := time.Since(start); took > 2*time.Second {
		t.Fatalf("took %v", took)
	}
	if !r.Found || r.Match.First != 17321 || r.Ambiguous {
		t.Fatalf("%+v", r)
	}
	if strings.TrimSpace(us[r.Match.First].Text) == "" {
		t.Fatal("unreachable")
	}
}
