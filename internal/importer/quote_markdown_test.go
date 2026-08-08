package importer

import (
	"strings"
	"testing"
)

const quotesFile = `---
type: quotes
---

> Least said, soonest mended

> A stitch in time saves nine
- note: my grandmother's

## Burma Radio broadcast

> Give me blood, and I will give you freedom
- speaker: Subhas Chandra Bose
- occasion_date: 1944
- place: Burma
- medium: radio
- color: blue
- tags: freedom, 1944
- date: 2026-07-14
- favorite: true

> Freedom is not given, it is taken
- speaker: Subhas Chandra Bose

## first inaugural address

> The only thing we have to fear is fear itself
- speaker: Franklin D. Roosevelt
- occasion_date: 1933-03-04
`

func TestQuoteMarkdownAll(t *testing.T) {
	us, err := QuoteMarkdownAll(strings.NewReader(quotesFile))
	if err != nil {
		t.Fatal(err)
	}
	if len(us) != 5 {
		t.Fatalf("expected five quotes, got %d: %+v", len(us), us)
	}

	// The two proverbs precede any heading and must carry NO occasion. This is
	// the assertion that fails if the parser lets a heading leak backwards.
	if us[0].Quote != "Least said, soonest mended" || us[0].Occasion != "" || us[0].Speaker != "" {
		t.Fatalf("first proverb: %+v", us[0])
	}
	if us[1].Occasion != "" || us[1].Note != "my grandmother's" {
		t.Fatalf("second proverb: %+v", us[1])
	}

	full := us[2]
	if full.Quote != "Give me blood, and I will give you freedom" {
		t.Fatalf("quote: %q", full.Quote)
	}
	if full.Speaker != "Subhas Chandra Bose" || full.Occasion != "Burma Radio broadcast" {
		t.Fatalf("attribution: %+v", full)
	}
	// occasion_date is when it was SAID; date is when it was SAVED. A parser
	// that folded them would date a 1944 speech to the day it was typed in.
	if full.OccasionDate != "1944" {
		t.Fatalf("occasion_date: %q", full.OccasionDate)
	}
	if full.NotedAt != "2026-07-14" {
		t.Fatalf("date (saved on): %q", full.NotedAt)
	}
	if full.Place != "Burma" || full.Medium != "radio" || full.Color != "blue" || !full.Favorite {
		t.Fatalf("bindings: %+v", full)
	}
	if len(full.Tags) != 2 || full.Tags[0] != "freedom" || full.Tags[1] != "1944" {
		t.Fatalf("tags: %v", full.Tags)
	}

	// The heading carries to the next quote too, and the heading CHANGES.
	if us[3].Occasion != "Burma Radio broadcast" {
		t.Fatalf("second quote under the heading: %+v", us[3])
	}
	if us[4].Occasion != "first inaugural address" || us[4].Speaker != "Franklin D. Roosevelt" {
		t.Fatalf("quote under the second heading: %+v", us[4])
	}
	// A quote that names no colour leaves it empty, so the caller applies the
	// column default rather than the file claiming an explicit yellow.
	if us[4].Color != "" {
		t.Fatalf("an unstated colour should stay empty, got %q", us[4].Color)
	}
}

// A per-quote binding beats the heading, so a hand-written file that repeats
// the occasion on each line still works.
func TestQuoteMarkdownBindingBeatsHeading(t *testing.T) {
	us, err := QuoteMarkdownAll(strings.NewReader(
		"---\ntype: quotes\n---\n\n## a rally\n\n> a line\n- occasion: a letter\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(us) != 1 || us[0].Occasion != "a letter" {
		t.Fatalf("binding did not override the heading: %+v", us)
	}
}

func TestQuoteMarkdownRejectsRubbish(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"empty", ""},
		{"whitespace only", "\n\n  \n"},
		{"no frontmatter", "> a line\n- speaker: Bose\n"},
		{"unterminated frontmatter", "---\ntype: quotes\n\n> a line\n"},
	} {
		if _, err := QuoteMarkdownAll(strings.NewReader(tc.body)); err == nil {
			t.Errorf("%s: expected an error", tc.name)
		}
	}
}

// A multi-line blockquote collapses to one quote, as in every other parser —
// a wrapped paragraph is one thing said, not four.
func TestQuoteMarkdownJoinsWrappedLines(t *testing.T) {
	us, err := QuoteMarkdownAll(strings.NewReader(
		"---\ntype: quotes\n---\n\n> Give me blood,\n> and I will give\n> you freedom\n- speaker: Bose\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(us) != 1 || us[0].Quote != "Give me blood, and I will give you freedom" {
		t.Fatalf("wrapped lines did not join: %+v", us)
	}
}
