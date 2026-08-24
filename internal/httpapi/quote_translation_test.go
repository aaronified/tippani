package httpapi

// What the line SAYS, on every kind of quote (0051).
//
// `translation` lived on the standalone quote alone from 0035 to 0051, which is
// the drift quote_parity_test.go's header describes happening again: somebody
// goes looking for a feature on one kind of quote and finds it missing there.
// This file is the other half of that guard — parity in the RESPONSE SHAPE is
// what the parity test checks, and parity in what actually happens to the value
// is what these check.
//
// The four places a field has to reach before it is worth having, which is
// annotation_character_test.go's list with one entry swapped: the row, the list,
// the search index, and the Markdown round trip. The facet is deliberately absent
// — a translation is prose, not a locator, so there is nothing to group by.

import (
	"net/http"
	"strings"
	"testing"
)

// A Bengali line and its English, on both kinds. Real text rather than "foo",
// because the tokenizer's remove_diacritics and the two scripts' word breaks are
// part of what is being tested.
const (
	banglaHighlight = "আমার এ গান ছেড়েছে তার সকল অলংকার"
	englishOfIt     = "This song of mine has put away its adornments"
	banglaLine      = "দুর্গা, ওঠ"
	englishOfLine   = "Durga, get up"
)

func TestATranslationMakesTheRoundTripOnAHighlight(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Gitanjali")

	created := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": englishOfIt,
	}, http.StatusCreated))
	if created.Translation != englishOfIt {
		t.Fatalf("the create came back with translation %q", created.Translation)
	}

	// The list is a DIFFERENT SELECT from the single fetch, and the two drift apart
	// one column at a time — the failure annotation_handlers' own scan-error
	// comment is about.
	listed := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(book), nil, http.StatusOK)).Annotations
	if len(listed) != 1 || listed[0].Translation != englishOfIt {
		t.Fatalf("the list did not carry the translation: %+v", listed)
	}

	// Full-state PUT, both directions. Clearing is the contract rather than a bug —
	// every PUT here is full-state — and it is why revision 8 got a feature string:
	// a client that has never heard of the field wipes it.
	kept := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(created.ID), map[string]any{
		"quote": banglaHighlight, "translation": "This song of mine has shed its ornaments",
	}, http.StatusOK))
	if kept.Translation != "This song of mine has shed its ornaments" {
		t.Fatalf("the PUT did not update the translation: %q", kept.Translation)
	}
	cleared := decode[annotationRow](t, c.mustDo("PUT", "/annotations/"+itoa(created.ID), map[string]any{
		"quote": banglaHighlight,
	}, http.StatusOK))
	if cleared.Translation != "" {
		t.Fatalf("a full-state PUT with no translation left %q behind", cleared.Translation)
	}
}

func TestATranslationMakesTheRoundTripOnAFilmLine(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	movie := newWork(t, c, "Pather Panchali", "movie")

	created := newLine(t, c, map[string]any{
		"movie_id": movie, "quote": banglaLine, "translation": englishOfLine,
	})
	if created.Translation != englishOfLine {
		t.Fatalf("the create came back with translation %q", created.Translation)
	}
	listed := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(movie), nil, http.StatusOK)).Dialogues
	if len(listed) != 1 || listed[0].Translation != englishOfLine {
		t.Fatalf("the list did not carry the translation: %+v", listed)
	}
	kept := decode[dialogueRow](t, c.mustDo("PUT", "/dialogues/"+itoa(created.ID), map[string]any{
		"quote": banglaLine, "translation": "Durga, wake up",
	}, http.StatusOK))
	if kept.Translation != "Durga, wake up" {
		t.Fatalf("the PUT did not update the translation: %q", kept.Translation)
	}
}

// A translation is UNCAPPED, like the words it translates and unlike every
// locator beside it. A Bengali compound unpacked into English needs the room, and
// a 400 at some invented length would be a rule nobody could learn.
func TestATranslationIsNotLengthCapped(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Gitanjali")
	movie := newWork(t, c, "Pather Panchali", "movie")

	long := strings.Repeat("a translated clause, ", 200) // ~4k, well past any locator cap
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": long,
	}, http.StatusCreated))
	if len(ann.Translation) != len(strings.TrimSpace(long)) {
		t.Errorf("the highlight's translation was truncated to %d characters", len(ann.Translation))
	}
	dlg := newLine(t, c, map[string]any{"movie_id": movie, "quote": banglaLine, "translation": long})
	if len(dlg.Translation) != len(strings.TrimSpace(long)) {
		t.Errorf("the line's translation was truncated to %d characters", len(dlg.Translation))
	}
}

// Trimmed, like the quote and the note. Not because whitespace is invalid but
// because the stray-marks sweep would otherwise report every saved translation as
// having an edge space, which is a report about the form rather than the library.
func TestATranslationIsTrimmed(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Gitanjali")
	got := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": "  " + englishOfIt + "\n",
	}, http.StatusCreated))
	if got.Translation != englishOfIt {
		t.Errorf("translation came back untrimmed: %q", got.Translation)
	}
}

// NOT IN THE DEDUPE HASH, and this is the sharpest rule of the lot: the hash
// answers "is this the same quote", and that answer cannot depend on whether
// anybody has got round to translating it. If translation were folded in, typing
// one would fork a second copy of the line on the next import of the same file.
func TestTranslatingAQuoteDoesNotMakeItADifferentQuote(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Gitanjali")
	movie := newWork(t, c, "Pather Panchali", "movie")

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": englishOfIt,
	}, http.StatusCreated)
	// The same words, a different translation. One quote, so this is a 409.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": "a different rendering",
	}, http.StatusConflict)
	// And with no translation at all, which is the import case: a file re-imported
	// after somebody typed a translation must not arrive as a second row.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight,
	}, http.StatusConflict)

	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": banglaLine, "translation": englishOfLine,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": banglaLine, "translation": "Durga, wake up",
	}, http.StatusConflict)
}

// The index, and the hit. A translation exists so that the half of the line the
// reader can actually TYPE is written down somewhere — so a search that cannot
// find it has taken the field's whole purpose away.
func TestAQuoteIsFoundByItsTranslationOnEveryKind(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Gitanjali")
	movie := newWork(t, c, "Pather Panchali", "movie")

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": englishOfIt,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": banglaLine, "translation": englishOfLine,
	}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "যে সয় সে রয়", "translation": "who endures, remains",
	}, http.StatusCreated)

	hits := searchWith(t, c, "q=adornments")
	if len(hits.Annotations) != 1 {
		t.Fatalf("searching a highlight's translation returned %d hits; annotations_fts did not gain the column",
			len(hits.Annotations))
	}
	// The hit CARRIES it, so the result card can draw the words that matched. A
	// result whose search term appears in nothing the card shows reads as a wrong
	// result — the argument utteranceHit.Translation has carried since 0035.
	if hits.Annotations[0].Translation != englishOfIt {
		t.Errorf("the annotation hit came back with translation %q", hits.Annotations[0].Translation)
	}

	// URL-encoded: searchWith builds a raw request URL, and a bare space in a
	// query string is not one.
	lineHits := searchWith(t, c, "q=get+up")
	if len(lineHits.Dialogues) != 1 {
		t.Fatalf("searching a line's translation returned %d hits", len(lineHits.Dialogues))
	}
	if lineHits.Dialogues[0].Translation != englishOfLine {
		t.Errorf("the dialogue hit came back with translation %q", lineHits.Dialogues[0].Translation)
	}

	// The third kind still works — this migration rebuilt two indexes and must not
	// have disturbed the one that already had the column.
	if q := searchWith(t, c, "q=endures"); len(q.Quotes) != 1 {
		t.Errorf("the standalone quote's translation stopped being searchable: %d hits", len(q.Quotes))
	}
}

// The Markdown round trip, which is where 0034 proved the cost of forgetting a
// field: this app's own export is an importer's source, every import is staged,
// and a field that is written and not read back is lost with a successful import
// and matching counts to say nothing happened.
func TestATranslationSurvivesTheMarkdownRoundTripOnBothKinds(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Gitanjali")
	movie := newWork(t, c, "Pather Panchali", "movie")
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": banglaHighlight, "translation": englishOfIt,
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": banglaLine, "translation": englishOfLine,
	}, http.StatusCreated)

	bookMD := c.mustDo("GET", "/books/"+itoa(book)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(bookMD, "- translation: "+englishOfIt) {
		t.Fatalf("the book export wrote no translation binding:\n%s", bookMD)
	}
	filmMD := c.mustDo("GET", "/movies/"+itoa(movie)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(filmMD, "- translation: "+englishOfLine) {
		t.Fatalf("the film export wrote no translation binding:\n%s", filmMD)
	}

	// Back in, as a fresh account, so nothing survives by having never left.
	c2 := signupAdmin(t, newTestServer(t).Handler())
	staged := stageQuotesMD(t, c2, "gitanjali.md", bookMD)
	approveBatch(t, c2, staged.BatchID)
	backIn := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c2.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	if len(backIn) != 1 {
		t.Fatalf("the re-import produced %d highlights, want 1", len(backIn))
	}
	if backIn[0].Translation != englishOfIt {
		t.Errorf("the highlight came back from the round trip with translation %q", backIn[0].Translation)
	}

	c3 := signupAdmin(t, newTestServer(t).Handler())
	stagedFilm := stageQuotesMD(t, c3, "pather.md", filmMD)
	approveBatch(t, c3, stagedFilm.BatchID)
	linesBack := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c3.mustDo("GET", "/dialogues", nil, http.StatusOK)).Dialogues
	if len(linesBack) != 1 {
		t.Fatalf("the re-import produced %d lines, want 1", len(linesBack))
	}
	if linesBack[0].Translation != englishOfLine {
		t.Errorf("the line came back from the round trip with translation %q", linesBack[0].Translation)
	}
}

// A hand-written file, with the two aliases the other importers already take. A
// reader should not have to know which shelf a file is going to in order to name
// the same field.
func TestTheImporterTakesTheSameTranslationKeysOnEveryKind(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	staged := stageQuotesMD(t, c, "hand.md", `---
title: Gitanjali
author: Rabindranath Tagore
---

> `+banglaHighlight+`
- english: `+englishOfIt+`

> আরেকটা লাইন
- translated: another rendering
`)
	approveBatch(t, c, staged.BatchID)
	got := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	if len(got) != 2 {
		t.Fatalf("staged %d highlights, want 2: %+v", len(got), got)
	}
	seen := map[string]bool{}
	for _, a := range got {
		seen[a.Translation] = true
	}
	if !seen[englishOfIt] {
		t.Errorf("the `english:` alias was not read: %+v", got)
	}
	if !seen["another rendering"] {
		t.Errorf("the `translated:` alias was not read: %+v", got)
	}
}

// The stray-marks sweep scanned a `''` literal in this slot on two of the three
// kinds until 0051 gave them a real column — the placeholder was named and
// scanned from the start precisely so this would be the only change needed.
func TestTheStrayMarksSweepScansTranslationsOnEveryKind(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := createBook(t, c, "Gitanjali")
	movie := newWork(t, c, "Pather Panchali", "movie")

	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book, "quote": "a clean passage", "translation": "two  spaces here",
	}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie, "quote": "a clean line", "translation": "and  two here",
	}, http.StatusCreated)

	got := sweepCleanup(t, c)
	if !got.has("book/double-space/translation") {
		t.Errorf("a highlight's translation was not scanned: %v", keysOf(got.byRule))
	}
	if !got.has("screen/double-space/translation") {
		t.Errorf("a line's translation was not scanned: %v", keysOf(got.byRule))
	}
}
