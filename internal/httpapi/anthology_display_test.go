package httpapi

// What one entry shows and says in its anthology (0094).
//
// Written as a reader would use it, through the API only: make a quote that carries a note, a translation and a tag,
// file it in two anthologies, then change what each anthology shows, what one entry shows, and what one entry says,
// and read the result back as the page and the file do. The claims are the ones that were each wrong at some point:
//
//   - the quote's own note has always shown, and gaining a switch must not switch it off for anything already saved;
//   - the new parts are off until asked for, in the reading view's data and in the file;
//   - an entry's override beats the anthology's switch and leaves its neighbours alone;
//   - a restatement is printed by the anthology and NEVER written to the quote, the other anthology, or the library;
//   - another reader's anthology and a quote that is not in this anthology are refused.

import (
	"net/http"
	"strings"
	"testing"
)

// aQuoteWithParts is a book highlight with everything the switches can show: a note, a translation, two tags.
func aQuoteWithParts(t *testing.T, c *testClient) (int64, annotationRow) {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Gitanjali", "author": "Rabindranath Tagore"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Where the mind is without fear",
		"note": "My father's favourite.", "translation": "A mind with no fear in it.",
		"tags": []string{"hope", "poems"},
	}, http.StatusCreated))
	return book.ID, ann
}

func setDisplay(t *testing.T, c *testClient, id int64, kind string, item int64, body map[string]any, want int) *responseRecorderLite {
	t.Helper()
	r := c.mustDo("PUT", "/anthologies/"+itoa(id)+"/entries/"+kind+"/"+itoa(item)+"/display", body, want)
	return &responseRecorderLite{Body: r.Body.String()}
}

type responseRecorderLite struct{ Body string }

func TestTheQuotesOwnNoteStillShowsAndTheOtherPartsWaitToBeAskedFor(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	a := newAnthology(t, c, "Poems")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

	md := exportAnthology(t, c, a.ID)
	if !strings.Contains(md, "- note: My father's favourite.") {
		t.Errorf("an anthology that was never configured lost the quote's note:\n%s", md)
	}
	for _, k := range []string{"- translation:", "- tags:", "- language:"} {
		if strings.Contains(md, k) {
			t.Errorf("a default anthology wrote %q:\n%s", k, md)
		}
	}

	// the reading view's data carries the parts either way, so a switch can be honoured without refetching
	e := getAnthology(t, c, a.ID).Entries[0]
	if e.Translation != "A mind with no fear in it." || len(e.Tags) != 2 {
		t.Errorf("the entry did not carry the quote's translation and tags: %+v", e)
	}

	setFields(t, c, a.ID, "Poems", map[string]any{"fields": map[string]any{"translation": true, "tags": true, "note": false}})
	md = exportAnthology(t, c, a.ID)
	if !strings.Contains(md, "- translation: A mind with no fear in it.") || !strings.Contains(md, "- tags: hope, poems") {
		t.Errorf("switching the parts on did not write them:\n%s", md)
	}
	if strings.Contains(md, "- note:") {
		t.Errorf("switching the note off still wrote it:\n%s", md)
	}
	// and the choice is what comes back, including the note being off
	got := getAnthology(t, c, a.ID).Anthology
	if v, set := got.Extra["note"]; !set || v {
		t.Errorf("the note's off switch did not come back: %+v", got.Extra)
	}
}

func TestAnEntryCanShowWhatItsAnthologyHides(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, first := aQuoteWithParts(t, c)
	second := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": first.BookID, "quote": "Let me not pray to be sheltered from dangers",
		"translation": "Not a prayer for shelter.",
	}, http.StatusCreated))
	a := newAnthology(t, c, "Poems")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": first.ID}, {"kind": "book", "item_id": second.ID},
	})

	setDisplay(t, c, a.ID, "book", first.ID, map[string]any{"fields": map[string]any{"translation": true}}, http.StatusNoContent)
	md := exportAnthology(t, c, a.ID)
	if !strings.Contains(md, "A mind with no fear in it.") {
		t.Errorf("the entry's own switch did not show its translation:\n%s", md)
	}
	if strings.Contains(md, "Not a prayer for shelter.") {
		t.Errorf("one entry's switch showed its neighbour's translation:\n%s", md)
	}

	// and an entry can hide what its anthology shows
	setFields(t, c, a.ID, "Poems", map[string]any{"fields": map[string]any{"translation": true}})
	setDisplay(t, c, a.ID, "book", second.ID, map[string]any{"fields": map[string]any{"translation": false}}, http.StatusNoContent)
	md = exportAnthology(t, c, a.ID)
	if strings.Contains(md, "Not a prayer for shelter.") || !strings.Contains(md, "A mind with no fear in it.") {
		t.Errorf("an entry's off did not beat the anthology's on:\n%s", md)
	}

	// null puts it back to inheriting
	setDisplay(t, c, a.ID, "book", second.ID, map[string]any{"fields": map[string]any{"translation": nil}}, http.StatusNoContent)
	if md = exportAnthology(t, c, a.ID); !strings.Contains(md, "Not a prayer for shelter.") {
		t.Errorf("clearing an entry's override did not return it to its anthology's switch:\n%s", md)
	}
}

func TestRestatingAPartChangesThatAnthologyAndNothingElse(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	mine := newAnthology(t, c, "Mine")
	other := newAnthology(t, c, "Another")
	for _, id := range []int64{mine.ID, other.ID} {
		addEntries(t, c, id, []map[string]any{{"kind": "book", "item_id": ann.ID}})
		setFields(t, c, id, "x", map[string]any{"title": "x", "fields": map[string]any{"translation": true}})
	}

	setDisplay(t, c, mine.ID, "book", ann.ID, map[string]any{"edits": map[string]any{
		"quote":       "Where the mind is without fear, and the head is held high",
		"translation": "A fearless mind.", "note": "", "context_after": "…and the head is held high.",
	}}, http.StatusNoContent)

	e := getAnthology(t, c, mine.ID).Entries[0]
	if e.Quote != "Where the mind is without fear, and the head is held high" || e.Translation != "A fearless mind." || e.QuoteNote != "" || e.ContextAfter != "…and the head is held high." {
		t.Errorf("the anthology did not say what it was told to: %+v", e)
	}
	if e.Originals["quote"] != "Where the mind is without fear" || e.Originals["translation"] != "A mind with no fear in it." {
		t.Errorf("the library's own words were not kept for 'put it back': %+v", e.Originals)
	}
	if md := exportAnthology(t, c, mine.ID); !strings.Contains(md, "A fearless mind.") || strings.Contains(md, "A mind with no fear in it.") {
		t.Errorf("the file does not print the restatement:\n%s", md)
	}

	// the other anthology and the library still say what the quote says
	o := getAnthology(t, c, other.ID).Entries[0]
	if o.Quote != "Where the mind is without fear" || o.Translation != "A mind with no fear in it." || o.QuoteNote != "My father's favourite." || len(o.Edits) != 0 {
		t.Errorf("a restatement leaked into another anthology: %+v", o)
	}
	lib := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?id="+itoa(ann.ID), nil, http.StatusOK)).Annotations[0]
	if lib.Quote != "Where the mind is without fear" || lib.Translation != "A mind with no fear in it." || lib.Note != "My father's favourite." {
		t.Errorf("a restatement was written to the quote itself: %+v", lib)
	}

	// null puts one part back; the rest stay restated
	setDisplay(t, c, mine.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"translation": nil}}, http.StatusNoContent)
	e = getAnthology(t, c, mine.ID).Entries[0]
	if e.Translation != "A mind with no fear in it." || e.Quote == "Where the mind is without fear" {
		t.Errorf("putting one part back disturbed the others: %+v", e)
	}
}

func TestEntryDisplayIsRefusedFor_ForeignAnthologiesAbsentQuotesAndUnknownKeys(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	a := newAnthology(t, c, "Mine")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

	setDisplay(t, c, a.ID, "book", ann.ID+99, map[string]any{"fields": map[string]any{"translation": true}}, http.StatusNotFound)
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"fields": map[string]any{"nonsense": true}}, http.StatusBadRequest)
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"colour": "red"}}, http.StatusBadRequest)
	setDisplay(t, c, a.ID, "poem", ann.ID, map[string]any{"fields": map[string]any{"translation": true}}, http.StatusBadRequest)

	bob := addUser(t, h, c, "bob")
	bob.mustDo("PUT", "/anthologies/"+itoa(a.ID)+"/entries/book/"+itoa(ann.ID)+"/display",
		map[string]any{"fields": map[string]any{"translation": true}}, http.StatusNotFound)
}

func TestTheBookPrintsWhatTheEntryShowsAndSays(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	a := newAnthology(t, c, "Poems")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

	page := func() string { return epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/anthology.xhtml") }
	if strings.Contains(page(), "A mind with no fear in it.") {
		t.Fatalf("a default anthology printed a translation:\n%s", page())
	}
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{
		"fields": map[string]any{"translation": true, "context": true},
		"edits":  map[string]any{"translation": "A fearless mind.", "context_after": "…where the head is held high."},
	}, http.StatusNoContent)
	got := page()
	if !strings.Contains(got, `<p class="translation">A fearless mind.</p>`) {
		t.Errorf("the book does not print the entry's restated translation:\n%s", got)
	}
	if !strings.Contains(got, "where the head is held high.") {
		t.Errorf("the book does not print the entry's restated context:\n%s", got)
	}
	if strings.Contains(got, "A mind with no fear in it.") {
		t.Errorf("the book printed the library's translation over the restated one:\n%s", got)
	}
}

func TestAPassageTakenOutAndPutBackKeepsWhatItShowedAndSaid(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	a := newAnthology(t, c, "Poems")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{
		"fields": map[string]any{"translation": true}, "edits": map[string]any{"translation": "A fearless mind."},
	}, http.StatusNoContent)

	c.mustDo("DELETE", "/anthologies/"+itoa(a.ID)+"/entries/book/"+itoa(ann.ID), nil, http.StatusNoContent)
	c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/removed/book/"+itoa(ann.ID), nil, http.StatusNoContent)

	e := getAnthology(t, c, a.ID).Entries[0]
	if e.Translation != "A fearless mind." || !e.Fields["translation"] {
		t.Errorf("putting the passage back lost what it showed and said: %+v", e)
	}
}

func TestTheBookPrintsTheQuotesNoteUntilItIsSwitchedOffOrRestated(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	a := newAnthology(t, c, "Poems")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})
	page := func() string { return epubFile(t, exportEPUB(t, c, a.ID), "OEBPS/anthology.xhtml") }

	if !strings.Contains(page(), `<p class="quote-note">My father&#39;s favourite.</p>`) {
		t.Errorf("the book left out a note the page and the Markdown show:\n%s", page())
	}
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"note": "Said at the gate."}}, http.StatusNoContent)
	if got := page(); !strings.Contains(got, "Said at the gate.") || strings.Contains(got, "favourite") {
		t.Errorf("the book did not print the restated note in place of the quote's:\n%s", got)
	}
	setFields(t, c, a.ID, "Poems", map[string]any{"fields": map[string]any{"note": false}})
	if strings.Contains(page(), "Said at the gate.") {
		t.Errorf("switching the note off still printed it in the book:\n%s", page())
	}
}

func TestARestatementIsBoundedAndNeverEmptiesAPassage(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	_, ann := aQuoteWithParts(t, c)
	a := newAnthology(t, c, "Poems")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"translation": strings.Repeat("x", anthologyEditMax+1)}}, http.StatusBadRequest)
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"translation": strings.Repeat("x", anthologyEditMax)}}, http.StatusNoContent)
	// a passage with no words is a hole in the page; clearing the restatement is what null is for
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"quote": "   "}}, http.StatusBadRequest)
	// but the note and the translation may be said as nothing: that is a way to show none of them
	setDisplay(t, c, a.ID, "book", ann.ID, map[string]any{"edits": map[string]any{"note": ""}}, http.StatusNoContent)
	if e := getAnthology(t, c, a.ID).Entries[0]; e.QuoteNote != "" || e.Quote != "Where the mind is without fear" {
		t.Errorf("an empty restated note did not blank the note, or touched the quote: %+v", e)
	}
}

func TestTheContextOfAQuoteReachesTheAnthologyAndCanBeRestatedThere(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := c.newBook("Nineteen Eighty-Four")
	hl := c.newHighlight(book, "It was a bright cold day in April, and the clocks were striking thirteen.")
	if rec := c.putSource(sourceFields("book", book), "1984.txt", []byte(prose)); rec.Code != http.StatusCreated {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	a := newAnthology(t, c, "Openings")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": hl}})
	setFields(t, c, a.ID, "Openings", map[string]any{"fields": map[string]any{"context": true}})

	e := getAnthology(t, c, a.ID).Entries[0]
	if !strings.HasPrefix(e.ContextBefore, "The road ran north") || !strings.Contains(e.ContextAfter, "Victory Mansions") {
		t.Fatalf("the quote's own context did not reach its entry: before %q after %q", e.ContextBefore, e.ContextAfter)
	}
	md := exportAnthology(t, c, a.ID)
	if !strings.Contains(md, "- context_before: The road ran north") || !strings.Contains(md, "- context_after: Winston Smith") {
		t.Errorf("the file does not carry the context the page shows:\n%s", md)
	}

	setDisplay(t, c, a.ID, "book", hl, map[string]any{"edits": map[string]any{"context_before": "Earlier, in another draft."}}, http.StatusNoContent)
	got := getAnthology(t, c, a.ID).Entries[0]
	if got.ContextBefore != "Earlier, in another draft." || got.Originals["context_before"] == "" {
		t.Errorf("the restated context was not applied with the original kept: %+v", got)
	}
	// the quote's own panel still says what the file says
	if own := c.contextOf("annotation", hl); !strings.HasPrefix(own.Before, "The road ran north") {
		t.Errorf("restating it in an anthology changed the quote's own context: %q", own.Before)
	}
}
