package importer

import (
	"os"
	"strings"
	"testing"
)

func openSynthReadest(t *testing.T) *os.File {
	t.Helper()
	f, err := os.Open("testdata/readest_annotations_synth.json")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { f.Close() })
	return f
}

func TestReadestJSONSynth(t *testing.T) {
	res, _, err := ReadestJSON(openSynthReadest(t))
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title != "The Synthetic Compendium" || res.Book.Author != "Ada Example" {
		t.Fatalf("book = %+v", res.Book)
	}
	// progress [879, 1837] -> the shape a frontmatter "page: 128/320" already has.
	if res.Book.Pos != 879 || res.Book.PosTotal != 1837 {
		t.Fatalf("pos = %d/%d", res.Book.Pos, res.Book.PosTotal)
	}
	// Five annotations in the file; the whitespace-only one carries neither a quote
	// nor a note and is dropped rather than stored as an empty row.
	if len(res.Annotations) != 4 {
		t.Fatalf("got %d annotations: %+v", len(res.Annotations), res.Annotations)
	}
	a := res.Annotations[0]
	if a.Quote != "A first synthetic quote." || a.Color != "green" {
		t.Fatalf("first = %+v", a)
	}
	// createdAt is milliseconds, rendered UTC: the JSON export's whole advantage
	// over the markdown one, which carries the exporting device's locale string.
	if a.NotedAt != "2026-01-01T08:30:00Z" {
		t.Fatalf("noted_at = %q", a.NotedAt)
	}
	// THE NOTE IS THE POINT. The markdown parser dropped it for two releases.
	if res.Annotations[1].Note != "The note the markdown export writes on its own line." {
		t.Fatalf("note = %q", res.Annotations[1].Note)
	}
	if res.Annotations[1].Color != "yellow" {
		t.Fatalf("yellow maps to itself, got %q", res.Annotations[1].Color)
	}
}

// Two colours in the fixture have no slot — Readest's `red`, and a `chartreuse`
// this build has never seen. Both land in slot 1 ("nobody chose") rather than at
// the nearest hue, and both are counted so the row can say so.
func TestReadestUnmappedColoursAreCountedNotGuessed(t *testing.T) {
	res, stats, err := ReadestJSON(openSynthReadest(t))
	if err != nil {
		t.Fatal(err)
	}
	if stats.ColorUnmapped != 2 {
		t.Fatalf("ColorUnmapped = %d, want 2", stats.ColorUnmapped)
	}
	for _, i := range []int{2, 3} {
		if got := res.Annotations[i].Color; got != "" {
			t.Fatalf("annotation %d colour = %q, want \"\" (the server's slot 1)", i, got)
		}
	}
	// "pink" is the nearest hue to red and is deliberately NOT used: a slot carries
	// a meaning a reader may have renamed, so filing their red highlights under it
	// asserts a category they never chose.
	for _, a := range res.Annotations {
		if a.Color == "pink" {
			t.Fatalf("a colour was guessed to the nearest hue: %+v", a)
		}
	}
}

// squiggly and underline are Readest's own styles. Tippani stores a colour per
// quote and no style, so the distinction is dropped — and counted, on the My
// Clippings precedent that a parser returning less than the file held must say so.
func TestReadestDroppedStylesAreCounted(t *testing.T) {
	_, stats, err := ReadestJSON(openSynthReadest(t))
	if err != nil {
		t.Fatal(err)
	}
	if stats.StyleDropped != 2 {
		t.Fatalf("StyleDropped = %d, want 2 (squiggly + underline)", stats.StyleDropped)
	}
}

// An annotation whose createdAt is absent or zero gets no date rather than the
// epoch — 1 January 1970 is not a highlight anybody made.
func TestReadestMissingTimestampIsNoDate(t *testing.T) {
	res, _, err := ReadestJSON(openSynthReadest(t))
	if err != nil {
		t.Fatal(err)
	}
	if got := res.Annotations[3].NotedAt; got != "" {
		t.Fatalf("noted_at with createdAt 0 = %q, want empty", got)
	}
}

// The marker is CHECKED, not assumed. This parser is reachable from the "Read
// this as…" override, where the reader has asserted a format the sniffer
// disagreed with — and a Bookcision export decodes into this struct with every
// field empty, which would otherwise be a titleless book rather than an error.
func TestReadestRefusesAFileThatIsNotOne(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"bookcision", `{"title":"A Book","highlights":[{"text":"x"}]}`},
		{"empty object", `{}`},
		{"wrong format marker", `{"$format":"something-else","book":{"title":"T"}}`},
		{"not json", "# A Markdown File\n"},
	} {
		if _, _, err := ReadestJSON(strings.NewReader(tc.body)); err == nil {
			t.Fatalf("%s: accepted as a Readest export", tc.name)
		}
	}
}

// A file with the right marker and no annotations is an error, not an empty book:
// staging a title with nothing under it is a row the reader has to go and delete.
func TestReadestRefusesAnEmptyExport(t *testing.T) {
	body := `{"$format":"readest-annotations","book":{"title":"T"},"annotations":[]}`
	if _, _, err := ReadestJSON(strings.NewReader(body)); err == nil {
		t.Fatal("an export with no annotations was accepted")
	}
}

// A UTF-8 BOM is tolerated, as every other parser in this package tolerates one.
func TestReadestToleratesABOM(t *testing.T) {
	body := "\ufeff" + `{"$format":"readest-annotations","book":{"title":"T"},"annotations":[{"text":"q"}]}`
	if _, _, err := ReadestJSON(strings.NewReader(body)); err != nil {
		t.Fatalf("BOM: %v", err)
	}
}

// The real export is somebody's library and cannot be committed; a parser written
// against a guessed shape is a guess. This runs when the file is installed and
// skips when it is not (PLAN's rule, and .gitignore's *_real.* glob).
func TestReadestJSONReal(t *testing.T) {
	f, err := os.Open("testdata/readest_json_real.json")
	if err != nil {
		t.Skip("testdata/readest_json_real.json not installed")
	}
	defer f.Close()
	res, stats, err := ReadestJSON(f)
	if err != nil {
		t.Fatal(err)
	}
	if res.Book.Title == "" || len(res.Annotations) == 0 {
		t.Fatalf("real export parsed empty: %+v", res.Book)
	}
	notes := 0
	for _, a := range res.Annotations {
		if a.Note != "" {
			notes++
		}
	}
	t.Logf("real export: %d annotations, %d notes, %d unmapped colours, %d dropped styles, pos %d/%d",
		len(res.Annotations), notes, stats.ColorUnmapped, stats.StyleDropped, res.Book.Pos, res.Book.PosTotal)
}
