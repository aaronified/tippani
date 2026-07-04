package importer

import (
	"html"
	"os"
	"reflect"
	"strings"
	"testing"
)

// Committed synthetic journal page (PLAN 5e); the real one is gitignored
// and covered by TestHardcoverRealExport.
func TestHardcoverSynth(t *testing.T) {
	f, err := os.Open("testdata/hardcover_synth.htm")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	res, err := HardcoverHTML(f)
	if err != nil {
		t.Fatal(err)
	}
	// Narrator filtered from the author; isbn/asin come from the first quote
	// entry's edition.
	want := Book{Title: "The Synthetic Compendium", Author: "Ada Example",
		ISBN: "9780000000002", ASIN: "B00SYNTH42"}
	if res.Book != want {
		t.Fatalf("book = %+v", res.Book)
	}
	if len(res.Annotations) != 2 { // the progress_updated event is ignored
		t.Fatalf("got %d annotations: %+v", len(res.Annotations), res.Annotations)
	}
	a := res.Annotations[0]
	if a.Quote != "A first synthetic quote." || a.Location != "p.12" {
		t.Fatalf("first = %+v", a)
	}
	if !reflect.DeepEqual(a.Tags, []string{"wisdom", "craft", "night"}) { // 42 dropped
		t.Fatalf("tags = %v", a.Tags)
	}
	b := res.Annotations[1]
	if b.Quote != "A second synthetic quote, untagged." || b.Location != "" || b.Tags != nil {
		t.Fatalf("second = %+v", b) // non-"pages" position dropped
	}
}

func TestHardcoverRealExport(t *testing.T) {
	f, err := os.Open("testdata/hardcover_html_real.htm")
	if err != nil {
		t.Skip("real Hardcover fixture not present (gitignored — owner privacy)")
	}
	defer f.Close()
	res, err := HardcoverHTML(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "Dust of Dreams" {
		t.Fatalf("title = %q", res.Book.Title)
	}
	// The narrator ("Michael Page") must not leak into the author.
	if res.Book.Author != "Steven Erikson" {
		t.Fatalf("author = %q", res.Book.Author)
	}
	if res.Book.ISBN != "9781409091530" {
		t.Fatalf("isbn = %q", res.Book.ISBN)
	}
	if len(res.Annotations) != 45 { // 68 journal entries, 45 quotes
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	if got := res.Annotations[0].Location; got != "p.32" {
		t.Fatalf("first location = %q", got)
	}
	for i, a := range res.Annotations {
		if a.Quote == "" {
			t.Fatalf("annotation %d has empty quote", i)
		}
	}
}

// A page-position value large enough to overflow int must not wrap to a
// negative page number — it is treated as junk and the location dropped.
func TestHardcoverPositionOverflow(t *testing.T) {
	payload := `{"props":{"book":{"title":"Overflow","contributions":[{"author":{"name":"A"},"contribution":null}]},` +
		`"journals":[{"event":"quote","entry":"q","metadata":{"position":{"type":"pages","value":1e19}}}]}}`
	page := `<div id="app" data-page="` + html.EscapeString(payload) + `"></div>`
	res, err := HardcoverHTML(strings.NewReader(page))
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Annotations) != 1 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	if loc := res.Annotations[0].Location; loc != "" {
		t.Fatalf("overflowing page value should drop the location, got %q", loc)
	}
}

func TestHardcoverErrors(t *testing.T) {
	for _, in := range []string{
		"",
		"<html><body>no attribute here</body></html>",
		`<div id="app" data-page="{&#34;props&#34;:{}}"></div>`, // no title
		`<div id="app" data-page="not json"></div>`,
		`<div id="app" data-page="{`, // unterminated attribute
	} {
		if _, err := HardcoverHTML(strings.NewReader(in)); err == nil {
			t.Fatalf("no error for %q", in)
		}
	}
}
