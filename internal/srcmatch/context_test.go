package srcmatch

import (
	"strings"
	"testing"
)

func cuesAt(starts ...int64) []Unit {
	us := make([]Unit, len(starts))
	for i, s := range starts {
		us[i] = Unit{Text: "line " + string(rune('a'+i)), Start: s, End: s + 1000}
	}
	return us
}

func TestContextTakesTheAskedUnitsEitherSideAndKeepsTheBodyAsTheFileHasIt(t *testing.T) {
	ix := NewIndex(paras("one", "two", "THE  Body, as Published.", "four", "five", "six"))
	c := ix.Context(Match{First: 2, Last: 2}, 2, 2, Options{Sep: "\n\n"})
	if c.Before != "one\n\ntwo" || c.After != "four\n\nfive" || c.Body != "THE  Body, as Published." {
		t.Fatalf("%+v", c)
	}
	if c.TookBefore != 2 || c.TookAfter != 2 || c.BoundBefore || c.BoundAfter {
		t.Fatalf("%+v", c)
	}
}

// THE OWNER'S OWN EXAMPLE: "an annotation may be the first in the chapter, so it needs
// nothing before it" — and nobody configured that.
func TestAChapterStartGetsNothingBeforeItWithoutAnyoneSayingSo(t *testing.T) {
	us := paras("end of chapter one", "also chapter one", "chapter two opens", "and continues")
	us[2].Doc, us[3].Doc = 1, 1
	c := NewIndex(us).Context(Match{First: 2, Last: 2}, 2, 2, Options{Sep: "\n"})
	if c.Before != "" || !c.BoundBefore {
		t.Fatalf("crossed a chapter edge: %+v", c)
	}
	if c.After != "and continues" || !c.BoundAfter {
		t.Fatalf("after: %+v", c)
	}
}

func TestALongSilenceStopsACueSpanAndASmallOneDoesNot(t *testing.T) {
	// c comes after a 41 s silence from b; d follows c by 1 s.
	us := cuesAt(0, 2000, 44000, 46000)
	c := NewIndex(us).Context(Match{First: 2, Last: 2}, 2, 2, Options{Sep: "\n", MaxGapMs: 30000})
	if c.Before != "" || !c.BoundBefore {
		t.Fatalf("%+v", c)
	}
	if c.After != "line d" {
		t.Fatalf("%+v", c)
	}
	// With the stop off the same cut reaches back across the silence.
	c = NewIndex(us).Context(Match{First: 2, Last: 2}, 2, 0, Options{Sep: "\n"})
	if c.Before != "line a\nline b" || c.BoundBefore {
		t.Fatalf("%+v", c)
	}
}

func TestTheStartAndEndOfTheWorkAreBoundariesToo(t *testing.T) {
	c := NewIndex(paras("first", "second")).Context(Match{First: 0, Last: 0}, 2, 2, Options{Sep: "\n"})
	if c.Before != "" || !c.BoundBefore || c.After != "second" || !c.BoundAfter {
		t.Fatalf("%+v", c)
	}
}

// A paragraph can be 91 characters; two of them is not enough to read. The floor takes
// whole units outward and never cuts at the character it reached.
func TestTheCharacterFloorRoundsOutwardToWholeUnits(t *testing.T) {
	long := strings.Repeat("x", 60)
	us := paras(long, long, long, long, "BODY", long, long, long)
	c := NewIndex(us).Context(Match{First: 4, Last: 4}, 1, 1, Options{Sep: "\n", MinChars: 100})
	if c.TookBefore != 2 || c.TookAfter != 2 {
		t.Fatalf("a 100-character floor over 60-character units should take two a side: %+v", c)
	}
	for _, side := range []string{c.Before, c.After} {
		for _, line := range strings.Split(side, "\n") {
			if line != long {
				t.Fatalf("cut mid-unit: %q", line)
			}
		}
	}
}

func TestCueTimesOfTheBodyAreReported(t *testing.T) {
	us := cuesAt(5000, 8000, 11000)
	c := NewIndex(us).Context(Match{First: 1, Last: 2}, 0, 0, Options{Sep: "\n"})
	if c.Start != 8000 || c.End != 12000 || c.Body != "line b\nline c" {
		t.Fatalf("%+v", c)
	}
}
