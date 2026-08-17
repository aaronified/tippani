package importer

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

// full example from PLAN 5b.
const mdFull = `---
title: The Book Title
author: Author Name
isbn: 9780000000000
---

## Chapter 3 — The Turning Point

> The quote text, which may span
> multiple lines.
- note: my thought about it
- color: yellow
- tags: philosophy, memory
- loc: p.142
`

// Each case parses one inline markdown file and pins the whole result — the
// book header and every field of every annotation.
func TestMarkdownParses(t *testing.T) {
	cases := []struct {
		name     string
		in       string
		wantBook Book
		want     []Annotation
	}{
		{
			name:     "the full frontmatter example",
			in:       mdFull,
			wantBook: Book{Title: "The Book Title", Author: "Author Name", ISBN: "9780000000000"},
			want: []Annotation{{
				Quote:    "The quote text, which may span multiple lines.",
				Note:     "my thought about it",
				Chapter:  "Chapter 3 — The Turning Point",
				Location: "p.142",
				Color:    "yellow",
				Tags:     []string{"philosophy", "memory"},
			}},
		},
		{
			// The same file behind a BOM and CRLF endings must parse identically — that
			// this row's expectation repeats the row above is the point of the case.
			name:     "a BOM and CRLF line endings",
			in:       "\ufeff" + strings.ReplaceAll(mdFull, "\n", "\r\n"),
			wantBook: Book{Title: "The Book Title", Author: "Author Name", ISBN: "9780000000000"},
			want: []Annotation{{
				Quote:    "The quote text, which may span multiple lines.",
				Note:     "my thought about it",
				Chapter:  "Chapter 3 — The Turning Point",
				Location: "p.142",
				Color:    "yellow",
				Tags:     []string{"philosophy", "memory"},
			}},
		},
		{
			name:     "quotes with no metadata under them",
			in:       "---\ntitle: T\n---\n\n> bare quote\n\n> second   quote\n> continued\n",
			wantBook: Book{Title: "T"},
			want: []Annotation{
				{Quote: "bare quote"},
				{Quote: "second quote continued"}, // whitespace collapsed
			},
		},
		{
			name: "edges: junk prose, an empty quote, a repeated key, empty tags",
			in: "---\ntitle: T\nbogus: ignored\n---\n" +
				"junk prose line\n" +
				">\n\n" + // empty quote dropped
				"> q1\n- note: first\n- note: second\n- tags: a, , b ,\n" + // last wins; empty tags dropped
				"> new quote after metadata\n",
			wantBook: Book{Title: "T"},
			want: []Annotation{
				{Quote: "q1", Note: "second", Tags: []string{"a", "b"}},
				{Quote: "new quote after metadata"},
			},
		},
		{
			name: "favorite parsing",
			in: "---\ntitle: T\n---\n\n" +
				"> q1\n- favorite: yes\n\n" +
				"> q2\n- favorite: 1\n\n" +
				"> q3\n- favorite: nope\n- location: loc 9\n",
			wantBook: Book{Title: "T"},
			want: []Annotation{
				{Quote: "q1", Favorite: true},
				{Quote: "q2", Favorite: true},
				{Quote: "q3", Location: "loc 9"}, // "location" alias
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := Markdown(strings.NewReader(tc.in))
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(res.Book, tc.wantBook) {
				t.Fatalf("book = %+v, want %+v", res.Book, tc.wantBook)
			}
			if !reflect.DeepEqual(res.Annotations, tc.want) {
				t.Fatalf("annotations = %+v, want %+v", res.Annotations, tc.want)
			}
		})
	}
}

func TestMarkdownMissingFrontmatter(t *testing.T) {
	// Neither "---" nor "# " on the first non-blank line -> detection error.
	for _, in := range []string{"", "> just a quote\n", "title: T\n---\n", "## heading only\n> q\n"} {
		if _, err := Markdown(strings.NewReader(in)); err == nil {
			t.Fatalf("no error for %q", in)
		}
	}
	// frontmatter present but no title
	if _, err := Markdown(strings.NewReader("---\nauthor: A\n---\n")); err == nil {
		t.Fatal("no error for missing title")
	}
}

// Committed fixture covering the PLAN 5b(a) alias keys (page/colour),
// favorite bindings, and bare quotes with no bindings at all.
func TestMarkdownFrontmatterFixture(t *testing.T) {
	f, err := os.Open("testdata/markdown_frontmatter.md")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	res, err := Markdown(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "The Book Title" || res.Book.ISBN != "9780000000000" {
		t.Fatalf("book = %+v", res.Book)
	}
	if len(res.Annotations) != 4 {
		t.Fatalf("got %d annotations: %+v", len(res.Annotations), res.Annotations)
	}
	if a := res.Annotations[0]; a.Note != "my thought about it" || a.Location != "p.142" {
		t.Fatalf("first = %+v", a)
	}
	if a := res.Annotations[1]; a.Note != "" || a.Color != "" || a.Tags != nil || a.Favorite {
		t.Fatalf("bare quote = %+v", a)
	}
	a := res.Annotations[2]
	if a.Chapter != "Chapter 5" || a.Location != "201" || // "page" alias
		!reflect.DeepEqual(a.Tags, []string{"resilience"}) {
		t.Fatalf("aliases = %+v", a)
	}
	a = res.Annotations[3]
	if !a.Favorite || a.Color != "blue" { // "colour" alias
		t.Fatalf("favorite/colour = %+v", a)
	}
}

// Committed synthetic Readest export (PLAN 5b(b)); the real one is
// gitignored and covered by TestMarkdownReadestReal.
func TestMarkdownReadestSynth(t *testing.T) {
	f, err := os.Open("testdata/markdown_readest_synth.md")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	res, err := Markdown(f)
	if err != nil {
		t.Fatal(err)
	}
	want := Book{Title: "The Synthetic Compendium", Author: "Ada Example"}
	if !reflect.DeepEqual(res.Book, want) {
		t.Fatalf("book = %+v", res.Book)
	}
	if len(res.Annotations) != 3 {
		t.Fatalf("got %d annotations: %+v", len(res.Annotations), res.Annotations)
	}
	expect := []Annotation{
		{Quote: "A first synthetic quote.", Chapter: "Chapter One", Location: "p.10"},
		{Quote: "A second quote that spans two source lines.", Chapter: "Chapter One", Location: "p.20"},
		{Quote: "The third and final quote.", Chapter: "Chapter Two", Location: "p.30"},
	}
	if !reflect.DeepEqual(res.Annotations, expect) {
		t.Fatalf("annotations = %+v", res.Annotations)
	}
}

// A multi-book export (exportSet joins per-book frontmatter blocks with a blank
// line) must round-trip as many books — the second book's quotes must NOT leak
// into the first (the pre-fix bug).
func TestMarkdownAllMultiBook(t *testing.T) {
	multi := "---\ntitle: First Book\nauthor: A. One\n---\n\n" +
		"## Chapter 1\n\n> Quote from the first book.\n- loc: p.10\n\n" +
		"---\ntitle: Second Book\nauthor: B. Two\nisbn: 9780000000001\n---\n\n" +
		"> Quote from the second book.\n\n> Another second-book quote.\n"
	res, err := MarkdownAll(strings.NewReader(multi))
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 2 {
		t.Fatalf("got %d books, want 2", len(res))
	}
	if res[0].Book.Title != "First Book" || len(res[0].Annotations) != 1 {
		t.Fatalf("book 0 = %+v / %d anns", res[0].Book, len(res[0].Annotations))
	}
	if a := res[0].Annotations[0]; a.Quote != "Quote from the first book." || a.Chapter != "Chapter 1" || a.Location != "p.10" {
		t.Fatalf("book 0 ann leaked/wrong: %+v", a)
	}
	if res[1].Book.Title != "Second Book" || res[1].Book.ISBN != "9780000000001" {
		t.Fatalf("book 1 = %+v", res[1].Book)
	}
	if len(res[1].Annotations) != 2 {
		t.Fatalf("book 1 got %d annotations, want 2", len(res[1].Annotations))
	}
}

// A single-book file (frontmatter or Readest) yields exactly one Result via
// MarkdownAll, so the import handler can treat every markdown upload uniformly.
func TestMarkdownAllSingle(t *testing.T) {
	res, err := MarkdownAll(strings.NewReader(mdFull))
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 1 || res[0].Book.Title != "The Book Title" || len(res[0].Annotations) != 1 {
		t.Fatalf("single-book MarkdownAll = %d books", len(res))
	}
}

func TestMarkdownReadestReal(t *testing.T) {
	f, err := os.Open("testdata/markdown_real.md")
	if err != nil {
		t.Skip("real Readest fixture not present (gitignored — owner privacy)")
	}
	defer f.Close()
	res, err := Markdown(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "Dust of Dreams" || res.Book.Author != "Steven Erikson" {
		t.Fatalf("book = %+v", res.Book)
	}
	if len(res.Annotations) != 24 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	a := res.Annotations[0]
	if a.Chapter != "Chapter Thirteen" || a.Location != "p.825" ||
		!strings.HasPrefix(a.Quote, "Withal scratched his head.") {
		t.Fatalf("first = %+v", a)
	}
	for i, a := range res.Annotations {
		if a.Quote == "" || a.Chapter == "" || a.Location == "" {
			t.Fatalf("annotation %d incomplete: %+v", i, a)
		}
		if a.Note != "" || a.Color != "" || a.Tags != nil { // format carries none of these
			t.Fatalf("annotation %d has unexpected metadata: %+v", i, a)
		}
	}
}
