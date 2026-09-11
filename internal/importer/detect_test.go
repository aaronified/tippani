package importer

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Every committed fixture must detect as itself FROM ITS BYTES. The file is read
// and the name is then discarded — Detect has no filename parameter to give it to,
// which is the whole design: four of the seven sources this app has always
// supported are saved as ".html", so the extension never decided anything, and a
// test that passed because the fixture happened to be called ".json" would be the
// bug this function exists to prevent.
func TestDetectEveryFixtureFromItsBytesAlone(t *testing.T) {
	cases := map[string]string{
		"markdown_frontmatter.md":        SourceMarkdown,
		"markdown_readest_synth.md":      SourceMarkdown,
		"readest_annotations_synth.json": SourceReadestJSON,
		"amazon_notebook_synth.htm":      SourceKindleNotebook,
		"goodreads_synth.htm":            SourceGoodreadsHTML,
		"hardcover_synth.htm":            SourceHardcoverHTML,
		"imdb_synth.htm":                 SourceIMDb,
		"imdb_show_synth.htm":            SourceIMDb,
		"imdb_game_synth.htm":            SourceIMDb,
	}
	for name, want := range cases {
		data, err := os.ReadFile(filepath.Join("testdata", name))
		if err != nil {
			t.Fatal(err)
		}
		if got := Detect(data); got != want {
			t.Errorf("%s detected as %q, want %q", name, got, want)
		}
	}
}

// RENAMING A FIXTURE MUST CHANGE NOTHING, and this is the test that says so out
// loud even though Detect could not read a name if it wanted one: it copies each
// fixture to a temp file called "notes" with no extension and detects that. If
// a filename ever gets threaded in, this fails.
func TestDetectIgnoresTheNameEntirely(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{
		"readest_annotations_synth.json", "goodreads_synth.htm",
		"markdown_readest_synth.md", "imdb_synth.htm",
	} {
		data, err := os.ReadFile(filepath.Join("testdata", name))
		if err != nil {
			t.Fatal(err)
		}
		want := Detect(data)
		if want == "" {
			t.Fatalf("%s: nothing detected, so the rename proves nothing", name)
		}
		p := filepath.Join(dir, "notes")
		if err := os.WriteFile(p, data, 0o600); err != nil {
			t.Fatal(err)
		}
		renamed, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}
		if got := Detect(renamed); got != want {
			t.Errorf("%s renamed to %q detected as %q, want %q", name, "notes", got, want)
		}
	}
}

func TestDetectBookcisionByShapeNotBySubstring(t *testing.T) {
	real := `{"title":"A Book","asin":"B000","highlights":[{"text":"A line."}]}`
	if got := Detect([]byte(real)); got != SourceBookcision {
		t.Fatalf("bookcision export detected as %q", got)
	}
	// "title" and "text" are two of the commonest keys in JSON. Another tool's
	// export that happens to carry them in the wrong SHAPE must not be claimed.
	for _, body := range []string{
		`{"title":"A Book"}`,                             // no highlights
		`{"highlights":[{"text":"A line."}]}`,            // no title
		`{"title":"","highlights":[{"text":"A line."}]}`, // empty title
		`{"data":{"title":"x","text":"y"}}`,              // nested, not top level
	} {
		if got := Detect([]byte(body)); got == SourceBookcision {
			t.Errorf("claimed as bookcision: %s", body)
		}
	}
}

// The self-describing marker is checked BEFORE Bookcision's shape. The two cannot
// actually collide — Bookcision wants a top-level title and Readest's is at
// book.title — but ordering makes that a rule instead of a coincidence.
func TestDetectReadestOutranksBookcision(t *testing.T) {
	both := `{"$format":"readest-annotations","title":"Decoy","highlights":[{"text":"decoy"}],` +
		`"book":{"title":"The Real One"},"annotations":[{"text":"q"}]}`
	if got := Detect([]byte(both)); got != SourceReadestJSON {
		t.Fatalf("detected as %q, want %q", got, SourceReadestJSON)
	}
}

// Hardcover's data-page is a generic Inertia attribute: on its own it must not
// win, or every other Inertia app's saved page becomes a reading journal.
func TestDetectHardcoverNeedsTheComponentName(t *testing.T) {
	generic := `<!doctype html><div id="app" data-page="{&quot;component&quot;:&quot;Dashboard&quot;}"></div>`
	if got := Detect([]byte(generic)); got == SourceHardcoverHTML {
		t.Fatal("a generic Inertia page was claimed as Hardcover")
	}
}

// Goodreads needs both marks: authorOrTitle appears on pages carrying no quotes.
func TestDetectGoodreadsNeedsBothMarks(t *testing.T) {
	noQuotes := `<html><span class="authorOrTitle">Someone</span></html>`
	if got := Detect([]byte(noQuotes)); got == SourceGoodreadsHTML {
		t.Fatal("a page with no quotes was claimed as Goodreads")
	}
}

func TestDetectKindleClippings(t *testing.T) {
	body := "Dune (Frank Herbert)\r\n- Your Highlight on page 42 | Added on Sunday, 5 January 2020 21:41:19\r\n\r\n" +
		"Fear is the mind-killer.\r\n==========\r\n"
	if got := Detect([]byte(body)); got != SourceKindleClippings {
		t.Fatalf("clippings detected as %q", got)
	}
}

// A markdown file may legitimately carry a rule of '=' characters, and the
// clippings separator is the least specific mark in the table — so markdown
// answers first.
func TestDetectMarkdownOutranksASetextRule(t *testing.T) {
	body := "# A Title\n\nSome prose.\n\n==========\n\nMore prose.\n"
	if got := Detect([]byte(body)); got != SourceMarkdown {
		t.Fatalf("detected as %q, want %q", got, SourceMarkdown)
	}
}

// "" rather than a guess. MarkdownKind's fall-through to KindBook is the
// behaviour deliberately not copied: it is how a film with no director
// re-imported its own export as a book, silently.
func TestDetectAnswersNothingRatherThanGuessing(t *testing.T) {
	for _, body := range []string{
		"",
		"just some prose with no marks at all\n",
		"a,b,c\n1,2,3\n", // a CSV: roadmap §8, and it has to ASK about its columns
		"<html><body><p>An ordinary web page.</p></body></html>",
	} {
		if got := Detect([]byte(body)); got != "" {
			t.Errorf("guessed %q for %q", got, body)
		}
	}
}

// One drop target invites every file a reader has, so each of these is NAMED
// rather than refused. Answering "unrecognised" to a backup archive — or to the
// app's own export, which is a zip — is a worse failure than the wall of cards.
func TestNearMissNamesWhatTheFileActuallyIs(t *testing.T) {
	epub := append([]byte("PK\x03\x04"), []byte("\x00\x00mimetypeapplication/epub+zip")...)
	cases := []struct {
		name string
		data []byte
		want string
	}{
		{"backup", []byte("TPBK\x01\x01" + strings.Repeat("\x00", 40)), "backup"},
		{"zip", []byte("PK\x03\x04\x14\x00\x00\x00\x08\x00"), "zip"},
		{"epub", epub, "epub"},
		{"png", []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), "image"},
		{"jpeg", []byte("\xff\xd8\xff\xe0\x00\x10JFIF"), "image"},
		{"gif", []byte("GIF89a\x01\x00\x01\x00"), "image"},
		{"webp", []byte("RIFF\x24\x00\x00\x00WEBPVP8 "), "image"},
		{"woff2", []byte("wOF2\x00\x01\x00\x00"), "font"},
		{"truetype", []byte("\x00\x01\x00\x00\x00\x0c\x00\x80"), "font"},
		{"otf", []byte("OTTO\x00\x0a\x00\x80"), "font"},
		{"some other binary", []byte("\x7fELF\x02\x01\x01\x00"), "binary"},
	}
	for _, tc := range cases {
		if got := NearMiss(tc.data); got != tc.want {
			t.Errorf("%s: NearMiss = %q, want %q", tc.name, got, tc.want)
		}
		// Every one of them is also NOT an import, which is the half that matters:
		// a near-miss that Detect claimed would be parsed rather than named.
		if got := Detect(tc.data); got != "" {
			t.Errorf("%s: Detect claimed it as %q", tc.name, got)
		}
	}
}

// A text file this build simply cannot read is not a near-miss either, and saying
// "that's a font" about a CSV would be worse than saying nothing.
func TestNearMissIsSilentAboutOrdinaryText(t *testing.T) {
	for _, body := range []string{"a,b,c\n1,2,3\n", "just prose\n", ""} {
		if got := NearMiss([]byte(body)); got != "" && got != "binary" {
			t.Errorf("%q named as %q", body, got)
		}
	}
	if got := NearMiss([]byte("a,b,c\n")); got != "" {
		t.Errorf("a CSV named as %q", got)
	}
}

// The one cheap gate before any signature runs. Every format this app imports is
// text a person could open in an editor, so this separates every near-miss above
// from every real import in one check.
func TestLooksLikeText(t *testing.T) {
	if !LooksLikeText([]byte("# A heading\n")) {
		t.Fatal("markdown is not text")
	}
	if !LooksLikeText([]byte("\ufeff{\"a\":1}")) {
		t.Fatal("a BOM made it not text")
	}
	if LooksLikeText([]byte("PK\x03\x04\x00\x00")) {
		t.Fatal("a NUL-bearing archive read as text")
	}
	if LooksLikeText(nil) {
		t.Fatal("nothing read as text")
	}
	// Invalid UTF-8 in a small file is not text; a rune cut in half at the gate in
	// a LARGE one is not a broken file, so the check applies only to whole files.
	if LooksLikeText([]byte("\xff\xfe\xfd")) {
		t.Fatal("invalid UTF-8 read as text")
	}
	big := append([]byte(strings.Repeat("a", 8<<10)), 0xE0) // truncated rune past the gate
	if !LooksLikeText(big) {
		t.Fatal("a rune cut at the gate failed a 8 KiB+ file")
	}
}

// Detect must not walk a 5 MB upload looking for a mark no format writes past its
// own head. The cap is what makes the sniff cheap; this pins that a signature
// beyond it does not answer.
func TestDetectOnlyReadsTheHead(t *testing.T) {
	body := append([]byte(strings.Repeat("x\n", detectHead)), []byte("\n==========\n")...)
	if got := Detect(body); got != "" {
		t.Fatalf("a mark past the head answered %q", got)
	}
}
