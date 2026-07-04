package importer

import (
	"os"
	"strings"
	"testing"
)

func TestBookcisionRealExport(t *testing.T) {
	f, err := os.Open("testdata/bookcision_real.json")
	if err != nil {
		t.Skip("real Bookcision fixture not present (gitignored — owner privacy)")
	}
	defer f.Close()
	res, err := Bookcision(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "Deadhouse Gates: Malazan Book of the Fallen 2 (The Malazan Book Of The Fallen)" {
		t.Fatalf("title = %q", res.Book.Title)
	}
	if res.Book.Author != "Steven Erikson" {
		t.Fatalf("author = %q", res.Book.Author)
	}
	if res.Book.ASIN != "B0031RS6PU" {
		t.Fatalf("asin = %q", res.Book.ASIN)
	}
	if len(res.Annotations) != 11 {
		t.Fatalf("got %d annotations", len(res.Annotations))
	}
	if got := res.Annotations[0].Location; got != "254" {
		t.Fatalf("first location = %q", got)
	}
	if got := res.Annotations[10].Location; got != "12240" {
		t.Fatalf("last location = %q", got)
	}
	for i, a := range res.Annotations {
		if a.Quote == "" || a.Note != "" { // real export: all highlights, all notes null
			t.Fatalf("annotation %d = %+v", i, a)
		}
	}
}

func TestBookcisionVariants(t *testing.T) {
	in := `{
		"title": "T", "authors": ["A One", "B Two"], "asin": "B000",
		"highlights": [
			{"text": "plain highlight", "isNoteOnly": false, "note": null,
			 "location": {"url": "kindle://x", "value": 42}},
			{"text": "highlighted text", "isNoteOnly": true, "note": "the note",
			 "location": {"value": 43}},
			{"text": "note-only fallback", "isNoteOnly": true, "note": null},
			{"text": "<You have reached the clipping limit for this item>",
			 "isNoteOnly": false, "note": null, "location": {"value": 44}},
			{"text": "  ", "isNoteOnly": false, "note": null}
		]}`
	res, err := Bookcision(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Author != "A One, B Two" {
		t.Fatalf("author = %q", res.Book.Author)
	}
	if len(res.Annotations) != 3 { // clipping-limit + empty entries skipped
		t.Fatalf("got %d annotations: %+v", len(res.Annotations), res.Annotations)
	}
	if a := res.Annotations[0]; a.Quote != "plain highlight" || a.Note != "" || a.Location != "42" {
		t.Fatalf("highlight = %+v", a)
	}
	if a := res.Annotations[1]; a.Quote != "" || a.Note != "the note" || a.Location != "43" {
		t.Fatalf("note-only = %+v", a)
	}
	if a := res.Annotations[2]; a.Quote != "" || a.Note != "note-only fallback" || a.Location != "" {
		t.Fatalf("note-only fallback = %+v", a)
	}
}

func TestBookcisionErrors(t *testing.T) {
	for _, in := range []string{"", "not json", `{"authors":"A","highlights":[]}`, `{"title":"  "}`} {
		if _, err := Bookcision(strings.NewReader(in)); err == nil {
			t.Fatalf("no error for %q", in)
		}
	}
}
