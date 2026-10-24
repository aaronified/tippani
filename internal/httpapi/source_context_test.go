package httpapi

// What a stored source file does for a work's quotes, through the API only: attach a
// file and every quote it can place gets its surroundings stored; the surroundings
// are read back from rows, never from the file.
//
// WHAT THIS FILE KNOWS: the addresses (PUT /sources, POST /sources/{id}/rescan,
// GET /quotes/{kind}/{id}/context, the quote-creating and deleting routes), the
// answer's fields, and — for the one guard that is about disk — that the data
// directory has a Sources folder whose contents can be deleted behind the app's back.

import (
	"archive/zip"
	"bytes"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
)

type ctxAnswer struct {
	Before      string `json:"before"`
	Body        string `json:"body"`
	After       string `json:"after"`
	Unit        string `json:"unit"`
	Span        window `json:"span"`
	Stored      window `json:"stored"`
	BoundBefore bool   `json:"bound_before"`
	BoundAfter  bool   `json:"bound_after"`
	Start       string `json:"start"`
}

func (c *testClient) newHighlight(book int64, quote string) int64 {
	c.t.Helper()
	return idOf(c.t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": quote}, http.StatusCreated).Body.Bytes())
}

func (c *testClient) newLine(film int64, quote string, extra map[string]any) int64 {
	c.t.Helper()
	body := map[string]any{"movie_id": film, "quote": quote}
	for k, v := range extra {
		body[k] = v
	}
	return idOf(c.t, c.mustDo("POST", "/dialogues", body, http.StatusCreated).Body.Bytes())
}

func (c *testClient) contextOf(kind string, id int64) ctxAnswer {
	c.t.Helper()
	return decode[ctxAnswer](c.t, c.mustDo("GET", "/quotes/"+kind+"/"+strconv.FormatInt(id, 10)+"/context", nil, 200))
}

const prose = `The road ran north along the river and nobody walked it.

It was a bright cold day in April, and the clocks were striking thirteen.

Winston Smith slipped quickly through the glass doors of Victory Mansions.

The hallway smelt of boiled cabbage and old rag mats.

At one end of it a coloured poster was tacked to the wall.

It depicted simply an enormous face, more than a metre wide.

Nobody came, and the afternoon stretched out like a long road.
`

func TestAttachingABookStoresTheContextOfItsHighlights(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Nineteen Eighty-Four")
	// A reader's own tidy: curly apostrophe-free, punctuation changed, a word mistyped.
	hl := c.newHighlight(book, "It was a bright cold day in April; and the clocks were striking thirten")

	rec := c.putSource(sourceFields("book", book), "1984.txt", []byte(prose))
	if rec.Code != http.StatusCreated {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	row := decode[workSourceRow](t, rec)
	if row.Context == nil || row.Context.Matched != 1 {
		t.Fatalf("context stats = %+v", row.Context)
	}

	got := c.contextOf("annotation", hl)
	// The FILE'S words, not the reader's tidy.
	if got.Body != "It was a bright cold day in April, and the clocks were striking thirteen." {
		t.Fatalf("body = %q", got.Body)
	}
	if got.Unit != "paragraph" || got.Span.Before != 1 || got.Span.After != 2 {
		t.Fatalf("a paragraph window of two either side, short at the start: %+v", got)
	}
	if !strings.HasPrefix(got.Before, "The road ran north") || !strings.Contains(got.After, "Victory Mansions") {
		t.Fatalf("before %q after %q", got.Before, got.After)
	}
	if !got.BoundBefore || got.BoundAfter {
		t.Fatalf("the work starts one paragraph before it: %+v", got)
	}
}

// THE DESIGN IN ONE ASSERTION: a request served while the source file is gone still
// answers, because the context is rows and the file is not a read path.
func TestTheContextOpensWhenTheFileIsGone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))

	if err := os.RemoveAll(srv.sourcesDir()); err != nil {
		t.Fatal(err)
	}
	if got := c.contextOf("annotation", hl); !strings.Contains(got.Body, "clocks were striking thirteen") {
		t.Fatalf("with the file deleted: %+v", got)
	}
}

func TestAFilmLineIsPlacedInItsSubtitleWithItsTimeAcrossDroppedAccents(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	film := c.newScreen("V for Vendetta", "movie")
	// The subtitle lost the accented letter altogether; the stored quote kept it.
	srt := "1\n00:00:01,000 --> 00:00:03,000\nGood evening, London.\n\n" +
		"2\n00:00:04,000 --> 00:00:06,500\nVoil ! In view, a humble vaudevillian veteran\n\n" +
		"3\n00:00:07,000 --> 00:00:09,000\ncast vicariously as both victim and villain.\n\n" +
		"4\n00:00:10,000 --> 00:00:12,000\nBy the vicissitudes of fate.\n"
	line := c.newLine(film, "Voilà! In view, a humble vaudevillian veteran, cast vicariously as both victim and villain", nil)

	row := decode[workSourceRow](t, c.putSource(sourceFields("screen", film), "v.srt", []byte(srt)))
	if row.Context == nil || row.Context.Matched != 1 {
		t.Fatalf("stats = %+v", row.Context)
	}
	got := c.contextOf("dialogue", line)
	if got.Unit != "cue" || got.Start != "0:00:04" {
		t.Fatalf("a cue span carries its time: %+v", got)
	}
	if !strings.Contains(got.Body, "humble vaudevillian") || !strings.Contains(got.Body, "victim and villain") {
		t.Fatalf("the span covers both cues: %q", got.Body)
	}
	if got.Before != "Good evening, London." || got.After != "By the vicissitudes of fate." {
		t.Fatalf("before %q after %q", got.Before, got.After)
	}
}

func TestAShowsSubtitleCoversOnlyThatEpisodesLines(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	show := c.newScreen("Andor", "show")
	inEp := c.newLine(show, "I burn my life to make a sunrise that I know I will never see.", map[string]any{"season": 1, "episode": 4})
	otherEp := c.newLine(show, "I burn my life to make a sunrise that I know I will never see!!", map[string]any{"season": 1, "episode": 9})
	srt := "1\n00:00:01,000 --> 00:00:03,000\nSomething else first.\n\n" +
		"2\n00:00:04,000 --> 00:00:07,000\nI burn my life to make a sunrise that I know I will never see.\n"
	c.putSource(sourceFields("screen", show, "episode", "s01e04"), "e4.srt", []byte(srt))

	if got := c.contextOf("dialogue", inEp); got.Start != "0:00:04" {
		t.Fatalf("%+v", got)
	}
	c.mustDo("GET", "/quotes/dialogue/"+strconv.FormatInt(otherEp, 10)+"/context", nil, http.StatusNotFound)
}

// "The scans will reapply context in new quotes", and a rescan is a mechanical pass:
// it must never clobber the reader's own per-quote judgement.
func TestARescanFillsInNewQuotesAndLeavesTheRestAlone(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	first := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	src := decode[workSourceRow](t, c.putSource(sourceFields("book", book), "b.txt", []byte(prose)))

	// The reader narrows the first quote to nothing before it: 0, not NULL.
	if _, err := srv.Store.DB.Exec(`UPDATE source_context SET want_before = 0 WHERE item_id = ?`, first); err != nil {
		t.Fatal(err)
	}
	second := c.newHighlight(book, "The hallway smelt of boiled cabbage and old rag mats.")
	c.mustDo("GET", "/quotes/annotation/"+strconv.FormatInt(second, 10)+"/context", nil, http.StatusNotFound)

	res := decode[struct {
		Context contextStats `json:"context"`
	}](t, c.mustDo("POST", "/sources/"+strconv.FormatInt(src.ID, 10)+"/rescan", nil, 200))
	if res.Context.Matched != 1 || res.Context.Skipped != 1 {
		t.Fatalf("one new, one left alone: %+v", res.Context)
	}
	if got := c.contextOf("annotation", second); !strings.Contains(got.Body, "boiled cabbage") {
		t.Fatalf("%+v", got)
	}
	if got := c.contextOf("annotation", first); got.Before != "" || got.Span.Before != 0 {
		t.Fatalf("the per-quote 0 must survive a rescan, and 0 is not inherit: %+v", got)
	}
}

func TestReplacingTheFileWithADifferentOneRederivesAndTheSameOneKeeps(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "a.txt", []byte(prose))
	if _, err := srv.Store.DB.Exec(`UPDATE source_context SET want_after = 1 WHERE item_id = ?`, hl); err != nil {
		t.Fatal(err)
	}

	// The same bytes again: recognised as the same file, the row and its adjustment stay.
	c.putSource(sourceFields("book", book), "a-again.txt", []byte(prose))
	if got := c.contextOf("annotation", hl); got.Span.After != 1 {
		t.Fatalf("the same file must keep the reader's adjustment: %+v", got)
	}

	// A different edition: the old rows are not merged with it, they are cleared and the
	// new file derives its own. The reader's adjustment belonged to the old file.
	edition := strings.ReplaceAll(prose, "bright cold day", "bright cold afternoon")
	c.putSource(sourceFields("book", book), "b.txt", []byte(edition))
	got := c.contextOf("annotation", hl)
	if !strings.Contains(got.Body, "afternoon") || got.Span.After == 1 {
		t.Fatalf("the new edition derives its own row, with no inherited adjustment: %+v", got)
	}

	// And a quote the new edition no longer holds has nothing left from the old one.
	gone := c.newHighlight(book, "At one end of it a coloured poster was tacked to the wall.")
	c.mustDo("POST", "/sources/"+strconv.FormatInt(decode[workSourceRow](t, c.putSource(sourceFields("book", book), "c.txt", []byte(prose))).ID, 10)+"/rescan", nil, 200)
	short := "The road ran north along the river and nobody walked it.\n\nNothing else here.\n"
	c.putSource(sourceFields("book", book), "d.txt", []byte(short))
	c.mustDo("GET", "/quotes/annotation/"+strconv.FormatInt(gone, 10)+"/context", nil, http.StatusNotFound)
}

// "Yes." is in a dozen places, and a guess about where it sits is worse than saying so.
func TestAnAmbiguousQuoteGetsNoContextAndIsCounted(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	c.newHighlight(book, "Yes.")
	c.newHighlight(book, "Something the file does not contain at all, whatsoever.")
	text := "Yes.\n\nAre you sure?\n\nYes.\n\nReally?\n\nYes.\n\nOkay then, fine.\n"
	row := decode[workSourceRow](t, c.putSource(sourceFields("book", book), "y.txt", []byte(text)))
	if row.Context == nil || row.Context.Matched != 0 || row.Context.Ambiguous != 1 || row.Context.Unmatched != 1 {
		t.Fatalf("%+v", row.Context)
	}
}

func TestDeletingAQuoteClearsItsContext(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	c.mustDo("DELETE", "/annotations/"+strconv.FormatInt(hl, 10), nil, 200)
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM source_context`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("rows left = %d (%v)", n, err)
	}
}

func TestAnotherReadersQuoteHasNoContextToYou(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	book := admin.newBook("Mine")
	hl := admin.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	admin.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	cara.mustDo("GET", "/quotes/annotation/"+strconv.FormatInt(hl, 10)+"/context", nil, http.StatusNotFound)
}

func TestADRMBookIsRefusedAtTheDoorAndNothingIsKept(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	drm := `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>`
	rec := c.putSource(sourceFields("book", book), "b.epub", testEPUB(t, drm))
	if rec.Code != http.StatusUnprocessableEntity || !strings.Contains(rec.Body.String(), "DRM") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if n := len(sourceFilesOnDisk(t, srv)); n != 0 {
		t.Fatalf("a refused file must not be kept: %d", n)
	}
}

// THE OWNER'S EXAMPLE, END TO END: an annotation first in its chapter gets nothing
// before it, and nobody configured that.
func TestAChapterStartInAnEbookGetsNothingBeforeIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, "Chapter two opens with a sentence about the northern lighthouse keeper.")
	row := decode[workSourceRow](t, c.putSource(sourceFields("book", book), "b.epub", testEPUB(t, "")))
	if row.Context == nil || row.Context.Matched != 1 {
		t.Fatalf("%+v", row.Context)
	}
	got := c.contextOf("annotation", hl)
	if got.Before != "" || !got.BoundBefore {
		t.Fatalf("crossed into the previous chapter: %+v", got)
	}
	if !strings.Contains(got.After, "second paragraph of chapter two") {
		t.Fatalf("after: %q", got.After)
	}
}

func testEPUB(t *testing.T, encryption string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	add := func(name, body string) {
		// STORED, not deflated, for the mimetype entry: the EPUB specification requires it,
		// and it is what lets a file be recognised as one from its first bytes.
		w, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(body))
	}
	add("mimetype", "application/epub+zip")
	add("META-INF/container.xml", `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`)
	if encryption != "" {
		add("META-INF/encryption.xml", encryption)
	}
	add("OEBPS/content.opf", `<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="a" href="c1.xhtml"/><item id="b" href="c2.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`)
	add("OEBPS/c1.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>The last paragraph of chapter one ends here.</p><p>And a final line of the first chapter.</p></body></html>`)
	add("OEBPS/c2.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Chapter two opens with a sentence about the northern lighthouse keeper.</p><p>Then a second paragraph of chapter two follows it.</p></body></html>`)
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestTheListOfQuotesWithContextIsPerWorkAndOwnersOnly(t *testing.T) {
	srv := newTestServer(t)
	admin := signupAdmin(t, srv.Handler())
	cara := addUser(t, srv.Handler(), admin, "cara")
	book, other := admin.newBook("Mine"), admin.newBook("Other")
	placed := admin.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	admin.newHighlight(book, "A line the file does not contain, nowhere in it at all.")
	admin.putSource(sourceFields("book", book), "b.txt", []byte(prose))

	type ids struct {
		IDs []int64 `json:"ids"`
	}
	got := decode[ids](t, admin.mustDo("GET", "/sources/context-ids?subject=book&subject_id="+strconv.FormatInt(book, 10), nil, 200))
	if len(got.IDs) != 1 || got.IDs[0] != placed {
		t.Fatalf("only the placed quote has context: %+v", got)
	}
	if got := decode[ids](t, admin.mustDo("GET", "/sources/context-ids?subject=book&subject_id="+strconv.FormatInt(other, 10), nil, 200)); len(got.IDs) != 0 {
		t.Fatalf("another work has none: %+v", got)
	}
	// Somebody else asking about my work learns nothing: empty, not an error and not my ids.
	if got := decode[ids](t, cara.mustDo("GET", "/sources/context-ids?subject=book&subject_id="+strconv.FormatInt(book, 10), nil, 200)); len(got.IDs) != 0 {
		t.Fatalf("leaked across accounts: %+v", got)
	}
	admin.mustDo("GET", "/sources/context-ids?subject=nope", nil, http.StatusBadRequest)
}

func TestShowMoreWidensTheWindowForOneReadUpToWhatIsStored(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("B")
	hl := c.newHighlight(book, "At one end of it a coloured poster was tacked to the wall.")
	c.putSource(sourceFields("book", book), "b.txt", []byte(prose))
	id := strconv.FormatInt(hl, 10)

	def := decode[ctxAnswer](t, c.mustDo("GET", "/quotes/annotation/"+id+"/context", nil, 200))
	if def.Span.Before != 2 || def.Span.After != 2 {
		t.Fatalf("the default is two either side: %+v", def.Span)
	}
	wide := decode[ctxAnswer](t, c.mustDo("GET", "/quotes/annotation/"+id+"/context?before=4&after=9", nil, 200))
	if wide.Span.Before != 4 || wide.Span.After != 2 { // 4 before exist; only 2 after exist in this file
		t.Fatalf("widened up to what is stored and no further: %+v stored %+v", wide.Span, wide.Stored)
	}
	// Forgotten: the next plain read is the default again.
	if again := decode[ctxAnswer](t, c.mustDo("GET", "/quotes/annotation/"+id+"/context", nil, 200)); again.Span.Before != 2 {
		t.Fatalf("%+v", again.Span)
	}
}
