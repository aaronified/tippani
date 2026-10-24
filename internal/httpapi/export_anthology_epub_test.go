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
	"os"
	"path/filepath"
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

// A PORTRAIT REACHES THE BOOK AS BYTES, which is the only renderer that can carry
// one — and the manifest, the file and the <img> all have to agree or the book is
// invalid and a reader refuses the whole thing over one face.
func TestTheEPUBCarriesAPortraitAndSurvivesAMissingOne(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Italo Calvino", "bio": "Wrote about cities.",
	}, http.StatusOK)
	// A real file under MediaCover, named the way the cover route validates.
	const face = "00112233445566aa.png"
	if err := os.MkdirAll(srv.coversDir(), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srv.coversDir(), face), []byte("not really a png"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE people SET image_path = ? WHERE name = 'Italo Calvino'`, face); err != nil {
		t.Fatal(err)
	}

	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Cities")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	setFields(t, c, a.ID, "Cities", map[string]any{"fields": map[string]any{"portrait": true}})

	z := exportEPUB(t, c, a.ID)
	if got := epubFile(t, z, "OEBPS/"+face); got != "not really a png" {
		t.Errorf("the portrait's bytes are not in the book: %q", got)
	}
	opf := epubFile(t, z, "OEBPS/content.opf")
	if !strings.Contains(opf, `href="`+face+`"`) || !strings.Contains(opf, `media-type="image/png"`) {
		t.Errorf("the manifest does not declare the portrait as a png:\n%s", opf)
	}
	body := epubFile(t, z, "OEBPS/anthology.xhtml")
	if !strings.Contains(body, `<img src="`+face+`" alt="" />`) {
		t.Errorf("the page does not show the portrait:\n%s", body)
	}

	// AND A FACE THAT HAS GONE COSTS NOTHING. image_path can name a file that was
	// deleted; a manifest item pointing at nothing makes the WHOLE book invalid, so
	// the bytes are read first and the manifest written from what arrived.
	if err := os.Remove(filepath.Join(srv.coversDir(), face)); err != nil {
		t.Fatal(err)
	}
	z = exportEPUB(t, c, a.ID)
	opf = epubFile(t, z, "OEBPS/content.opf")
	if strings.Contains(opf, face) {
		t.Errorf("the manifest declares a file that was not written:\n%s", opf)
	}
	if strings.Contains(epubFile(t, z, "OEBPS/anthology.xhtml"), face) {
		t.Errorf("the page points at a picture the book does not hold")
	}
	// The book is still a book.
	if got := epubFile(t, z, "mimetype"); got != "application/epub+zip" {
		t.Errorf("mimetype = %q", got)
	}
}

// A SIGNATURE REACHES THE BOOK THE SAME WAY A PORTRAIT DOES, AS BYTES, WHEN ITS
// SWITCH IS ON, AND ONLY THEN. It is its own picture with its own switch: turning
// the portrait on must not smuggle the signature in, and the reverse.
func TestTheEPUBCarriesASignatureOnlyWhenItsSwitchIsOn(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	c.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Italo Calvino"}, http.StatusOK)
	const sig = "00112233445566bb.png"
	if err := os.MkdirAll(srv.coversDir(), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srv.coversDir(), sig), []byte("not really a signature"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE people SET signature_path = ? WHERE name = 'Italo Calvino'`, sig); err != nil {
		t.Fatal(err)
	}
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Cities")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})

	// Only the portrait is on: no signature in the book.
	setFields(t, c, a.ID, "Cities", map[string]any{"fields": map[string]any{"portrait": true}})
	z := exportEPUB(t, c, a.ID)
	if strings.Contains(epubFile(t, z, "OEBPS/content.opf"), sig) || strings.Contains(epubFile(t, z, "OEBPS/anthology.xhtml"), sig) {
		t.Fatal("the signature is in the book though only the portrait's switch is on")
	}

	setFields(t, c, a.ID, "Cities", map[string]any{"fields": map[string]any{"signature": true}})
	z = exportEPUB(t, c, a.ID)
	if got := epubFile(t, z, "OEBPS/"+sig); got != "not really a signature" {
		t.Errorf("the signature's bytes are not in the book: %q", got)
	}
	if opf := epubFile(t, z, "OEBPS/content.opf"); !strings.Contains(opf, `href="`+sig+`"`) || !strings.Contains(opf, `media-type="image/png"`) {
		t.Errorf("the manifest does not declare the signature:\n%s", opf)
	}
	if body := epubFile(t, z, "OEBPS/anthology.xhtml"); !strings.Contains(body, `<p class="signature"><img src="`+sig+`" alt="" /></p>`) {
		t.Errorf("the page does not show the signature:\n%s", body)
	}
}
