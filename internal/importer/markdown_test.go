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

func TestMarkdownFull(t *testing.T) {
	res, err := Markdown(strings.NewReader(mdFull))
	if err != nil {
		t.Fatal(err)
	}
	want := Book{Title: "The Book Title", Author: "Author Name", ISBN: "9780000000000"}
	if res.Book != want {
		t.Fatalf("book = %+v", res.Book)
	}
	if len(res.Annotations) != 1 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	a := res.Annotations[0]
	if a.Quote != "The quote text, which may span multiple lines." {
		t.Fatalf("quote = %q", a.Quote)
	}
	if a.Note != "my thought about it" || a.Color != "yellow" || a.Location != "p.142" {
		t.Fatalf("bindings = %+v", a)
	}
	if a.Chapter != "Chapter 3 — The Turning Point" {
		t.Fatalf("chapter = %q", a.Chapter)
	}
	if !reflect.DeepEqual(a.Tags, []string{"philosophy", "memory"}) {
		t.Fatalf("tags = %v", a.Tags)
	}
}

func TestMarkdownBOMCRLF(t *testing.T) {
	in := "\ufeff" + strings.ReplaceAll(mdFull, "\n", "\r\n")
	res, err := Markdown(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Annotations) != 1 || res.Annotations[0].Quote != "The quote text, which may span multiple lines." {
		t.Fatalf("annotations = %+v", res.Annotations)
	}
}

func TestMarkdownQuoteWithoutMetadata(t *testing.T) {
	in := "---\ntitle: T\n---\n\n> bare quote\n\n> second   quote\n> continued\n"
	res, err := Markdown(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Annotations) != 2 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	if a := res.Annotations[0]; a.Quote != "bare quote" || a.Note != "" || a.Color != "" || a.Tags != nil {
		t.Fatalf("first = %+v", a)
	}
	if got := res.Annotations[1].Quote; got != "second quote continued" { // whitespace collapsed
		t.Fatalf("second = %q", got)
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

func TestMarkdownEdges(t *testing.T) {
	in := "---\ntitle: T\nbogus: ignored\n---\n" +
		"junk prose line\n" +
		">\n\n" + // empty quote dropped
		"> q1\n- note: first\n- note: second\n- tags: a, , b ,\n" + // last wins; empty tags dropped
		"> new quote after metadata\n"
	res, err := Markdown(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Annotations) != 2 {
		t.Fatalf("got %d annotations: %+v", len(res.Annotations), res.Annotations)
	}
	a := res.Annotations[0]
	if a.Note != "second" || !reflect.DeepEqual(a.Tags, []string{"a", "b"}) {
		t.Fatalf("first = %+v", a)
	}
	if res.Annotations[1].Quote != "new quote after metadata" {
		t.Fatalf("second = %+v", res.Annotations[1])
	}
}

// Committed fixture covering the PLAN 5b(a) alias keys (page/colour),
// favorite/rating bindings, and bare quotes with no bindings at all.
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
	if a := res.Annotations[1]; a.Note != "" || a.Color != "" || a.Tags != nil || a.Favorite || a.Rating != 0 {
		t.Fatalf("bare quote = %+v", a)
	}
	a := res.Annotations[2]
	if a.Chapter != "Chapter 5" || a.Location != "201" || // "page" alias
		!reflect.DeepEqual(a.Tags, []string{"resilience"}) {
		t.Fatalf("aliases = %+v", a)
	}
	a = res.Annotations[3]
	if !a.Favorite || a.Rating != 4 || a.Color != "blue" { // "colour" alias
		t.Fatalf("favorite/rating/colour = %+v", a)
	}
}

func TestMarkdownFavoriteRatingParsing(t *testing.T) {
	in := "---\ntitle: T\n---\n\n" +
		"> q1\n- favorite: yes\n- rating: 9\n\n" + // out-of-range rating ignored
		"> q2\n- favorite: 1\n- rating: five\n\n" + // non-numeric rating ignored
		"> q3\n- favorite: nope\n- location: loc 9\n"
	res, err := Markdown(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Annotations) != 3 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	if a := res.Annotations[0]; !a.Favorite || a.Rating != 0 {
		t.Fatalf("q1 = %+v", a)
	}
	if a := res.Annotations[1]; !a.Favorite || a.Rating != 0 {
		t.Fatalf("q2 = %+v", a)
	}
	if a := res.Annotations[2]; a.Favorite || a.Location != "loc 9" { // "location" alias
		t.Fatalf("q3 = %+v", a)
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
	if res.Book != want {
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
