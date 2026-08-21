package importer

import (
	"os"
	"path/filepath"
	"strconv"
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

// The owner's whole Bookcision export folder, gitignored for privacy like the
// single-file fixture above. That one pins exact values for one book; this one
// asks a weaker question of twenty real exports at once — does every one of
// them parse, and does the clipping-limit filter hold across all of them —
// which is the shape a format regression actually shows up in. Skips when the
// folder is absent, as CI's is.
func TestBookcisionRealCorpus(t *testing.T) {
	files, err := filepath.Glob("testdata/bookcision_real/*.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(files) == 0 {
		t.Skip("real Bookcision corpus not present (gitignored — owner privacy)")
	}
	var total int
	for _, path := range files {
		t.Run(filepath.Base(path), func(t *testing.T) {
			f, err := os.Open(path)
			if err != nil {
				t.Fatal(err)
			}
			defer f.Close()
			res, err := Bookcision(f)
			if err != nil {
				t.Fatalf("parse: %v", err)
			}
			if res.Book.Title == "" {
				t.Fatal("no title")
			}
			if res.Book.Author == "" {
				t.Errorf("%q: no author", res.Book.Title)
			}
			if res.Book.ASIN == "" {
				t.Errorf("%q: no ASIN", res.Book.Title)
			}
			if len(res.Annotations) == 0 {
				t.Fatalf("%q: no annotations", res.Book.Title)
			}
			for i, a := range res.Annotations {
				if a.Quote == "" && a.Note == "" {
					t.Fatalf("annotation %d: neither quote nor note", i)
				}
				// The DRM clipping-limit notice is Amazon's, not the reader's:
				// it must never survive into a quote or a note.
				if strings.Contains(a.Quote, clippingLimitPrefix) ||
					strings.Contains(a.Note, clippingLimitPrefix) {
					t.Fatalf("annotation %d: clipping-limit notice leaked: %+v", i, a)
				}
				if a.Location != "" {
					if _, err := strconv.Atoi(a.Location); err != nil {
						t.Errorf("annotation %d: location %q is not a number", i, a.Location)
					}
				}
			}
			total += len(res.Annotations)
			t.Logf("%q by %s (%s): %d annotations",
				res.Book.Title, res.Book.Author, res.Book.ASIN, len(res.Annotations))
		})
	}
	t.Logf("parsed %d files, %d annotations", len(files), total)
}
