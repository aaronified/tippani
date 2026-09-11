package httpapi

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"tippani/internal/importer"
)

const fixtures = "../importer/testdata"

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(fixtures, name))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// importAs posts to /import/auto with the reader's "Read this as…" override.
func (c *testClient) importAs(name string, content []byte, as string) *httptest.ResponseRecorder {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if as != "" {
		if err := mw.WriteField("as", as); err != nil {
			c.t.Fatal(err)
		}
	}
	fw, err := mw.CreateFormFile("file", name)
	if err != nil {
		c.t.Fatal(err)
	}
	if _, err := fw.Write(content); err != nil {
		c.t.Fatal(err)
	}
	_ = mw.Close()
	return c.doRaw("POST", "/import/auto", &buf, mw.FormDataContentType())
}

type autoReply struct {
	stageReply
	Source   string `json:"source"`
	NearMiss string `json:"near_miss"`
	Error    string `json:"error"`
}

// EVERY FIXTURE LANDS THROUGH ONE ENDPOINT, UNDER A NAME THAT SAYS NOTHING.
//
// This is the whole change: import was seven cards and the card you pressed
// chose the parser. Each file below is posted as "notes" — no extension, nothing
// to route on — and the reply names the source the bytes were read as.
func TestAutoImportReadsTheBytesAndNotTheName(t *testing.T) {
	cases := []struct {
		file   string
		source string
	}{
		{"markdown_frontmatter.md", importer.SourceMarkdown},
		{"markdown_readest_synth.md", importer.SourceMarkdown},
		{"readest_annotations_synth.json", importer.SourceReadestJSON},
		{"amazon_notebook_synth.htm", importer.SourceKindleNotebook},
		{"goodreads_synth.htm", importer.SourceGoodreadsHTML},
		{"hardcover_synth.htm", importer.SourceHardcoverHTML},
		{"imdb_synth.htm", importer.SourceIMDb},
	}
	for _, tc := range cases {
		t.Run(tc.file, func(t *testing.T) {
			h := newTestServer(t).Handler()
			c := signupAdmin(t, h)
			rec := c.importAs("notes", fixture(t, tc.file), "")
			if rec.Code != http.StatusOK {
				t.Fatalf("posted as %q: %d %s", "notes", rec.Code, rec.Body)
			}
			got := decode[autoReply](t, rec)
			if got.Source != tc.source {
				t.Fatalf("read as %q, want %q", got.Source, tc.source)
			}
			if got.Staged == 0 {
				t.Fatalf("nothing staged: %+v", got)
			}
		})
	}
}

// The extension is never consulted, so a WRONG one must change nothing. A
// Readest JSON saved as .txt and an IMDb page saved as .json are both files a
// reader actually has.
func TestAutoImportIgnoresAMisleadingExtension(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	for _, name := range []string{"annotations.txt", "annotations.htm", "annotations"} {
		rec := c.importAs(name, fixture(t, "readest_annotations_synth.json"), "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", name, rec.Code, rec.Body)
		}
		if got := decode[autoReply](t, rec); got.Source != importer.SourceReadestJSON {
			t.Fatalf("%s read as %q", name, got.Source)
		}
	}
}

// ONE TARGET INVITES EVERY FILE A READER HAS. Answering "unrecognised" to a
// backup archive — or to the app's own export, which is a zip — is a worse
// failure than the wall of cards was, so each is named and nothing is staged.
func TestAutoImportNamesWhatTheFileActuallyIs(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	cases := []struct {
		name string
		data []byte
		miss string
	}{
		{"a backup", []byte("TPBK\x01\x01" + strings.Repeat("\x00", 40)), "backup"},
		{"an export archive", []byte("PK\x03\x04\x14\x00\x00\x00\x08\x00"), "zip"},
		{"a cover", []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), "image"},
		{"a typeface", []byte("wOF2\x00\x01\x00\x00"), "font"},
	}
	for _, tc := range cases {
		rec := c.importAs("dropped", tc.data, "")
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: got %d, want 400: %s", tc.name, rec.Code, rec.Body)
		}
		got := decode[autoReply](t, rec)
		if got.NearMiss != tc.miss {
			t.Fatalf("%s: near_miss = %q, want %q", tc.name, got.NearMiss, tc.miss)
		}
		if got.Error == "" {
			t.Fatalf("%s: no sentence beside the key", tc.name)
		}
	}
	// Nothing above may have staged a batch.
	if q := queue(t, c, ""); len(q.Batches) != 0 {
		t.Fatalf("a near-miss staged something: %+v", q.Batches)
	}
}

// A text file nothing can read is TIP-IMPORT-005: an empty near_miss, so the row
// draws "could not tell what this is" and offers "Read this as…". There was no
// code for this before, because the reader had already asserted the format.
func TestAutoImportAdmitsWhenItCannotTell(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	rec := c.importAs("shelf.csv", []byte("title,author,rating\nDune,Herbert,5\n"), "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400: %s", rec.Code, rec.Body)
	}
	got := decode[autoReply](t, rec)
	if got.NearMiss != "" || got.Error == "" {
		t.Fatalf("a CSV should be an admitted unknown, got %+v", got)
	}
}

// THE OVERRIDE IS A SECOND DOOR, NOT A FRONT ONE — and it outranks the sniffer,
// because detection can be wrong in a way the staging queue cannot repair:
// retarget moves staged rows between works, not a file between parsers.
func TestAutoImportOverrideOutranksTheSniffer(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	// A Goodreads page read as Hardcover: the reader is wrong, and the answer is
	// that source's own error rather than a silent empty import.
	rec := c.importAs("saved.html", fixture(t, "goodreads_synth.htm"), importer.SourceHardcoverHTML)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want the Hardcover parser's refusal: %s", rec.Code, rec.Body)
	}
	if body := rec.Body.String(); !strings.Contains(body, "hardcover") {
		t.Fatalf("the override did not reach the named parser: %s", body)
	}
	// And the right way round: the same file, read as what it is.
	ok := c.importAs("saved.html", fixture(t, "goodreads_synth.htm"), importer.SourceGoodreadsHTML)
	if ok.Code != http.StatusOK {
		t.Fatalf("override to the correct source: %d %s", ok.Code, ok.Body)
	}
	if got := decode[autoReply](t, ok); got.Source != importer.SourceGoodreadsHTML {
		t.Fatalf("source = %q", got.Source)
	}
}

// An unknown slug is a client bug rather than a file problem, and saying so beats
// silently sniffing instead — a reader who picked "Kobo" from a stale build would
// otherwise see their file imported as something else with no explanation.
func TestAutoImportRefusesAnUnknownOverride(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	rec := c.importAs("x.md", []byte("# A Title\n\n> A line.\n"), "kobo")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400: %s", rec.Code, rec.Body)
	}
}

// The eighth source, end to end: the notes, the colours, the reading progress and
// the two counters for what Readest carries and Tippani cannot.
func TestReadestJSONImportsWhatTheMarkdownCannot(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	type readestReply struct {
		autoReply
		ColorsUnmapped int `json:"colors_unmapped"`
		StylesDropped  int `json:"styles_dropped"`
	}
	rec := c.importFile("/import/readest-json", "annotations.json",
		fixture(t, "readest_annotations_synth.json"))
	if rec.Code != http.StatusOK {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	got := decode[readestReply](t, rec)
	if got.Staged != 4 {
		t.Fatalf("staged = %d, want 4 (the whitespace-only annotation is dropped)", got.Staged)
	}
	// A colour with no slot is COUNTED, not guessed to the nearest hue.
	if got.ColorsUnmapped != 2 || got.StylesDropped != 2 {
		t.Fatalf("counters = %d unmapped / %d styles, want 2/2", got.ColorsUnmapped, got.StylesDropped)
	}
	approved := decode[approveReply](t, c.do("POST", "/import/staged/approve",
		map[string]any{"batch_id": got.BatchID}))
	if approved.Added != 4 {
		t.Fatalf("approved %d, want 4: %+v", approved.Added, approved)
	}
	// The note is the thing the markdown path loses. It has to survive approval.
	// `{"annotations":[…]}`, not a bare array — the list endpoints in this app all
	// name their collection.
	list := decode[struct {
		Annotations []struct {
			Note    string `json:"note"`
			Color   string `json:"color"`
			NotedAt string `json:"noted_at"`
		} `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations", nil, 200))
	notes, green, dated := 0, 0, 0
	for _, a := range list.Annotations {
		if strings.TrimSpace(a.Note) != "" {
			notes++
		}
		if a.Color == "green" {
			green++
		}
		if strings.TrimSpace(a.NotedAt) != "" {
			dated++
		}
	}
	// THE THREE THINGS THE MARKDOWN EXPORT CANNOT CARRY, each asserted on the row
	// rather than on the parser: the note, the highlight's colour, and a real
	// timestamp. This is the case the whole eighth source exists for.
	if notes != 1 {
		t.Fatalf("the note did not survive: %d notes in %d annotations", notes, len(list.Annotations))
	}
	if green != 1 {
		t.Fatalf("the colour did not survive: %d green of %d", green, len(list.Annotations))
	}
	// Three of the four carry a createdAt; the fourth has none and must have no date
	// rather than the epoch.
	if dated != 3 {
		t.Fatalf("timestamps: %d dated of %d, want 3", dated, len(list.Annotations))
	}
}

// THE THREE TABLES MUST AGREE. A new source is a slug, a parser, a signature and
// a probe — and the way that goes wrong is a slug added to one table and not the
// others, which no fixture would catch because the new source's own test would
// pass while an old one silently lost its fallback.
func TestEverySourceSlugIsInEveryTable(t *testing.T) {
	if len(importSources) != len(importProbeOrder) {
		t.Fatalf("%d stagers but %d in the probe order", len(importSources), len(importProbeOrder))
	}
	seen := map[string]bool{}
	for _, source := range importProbeOrder {
		if seen[source] {
			t.Fatalf("%q is in the probe order twice", source)
		}
		seen[source] = true
		if _, ok := importSources[source]; !ok {
			t.Errorf("%q probes but has no stager", source)
		}
		if _, ok := importProbes[source]; !ok {
			t.Errorf("%q is in the probe order but has no probe", source)
		}
	}
	for source := range importSources {
		if !seen[source] {
			t.Errorf("%q stages but is not in the probe order, so it has no fallback", source)
		}
	}
	if len(importProbes) != len(importSources) {
		t.Fatalf("%d probes but %d stagers", len(importProbes), len(importSources))
	}
}

// Every per-source route still answers, because they are the API and the override
// names one. A route that 404s would take its source out of reach entirely.
func TestEveryPerSourceRouteStillExists(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	for _, route := range []string{
		"/import/markdown", "/import/readest-json", "/import/bookcision",
		"/import/hardcover-html", "/import/goodreads-html", "/import/kindle-notebook",
		"/import/imdb-quotes", "/import/kindle-clippings", "/import/auto",
	} {
		// An empty body is a 400 from readUpload; a missing route is a 404. Only the
		// second is a failure here.
		if rec := c.doRaw("POST", route, bytes.NewReader(nil), "multipart/form-data; boundary=x"); rec.Code == http.StatusNotFound {
			t.Errorf("%s is not routed", route)
		}
	}
}
