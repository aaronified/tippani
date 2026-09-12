package httpapi

// THE EPUB IS A FILE ANOTHER PROGRAM HAS TO OPEN, which is why these assertions are
// about the container and not only about the words in it. A Markdown export that is
// subtly wrong still reads; an EPUB that is subtly wrong does not open, and the
// reader's device says so with no detail at all.
//
// WHAT AN epubcheck RUN WOULD ADD is real and is deliberately not attempted here:
// it is a Java tool, and the plan puts it in the by-hand list rather than in CI for
// the same reason there is no PDF library. What IS checked here is every constraint
// that has actually broken an EPUB in practice — the mimetype's bytes, its storage
// method and its position; the container pointing at a manifest that exists; the
// spine naming a file the manifest declares; and the identifier being stable.

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"
)

func exportEPUB(t *testing.T, c *testClient, id int64) *zip.Reader {
	t.Helper()
	res := c.mustDo("GET", "/anthologies/"+itoa(id)+"/export.epub", nil, http.StatusOK)
	if ct := res.Header().Get("Content-Type"); ct != "application/epub+zip" {
		t.Fatalf("Content-Type = %q", ct)
	}
	body := res.Body.Bytes()
	z, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatalf("the export is not a readable zip: %v", err)
	}
	return z
}

func epubFile(t *testing.T, z *zip.Reader, name string) string {
	t.Helper()
	for _, f := range z.File {
		if f.Name == name {
			rc, err := f.Open()
			if err != nil {
				t.Fatalf("opening %s: %v", name, err)
			}
			defer rc.Close()
			b, err := io.ReadAll(rc)
			if err != nil {
				t.Fatalf("reading %s: %v", name, err)
			}
			return string(b)
		}
	}
	names := []string{}
	for _, f := range z.File {
		names = append(names, f.Name)
	}
	t.Fatalf("%s is not in the book; it holds %v", name, names)
	return ""
}

// THE ONE THING THE FORMAT IS FUSSY ABOUT. The OCF spec makes `mimetype` the
// signature a reader sniffs before unzipping anything: exact bytes, stored rather
// than deflated, and the FIRST entry. Get any of the three wrong and an otherwise
// perfect book is "not an EPUB", with no further diagnosis from the device.
func TestTheEPUBOpensBecauseItsMimetypeIsRight(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Cities and their ghosts")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "utterance", "item_id": utt},
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
	})

	z := exportEPUB(t, c, a.ID)
	if len(z.File) == 0 {
		t.Fatal("the book is empty")
	}
	first := z.File[0]
	if first.Name != "mimetype" {
		t.Errorf("the first entry is %q, want mimetype", first.Name)
	}
	if first.Method != zip.Store {
		t.Errorf("mimetype is compressed (method %d), want stored", first.Method)
	}
	if got := epubFile(t, z, "mimetype"); got != "application/epub+zip" {
		t.Errorf("mimetype = %q", got)
	}
}

// THE THREE POINTERS THAT HAVE TO LINE UP. container -> OPF -> spine -> a file in
// the manifest. Each hop is a string written in one file and resolved in another,
// so a rename that updates two of the three produces a book that opens to nothing.
func TestTheEPUBsPartsPointAtEachOther(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Openings")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})

	z := exportEPUB(t, c, a.ID)
	container := epubFile(t, z, "META-INF/container.xml")
	if !strings.Contains(container, `full-path="OEBPS/content.opf"`) {
		t.Fatalf("the container does not point at the OPF:\n%s", container)
	}
	opf := epubFile(t, z, "OEBPS/content.opf")
	// Every file the manifest declares must actually be in the zip — this is the
	// hop that breaks silently, because a reader shows the book and then fails on
	// the page that needed the missing part.
	for _, href := range []string{"toc.ncx", "style.css", "anthology.xhtml"} {
		if !strings.Contains(opf, `href="`+href+`"`) {
			t.Errorf("the manifest does not declare %s:\n%s", href, opf)
		}
		epubFile(t, z, "OEBPS/"+href)
	}
	if !strings.Contains(opf, `<itemref idref="body"/>`) {
		t.Errorf("the spine does not name the body:\n%s", opf)
	}
	// The navMap names every entry, which is the table of contents an e-reader draws.
	ncx := epubFile(t, z, "OEBPS/toc.ncx")
	if !strings.Contains(ncx, "Invisible Cities") {
		t.Errorf("the table of contents does not name the entry:\n%s", ncx)
	}
}

// ONE BOOK UPDATED, NOT TWO BOOKS WITH THE SAME TITLE. An e-reader decides whether
// a sideloaded file is a new book or a newer copy of one it has by dc:identifier,
// so a fresh UUID per export fills a device with duplicates — a failure a reader
// only notices at ten.
func TestTheEPUBKeepsItsIdentityAcrossExports(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Openings")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})

	first := epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/content.opf")
	// Something changes between the two exports, so this cannot pass by the file
	// being byte-identical for an unrelated reason.
	setEntryNote(t, c, a.ID, "book", ann, "A second thought.")
	second := epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/content.opf")

	want := "urn:tippani:anthology:" + itoa(a.ID)
	for _, opf := range []string{first, second} {
		if !strings.Contains(opf, want) {
			t.Fatalf("the book's identifier is not %q:\n%s", want, opf)
		}
	}
}

// THE SAME DOCUMENT AS THE MARKDOWN, FROM THE SAME REGISTRY (0074) — which is
// 0045's promise extended to a second format rather than reimplemented beside it.
// A field switched off is absent from BOTH files, and a field switched on is in
// both.
func TestTheEPUBShowsWhatTheAnthologyWasToldToShow(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "A Wizard of Earthsea", "author": "Ursula K. Le Guin",
		"publisher": "Parnassus Press", "published_year": 1968, "isbn": "9780553383041",
	}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Only in silence the word,",
	}, http.StatusCreated))
	a := newAnthology(t, c, "Earthsea")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})
	setEntryNote(t, c, a.ID, "book", ann.ID, "The first line of it.")

	// OFF: the book carries an ISBN and a publisher and neither is asked for.
	body := epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/anthology.xhtml")
	if strings.Contains(body, "Parnassus") || strings.Contains(body, "9780553383041") {
		t.Errorf("a default anthology printed a work field:\n%s", body)
	}
	// The passage, the reader's commentary and the heading are there regardless.
	for _, want := range []string{
		"Only in silence the word,",
		"The first line of it.",
		"A Wizard of Earthsea — Ursula K. Le Guin",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %q from:\n%s", want, body)
		}
	}

	setFields(t, c, a.ID, "Earthsea", map[string]any{
		"fields": map[string]any{"publisher": true, "year": true},
	})
	body = epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/anthology.xhtml")
	if !strings.Contains(body, "Parnassus Press · 1968") {
		t.Errorf("the switched-on work fields did not reach the book:\n%s", body)
	}
	// AND THE ISBN IS STILL OFF, which is the half that proves the switch is being
	// read rather than everything being printed the moment anything is.
	if strings.Contains(body, "9780553383041") {
		t.Errorf("a field that was left off was printed:\n%s", body)
	}
	// THE ATTRIBUTION DOES NOT REPEAT THE HEADING. The heading is built from the
	// source and the credit; printing them again beneath it is the row saying one
	// thing twice.
	if strings.Contains(body, `class="attribution"`) &&
		strings.Contains(strings.SplitN(body, `class="attribution"`, 2)[1], "Le Guin") {
		t.Errorf("the attribution line repeated the credit already in the heading:\n%s", body)
	}
}

// THE ORDER IS THE ANTHOLOGY, in every format. A conversion that re-sorted would
// look completely normal with three entries and be a different document.
func TestTheEPUBKeepsTheAnthologysOrder(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Order")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "utterance", "item_id": utt},
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
	})
	body := epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/anthology.xhtml")
	want := []string{
		"Give me blood, and I will give you freedom",
		"Cities, like dreams, are made of desires and fears.",
		"Let everything that has been planned come true.",
	}
	at := -1
	for _, w := range want {
		i := strings.Index(body, w)
		if i < 0 {
			t.Fatalf("missing %q from:\n%s", w, body)
		}
		if i < at {
			t.Errorf("%q came before the entry that should precede it:\n%s", w, body)
		}
		at = i
	}
}

// ANOTHER ACCOUNT'S ANTHOLOGY IS 404 AND NEVER 403 — the per-user isolation rule
// this repository states as an invariant, asserted on the new endpoint because a
// new endpoint is exactly where it gets forgotten.
func TestAnotherReadersAnthologyHasNoEPUB(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, alice)
	a := newAnthology(t, alice, "Mine")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})

	bob := addUser(t, h, alice, "bob")
	bob.mustDo("GET", "/anthologies/"+itoa(a.ID)+"/export.epub", nil, http.StatusNotFound)
}
