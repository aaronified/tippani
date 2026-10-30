package httpapi

// A mounted library's Kindle files, and a title's leading article, through the API.
//
// WHAT THIS KNOWS: the scan and attach routes under /sources, the shapes they answer, and
// the stored position of a highlight. The MOBI here is built byte by byte: nothing under
// test is read from a real book.

import (
	"encoding/binary"
	"strconv"
	"strings"
	"testing"
)

// kindleFile builds the smallest MOBI the reader accepts: uncompressed text, a header record
// that carries a title, an author and an ISBN, and the book's markup as its only text.
func kindleFile(t *testing.T, title, author, isbn, markup string) []byte {
	t.Helper()
	be := binary.BigEndian
	rec0 := make([]byte, 16+264)
	be.PutUint16(rec0[0:], 1) // no compression
	be.PutUint32(rec0[4:], uint32(len(markup)))
	be.PutUint16(rec0[8:], 1)
	be.PutUint16(rec0[10:], 4096)
	copy(rec0[16:], "MOBI")
	be.PutUint32(rec0[20:], 264)
	be.PutUint32(rec0[28:], 65001)
	be.PutUint32(rec0[36:], 6)
	be.PutUint32(rec0[0xC0:], 0xFFFFFFFF)
	be.PutUint32(rec0[0x80:], 0x40)
	var block []byte
	for _, e := range []struct {
		typ int
		val string
	}{{100, author}, {104, isbn}} {
		if e.val == "" {
			continue
		}
		rec := make([]byte, 8)
		be.PutUint32(rec[0:], uint32(e.typ))
		be.PutUint32(rec[4:], uint32(8+len(e.val)))
		block = append(append(block, rec...), e.val...)
	}
	count := 0
	for _, e := range []string{author, isbn} {
		if e != "" {
			count++
		}
	}
	head := make([]byte, 12)
	copy(head, "EXTH")
	be.PutUint32(head[4:], uint32(12+len(block)))
	be.PutUint32(head[8:], uint32(count))
	rec0 = append(append(rec0, head...), block...)
	be.PutUint32(rec0[0x54:], uint32(len(rec0)))
	be.PutUint32(rec0[0x58:], uint32(len(title)))
	rec0 = append(rec0, title...)

	out := make([]byte, 78+16+2)
	copy(out, "Kindle Test")
	copy(out[60:], "BOOKMOBI")
	be.PutUint16(out[76:], 2)
	be.PutUint32(out[78:], uint32(len(out)))
	be.PutUint32(out[86:], uint32(len(out)+len(rec0)))
	return append(append(out, rec0...), markup...)
}

const kindleBook = `<html><body><h1>Part One</h1>` +
	`<p>Nothing here is the sentence the reader kept.</p>` +
	`<p>It is the mark of a man to carry his questions about with him until the answer finds him.</p>` +
	`<p>Nothing after it either.</p></body></html>`

func TestAKindleFileInTheLibraryIsFoundByItsIsbnAndPlacesTheHighlight(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	root := t.TempDir()
	writeFiles(t, root, map[string][]byte{
		"books/Frankl/Man's Search for Meaning.azw3": kindleFile(t, "Man's Search For Meaning: The Classic", "Viktor E. Frankl", "9781448177684", kindleBook),
	})
	book := c.newBook("Man's Search for Meaning")
	if _, err := srv.Store.DB.Exec(`UPDATE books SET isbn = '9781448177684' WHERE id = ?`, book); err != nil {
		t.Fatal(err)
	}
	hl := c.newHighlight(book, "It is the mark of a man to carry his questions about with him until the answer finds him.")
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)

	got := c.scan().Candidates
	if len(got) != 1 || got[0].WorkID != book || got[0].How != "id" || got[0].Bucket != "exact" || got[0].Format != "mobi" {
		t.Fatalf("a Kindle file is identified by the ISBN inside it: %+v", got)
	}
	c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "exact", "tokens": []string{got[0].Token}}, 200)

	var pct int
	var chapter string
	if err := srv.Store.DB.QueryRow(
		`SELECT loc_pct, chapter_title FROM source_context WHERE subject = 'annotation' AND item_id = ?`, hl).Scan(&pct, &chapter); err != nil {
		t.Fatalf("the highlight was not placed in the Kindle file: %v", err)
	}
	if chapter != "Part One" || pct < 1 {
		t.Fatalf("place = %d%% in %q", pct, chapter)
	}
	p, ok := c.proposalFor("annotation", hl)
	if !ok || p.ProposedChapter != "Part One" || p.Proposed != strconv.Itoa(pct)+"%" {
		t.Fatalf("%+v %v", p, ok)
	}
}

// A leading "The" is not part of what a book is called: the library says one thing, the file
// the other, and both are one book.
func TestATitleMatchesWhetherOrNotItBeginsWithAnArticle(t *testing.T) {
	for name, tc := range map[string]struct{ library, file string }{
		"the library lacks it": {"Fires of Heaven", "The Fires of Heaven"},
		"the file lacks it":    {"The Fires of Heaven", "Fires of Heaven"},
	} {
		srv := newTestServer(t)
		c := signupAdmin(t, srv.Handler())
		root := t.TempDir()
		writeFiles(t, root, map[string][]byte{
			"books/fires.azw3": kindleFile(t, tc.file, "Robert Jordan", "", kindleBook),
		})
		book := c.newBook(tc.library)
		if _, err := srv.Store.DB.Exec(`UPDATE books SET author = 'Robert Jordan' WHERE id = ?`, book); err != nil {
			t.Fatal(err)
		}
		c.newHighlight(book, "It is the mark of a man to carry his questions about with him until the answer finds him.")
		c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)
		got := c.scan().Candidates
		if len(got) != 1 || got[0].WorkID != book || got[0].How != "title" || got[0].Bucket != "review" {
			t.Errorf("%s: %+v", name, got)
		}
	}
}

func TestAnotherTitleIsNotMatchedJustBecauseItSharesAnArticle(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	root := t.TempDir()
	writeFiles(t, root, map[string][]byte{"books/other.azw3": kindleFile(t, "The Shadow Rising", "Robert Jordan", "", kindleBook)})
	book := c.newBook("The Fires of Heaven")
	c.newHighlight(book, "It is the mark of a man to carry his questions about with him until the answer finds him.")
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)
	if got := c.scan().Candidates; len(got) != 0 {
		t.Fatalf("%+v", got)
	}
}

// pdfOf builds a one-page PDF whose page holds the given paragraphs, set far enough apart that
// each reads as its own. A nil list is a page of pictures only: no text operators at all.
func pdfOf(paragraphs []string) []byte {
	var content strings.Builder
	if paragraphs == nil {
		content.WriteString("q 100 0 0 100 50 50 cm /Im0 Do Q")
	} else {
		content.WriteString("BT /F1 12 Tf 72 740 Td 14 TL\n")
		for i, p := range paragraphs {
			if i > 0 {
				content.WriteString("0 -60 Td\n")
			}
			content.WriteString("(" + p + ") Tj\n")
		}
		content.WriteString("ET")
	}
	body := content.String()
	return []byte("%PDF-1.4\n" +
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
		"4 0 obj\n<< /Length " + strconv.Itoa(len(body)) + " >>\nstream\n" + body + "\nendstream\nendobj\n" +
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
		"trailer\n<< /Root 1 0 R /Size 6 >>\n%%EOF\n")
}

func TestAPdfInTheLibraryIsProposedByItsNameForReviewAndPlacesTheHighlight(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	root := t.TempDir()
	quote := "It is the mark of a man to carry his questions about with him until the answer finds him."
	writeFiles(t, root, map[string][]byte{
		"books/Frankl/Man's Search for Meaning - Viktor E. Frankl (1946).pdf": pdfOf([]string{"First paragraph, nothing to find here.", quote, "Last paragraph of the page."}),
	})
	book := c.newBook("Man's Search for Meaning")
	hl := c.newHighlight(book, quote)
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)

	got := c.scan().Candidates
	if len(got) != 1 || got[0].WorkID != book || got[0].How != "title" || got[0].Bucket != "review" || got[0].Format != "pdf" {
		t.Fatalf("a PDF is identified by its name and never as an exact match: %+v", got)
	}
	c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "review", "tokens": []string{got[0].Token}}, 200)
	var pct int
	if err := srv.Store.DB.QueryRow(
		`SELECT loc_pct FROM source_context WHERE subject = 'annotation' AND item_id = ?`, hl).Scan(&pct); err != nil {
		t.Fatalf("the highlight was not placed in the PDF: %v", err)
	}
	if pct < 20 || pct > 60 {
		t.Fatalf("the quote is the middle paragraph, placed at %d%%", pct)
	}
}

func TestAPdfOfPicturesIsRefusedAsASourceWithTheReason(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	book := c.newBook("A Scanned Book")
	rec := c.putSource(sourceFields("book", book), "scan.pdf", pdfOf(nil))
	if rec.Code != 422 || !strings.Contains(rec.Body.String(), "no text to read") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}
