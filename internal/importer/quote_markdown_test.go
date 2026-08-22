package importer

import (
	"reflect"
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

// Each case is a single-quote file, parsed and pinned field by field. The last
// two rows are a property and its converse and must stay adjacent: keys fold
// case, values do not.
func TestQuoteMarkdownBindings(t *testing.T) {
	cases := []struct {
		name string
		md   string
		want Utterance
	}{
		{
			// A per-quote binding beats the heading, so a hand-written file that repeats
			// the occasion on each line still works.
			name: "a per-quote binding beats the heading",
			md:   "---\ntype: quotes\n---\n\n## a rally\n\n> a line\n- occasion: a letter\n",
			want: Utterance{Quote: "a line", Occasion: "a letter"},
		},
		{
			// A multi-line blockquote collapses to one quote, as in every other parser —
			// a wrapped paragraph is one thing said, not four.
			name: "a wrapped blockquote joins into one quote",
			md:   "---\ntype: quotes\n---\n\n> Give me blood,\n> and I will give\n> you freedom\n- speaker: Bose\n",
			want: Utterance{Quote: "Give me blood, and I will give you freedom", Speaker: "Bose"},
		},
		{
			// A HAND-WRITTEN FILE CAPITALISES ITS KEYS, and every parser used to ignore that
			// silently: the line parsed, the key matched no case, and the value was dropped with
			// no warning — an import that reported success and quietly lost the speaker.
			//
			// Checked here for the quote format and asserted across the shared helper, since
			// bindingKey is what the book and film parsers call too.
			name: "binding keys ignore case",
			md: "---\ntype: quotes\n---\n\n> Give me blood\n" +
				"- Speaker: Subhas Chandra Bose\n" +
				"- OCCASION: Burma Radio broadcast\n" +
				"- Occasion_Date: 1944\n" +
				"- Category: proverb\n",
			want: Utterance{
				Quote:        "Give me blood",
				Speaker:      "Subhas Chandra Bose",
				Occasion:     "Burma Radio broadcast",
				OccasionDate: "1944",
				Category:     "proverb",
			},
		},
		{
			// The VALUE keeps its case. A key is a keyword; a value is content, and folding it
			// would be a different and much worse bug — every speaker arriving in lower case.
			name: "binding values keep their case",
			md:   "---\ntype: quotes\n---\n\n> A line\n- speaker: Subhas Chandra Bose\n",
			want: Utterance{Quote: "A line", Speaker: "Subhas Chandra Bose"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			us, err := QuoteMarkdownAll(strings.NewReader(tc.md))
			if err != nil {
				t.Fatal(err)
			}
			if len(us) != 1 {
				t.Fatalf("expected one quote, got %d: %+v", len(us), us)
			}
			if !reflect.DeepEqual(us[0], tc.want) {
				t.Fatalf("utterance = %+v, want %+v", us[0], tc.want)
			}
		})
	}
}

// THE FIVE FIELDS THE BOARD KINDS ACTUALLY CARRY (0047) — region for a proverb,
// recipient for a letter, work title and page for an essay, and circa for the
// precision of the date.
//
// Pinned with DeepEqual over the whole struct, like the table above, so a value
// landing in the wrong field cannot pass. The aliases are here because a quotes
// file is hand-written as often as it is exported, and each one is the word the
// interface itself uses for that column: `to` for a recipient, `essay` for a
// source title, `page` for a locator.
func TestQuoteMarkdownPerKindBindings(t *testing.T) {
	for _, tc := range []struct {
		name string
		md   string
		want Utterance
	}{
		{
			name: "all five, canonical keys",
			md: "---\ntype: quotes\n---\n\n> I have a bird in my hand.\n" +
				"- recipient: Jawaharlal Nehru\n- region: Birbhum\n" +
				"- work_title: Letters to a Friend\n- page: p. 44\n- circa: true\n",
			want: Utterance{
				Quote: "I have a bird in my hand.", Recipient: "Jawaharlal Nehru",
				Region: "Birbhum", WorkTitle: "Letters to a Friend", Locator: "p. 44",
				OccasionCirca: true,
			},
		},
		{
			name: "the aliases a person would type",
			md: "---\ntype: quotes\n---\n\n> a line\n" +
				"- to: Nehru\n- essay: On Liberty\n- section: §3\n- circa: yes\n",
			want: Utterance{
				Quote: "a line", Recipient: "Nehru", WorkTitle: "On Liberty",
				Locator: "§3", OccasionCirca: true,
			},
		},
		{
			name: "the other alias for a source title",
			md:   "---\ntype: quotes\n---\n\n> a line\n- work: On Liberty\n",
			want: Utterance{Quote: "a line", WorkTitle: "On Liberty"},
		},
		{
			// truthy() takes true/yes/1 and nothing else, exactly as favorite does, so
			// "- circa: false" is off rather than a parse error.
			name: "circa is off unless it is truthy",
			md:   "---\ntype: quotes\n---\n\n> a line\n- circa: false\n",
			want: Utterance{Quote: "a line"},
		},
		{
			name: "keys still fold case",
			md:   "---\ntype: quotes\n---\n\n> a line\n- Region: Sylhet\n- CIRCA: 1\n",
			want: Utterance{Quote: "a line", Region: "Sylhet", OccasionCirca: true},
		},
		{
			// THE KEY THIS PARSER DELIBERATELY DOES NOT HAVE. `locator` belongs to the
			// anthology export, which writes a JOINED DISPLAY STRING under it — and
			// applyQuoteBinding is shared by both parsers, so accepting it here would
			// pour "7 · The Fall · p. 288" into a page field on every anthology
			// re-import. The line is ignored, as any unknown binding is.
			name: "an anthology's locator is not a page",
			md:   "---\ntype: quotes\n---\n\n> a line\n- locator: 7 · The Fall · p. 288\n",
			want: Utterance{Quote: "a line"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			us, err := QuoteMarkdownAll(strings.NewReader(tc.md))
			if err != nil {
				t.Fatal(err)
			}
			if len(us) != 1 {
				t.Fatalf("expected one quote, got %d: %+v", len(us), us)
			}
			if !reflect.DeepEqual(us[0], tc.want) {
				t.Fatalf("utterance = %+v, want %+v", us[0], tc.want)
			}
		})
	}
}
