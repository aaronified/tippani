package httpapi

// Proposed places for a book's highlights, from the EPUB the book keeps, through the API.
//
// WHAT THIS FILE KNOWS: PUT /sources to give a book its EPUB, the routes under /locators
// and the answers' fields, POST /sources/{id}/rescan, and the stored location and chapter
// of a highlight, read straight from the database for the claim a response cannot make:
// that nothing was written until the reader accepted. It also reaches into source_context
// once, to put a row back the way it was stored before positions existed.

import (
	"archive/zip"
	"bytes"
	"strconv"
	"strings"
	"testing"
)

// The book: a prologue, chapter one and chapter two. Paragraph texts are kept here so the
// expected percent is worked out in the test from their lengths, not read from the code.
var (
	bookProlog = []string{"A short prologue before anything begins."}
	bookCh1    = []string{
		"The lighthouse keeper climbed the northern stairs every evening at dusk.",
		"The tide came in slowly over the grey stones of the shore.",
		"Nobody in the village could remember a night he had missed the lamp.",
	}
	bookCh2 = []string{
		"Chapter two opens with a sentence about the harbour master and his dog.",
		"The tide came in slowly over the grey stones of the shore.",
		"By morning the boats had gone out past the breakwater into the fog.",
	}
)

func placeBook(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	add := func(name, body string) {
		w, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(body))
	}
	page := func(ps []string) string {
		var b strings.Builder
		b.WriteString(`<html xmlns="http://www.w3.org/1999/xhtml"><body>`)
		for _, p := range ps {
			b.WriteString("<p>" + p + "</p>")
		}
		b.WriteString("</body></html>")
		return b.String()
	}
	add("mimetype", "application/epub+zip")
	add("META-INF/container.xml", `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`)
	add("OEBPS/content.opf", `<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest>
<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
<item id="p" href="p.xhtml"/><item id="a" href="c1.xhtml"/><item id="b" href="c2.xhtml"/></manifest>
<spine><itemref idref="p"/><itemref idref="a"/><itemref idref="b"/></spine></package>`)
	add("OEBPS/nav.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
<nav epub:type="toc"><ol><li><a href="p.xhtml">Prologue</a></li><li><a href="c1.xhtml">Chapter One: Arrival</a></li><li><a href="c2.xhtml">Chapter Two</a></li></ol></nav></body></html>`)
	add("OEBPS/p.xhtml", page(bookProlog))
	add("OEBPS/c1.xhtml", page(bookCh1))
	add("OEBPS/c2.xhtml", page(bookCh2))
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// percentBefore is how far into the book's text a paragraph starts, worked out from the
// texts above with the rule the plan states: letters counted end to end, floored.
func percentBefore(all []string, idx int) string {
	total, before := 0, 0
	for i, p := range all {
		if i < idx {
			before += len(p)
		}
		total += len(p)
	}
	return strconv.Itoa(before*100/total) + "%"
}

func bookParagraphs() []string {
	return append(append(append([]string{}, bookProlog...), bookCh1...), bookCh2...)
}

type placeFixture struct {
	srv                                *Server
	c                                  *testClient
	book                               int64
	exact, fuzzy, ambiguous, edge, own int64
}

func (s *Server) placeOf(t *testing.T, id int64) (string, string) {
	t.Helper()
	var loc, ch string
	if err := s.Store.DB.QueryRow(`SELECT COALESCE(location, ''), COALESCE(chapter, '') FROM annotations WHERE id = ?`, id).Scan(&loc, &ch); err != nil {
		t.Fatal(err)
	}
	return loc, ch
}

func (c *testClient) proposalFor(kind string, id int64) (locatorProposal, bool) {
	c.t.Helper()
	for _, p := range c.proposals().Proposals {
		if p.Kind == kind && p.ID == id {
			return p, true
		}
	}
	return locatorProposal{}, false
}

func placeFixtureOf(t *testing.T) placeFixture {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("The Keeper")
	f := placeFixture{srv: srv, c: c, book: book}
	f.exact = c.newHighlight(book, bookCh1[2])
	// A reader's typo and a dropped full stop: near, not verbatim.
	f.fuzzy = c.newHighlight(book, "By morning the boats had gone out past the breakwatr into the fog")
	f.ambiguous = c.newHighlight(book, bookCh1[1]) // the same sentence is in both chapters
	f.edge = c.newHighlight(book, bookCh2[0])      // the first paragraph of chapter two
	f.own = idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": bookCh1[0], "chapter": "3"}, 201).Body.Bytes())
	c.putSource(sourceFields("book", book), "k.epub", placeBook(t))
	return f
}

func bookItem(p locatorProposal) locatorItem {
	it := itemOf(p)
	it.Kind, it.CurrentChapter, it.ProposedChapter = p.Kind, p.CurrentChapter, p.ProposedChapter
	return it
}

func TestAnEbooksHighlightIsProposedItsPercentAndChapterAndNothingIsWrittenYet(t *testing.T) {
	f := placeFixtureOf(t)
	p, ok := f.c.proposalFor("annotation", f.exact)
	if !ok {
		t.Fatalf("no proposal for the exact highlight: %+v", f.c.proposals())
	}
	if p.Bucket != "exact" || p.Distance != 0 || p.Proposed != percentBefore(bookParagraphs(), 3) ||
		p.ProposedChapter != "Chapter One: Arrival" || p.Current != "" || p.Replaces {
		t.Fatalf("%+v", p)
	}
	if p.WorkTitle != "The Keeper" || p.Evidence != bookCh1[2] {
		t.Fatalf("the file's own words are the evidence: %+v", p)
	}
	if loc, ch := f.srv.placeOf(t, f.exact); loc != "" || ch != "" {
		t.Fatalf("looking wrote %q %q", loc, ch)
	}
}

func TestAFuzzyMatchIsProposedForReviewWithItsDistance(t *testing.T) {
	f := placeFixtureOf(t)
	p, ok := f.c.proposalFor("annotation", f.fuzzy)
	if !ok || p.Bucket != "review" || p.Distance == 0 || p.Proposed != percentBefore(bookParagraphs(), 6) ||
		p.ProposedChapter != "Chapter Two" {
		t.Fatalf("%+v %v", p, ok)
	}
	if p.Evidence != bookCh2[2] {
		t.Fatalf("evidence = %q", p.Evidence)
	}
}

func TestAHighlightKeepsItsOwnChapterAndIsOnlyProposedAPlace(t *testing.T) {
	f := placeFixtureOf(t)
	p, ok := f.c.proposalFor("annotation", f.own)
	if !ok || p.CurrentChapter != "3" || p.ProposedChapter != "3" || p.Proposed != percentBefore(bookParagraphs(), 1) {
		t.Fatalf("%+v %v", p, ok)
	}
	f.c.mustDo("POST", "/locators/accept", map[string]any{"bucket": p.Bucket, "items": []locatorItem{bookItem(p)}}, 200)
	if loc, ch := f.srv.placeOf(t, f.own); loc != p.Proposed || ch != "3" {
		t.Fatalf("stored %q %q", loc, ch)
	}
}

func TestAcceptingTheExactGroupWritesLocationAndChapterAndAgainIsStale(t *testing.T) {
	f := placeFixtureOf(t)
	var items []locatorItem
	for _, p := range f.c.proposals().Proposals {
		if p.Kind == "annotation" && p.Bucket == "exact" {
			items = append(items, bookItem(p))
		}
	}
	res := decode[map[string]int](t, f.c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": items}, 200))
	if res["applied"] != len(items) || len(items) < 3 || res["stale"] != 0 {
		t.Fatalf("%d items, %+v", len(items), res)
	}
	loc, ch := f.srv.placeOf(t, f.exact)
	if loc != percentBefore(bookParagraphs(), 3) || ch != "Chapter One: Arrival" {
		t.Fatalf("stored %q %q", loc, ch)
	}
	if loc, _ := f.srv.placeOf(t, f.fuzzy); loc != "" {
		t.Fatalf("the fuzzy highlight rode along with the exact press: %q", loc)
	}
	again := decode[map[string]int](t, f.c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": items}, 200))
	if again["applied"] != 0 || again["stale"] != len(items) {
		t.Fatalf("%+v", again)
	}
}

// A location the reader already wrote is theirs: the file's number is a different unit
// (a percent of this file), so it is a replacement shown as one, one press each, and
// never part of an accept-all.
func TestAHighlightWithALocationIsAReplacementOnePressAndNeverBulk(t *testing.T) {
	f := placeFixtureOf(t)
	if _, err := f.srv.Store.DB.Exec(`UPDATE annotations SET location = 'p. 12' WHERE id = ?`, f.exact); err != nil {
		t.Fatal(err)
	}
	p, ok := f.c.proposalFor("annotation", f.exact)
	if !ok || !p.Replaces || p.Current != "p. 12" || p.Bucket != "review" {
		t.Fatalf("%+v %v", p, ok)
	}
	res := decode[map[string]int](t, f.c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "exact", "items": []locatorItem{bookItem(p)}}, 200))
	if res["applied"] != 0 || res["skipped"] != 1 {
		t.Fatalf("%+v", res)
	}
	if loc, _ := f.srv.placeOf(t, f.exact); loc != "p. 12" {
		t.Fatalf("overwrote the reader's page by a bulk press: %q", loc)
	}
	// Edited again between looking and pressing: stale, and the edit stands.
	if _, err := f.srv.Store.DB.Exec(`UPDATE annotations SET location = 'loc 99' WHERE id = ?`, f.exact); err != nil {
		t.Fatal(err)
	}
	res = decode[map[string]int](t, f.c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "review", "items": []locatorItem{bookItem(p)}}, 200))
	if res["applied"] != 0 || res["stale"] != 1 {
		t.Fatalf("%+v", res)
	}
	if loc, _ := f.srv.placeOf(t, f.exact); loc != "loc 99" {
		t.Fatalf("overwrote a later edit: %q", loc)
	}
	// A fresh look, accepted one at a time, does replace it.
	p, _ = f.c.proposalFor("annotation", f.exact)
	res = decode[map[string]int](t, f.c.mustDo("POST", "/locators/accept", map[string]any{"bucket": "review", "items": []locatorItem{bookItem(p)}}, 200))
	if res["applied"] != 1 {
		t.Fatalf("%+v", res)
	}
	if loc, _ := f.srv.placeOf(t, f.exact); loc != percentBefore(bookParagraphs(), 3) {
		t.Fatalf("stored %q", loc)
	}
}

func (f placeFixture) rescan(t *testing.T) {
	t.Helper()
	var src int64
	if err := f.srv.Store.DB.QueryRow(`SELECT id FROM work_sources`).Scan(&src); err != nil {
		t.Fatal(err)
	}
	f.c.mustDo("POST", "/sources/"+strconv.FormatInt(src, 10)+"/rescan", nil, 200)
}

func TestARefusedPlaceStaysRefusedAcrossARescan(t *testing.T) {
	f := placeFixtureOf(t)
	p, _ := f.c.proposalFor("annotation", f.exact)
	res := decode[map[string]int](t, f.c.mustDo("POST", "/locators/ignore", map[string]any{"items": []locatorItem{bookItem(p)}}, 200))
	if res["ignored"] != 1 {
		t.Fatalf("%+v", res)
	}
	f.rescan(t)
	if _, ok := f.c.proposalFor("annotation", f.exact); ok {
		t.Fatal("a refused place came back")
	}
	if loc, _ := f.srv.placeOf(t, f.exact); loc != "" {
		t.Fatalf("refusing wrote %q", loc)
	}
	if _, ok := f.c.proposalFor("annotation", f.edge); !ok {
		t.Fatal("refusing one place removed another's proposal")
	}
}

// A highlight stored before positions existed gets one on the next rescan, and the
// context the reader may have adjusted is left exactly as it was.
func TestARescanGivesAnOlderRowItsPositionWithoutTouchingItsContext(t *testing.T) {
	f := placeFixtureOf(t)
	if _, err := f.srv.Store.DB.Exec(`UPDATE source_context SET loc_pct = -1, chapter_title = '', want_before = 0 WHERE subject = 'annotation' AND item_id = ?`, f.exact); err != nil {
		t.Fatal(err)
	}
	if _, ok := f.c.proposalFor("annotation", f.exact); ok {
		t.Fatal("a row with no position proposes nothing")
	}
	f.rescan(t)
	p, ok := f.c.proposalFor("annotation", f.exact)
	if !ok || p.Proposed != percentBefore(bookParagraphs(), 3) {
		t.Fatalf("%+v %v", p, ok)
	}
	var want int
	if err := f.srv.Store.DB.QueryRow(`SELECT want_before FROM source_context WHERE subject = 'annotation' AND item_id = ?`, f.exact).Scan(&want); err != nil || want != 0 {
		t.Fatalf("the reader's own window changed: %d %v", want, err)
	}
}
