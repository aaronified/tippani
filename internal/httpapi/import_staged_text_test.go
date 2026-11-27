package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// A queued quote's words can be edited, one row at a time, and what is edited is
// what approval writes. The test acts as the Android app does: stage a file, ask
// the queue what it holds, edit a row, ask again, approve, read the library.

func stagedQuoteByText(t *testing.T, c *testClient, text string) stagedQuoteRow {
	t.Helper()
	for _, q := range queue(t, c, "").Quotes {
		if q.Quote == text {
			return q
		}
	}
	t.Fatalf("no staged quote reads %q", text)
	return stagedQuoteRow{}
}

func TestAStagedQuotesWordsCanBeEditedAndApprovalWritesThem(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	first := stagedQuoteByText(t, c, "The spice must flow.")

	rec := c.mustDo("PATCH", "/import/staged/quotes/"+itoa(first.ID), map[string]any{
		"quote": "  The spice must flow, and the spice is life.  ",
		"note":  "trimmed from a longer clip",
	}, http.StatusOK)
	if got := decode[map[string]int](t, rec)["updated"]; got != 1 {
		t.Fatalf("updated = %d", got)
	}

	var edited stagedQuoteRow
	for _, q := range queue(t, c, "").Quotes {
		if q.ID == first.ID {
			edited = q
		}
	}
	if edited.Quote != "The spice must flow, and the spice is life." || edited.Note != "trimmed from a longer clip" {
		t.Fatalf("the queue still shows the old words: %+v", edited)
	}
	if edited.Location != first.Location || edited.Color != first.Color {
		t.Fatalf("editing words must not touch what the row was placed by: %+v vs %+v", edited, first)
	}

	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, 200)
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	var found bool
	for _, a := range anns.Annotations {
		if a.Quote == "The spice must flow, and the spice is life." {
			found = true
			if a.Note != "trimmed from a longer clip" {
				t.Fatalf("the edited note did not land: %+v", a)
			}
		}
		if a.Quote == "The spice must flow." {
			t.Fatalf("the old words were approved: %+v", a)
		}
	}
	if !found || len(anns.Annotations) != 2 {
		t.Fatalf("approved: %+v", anns.Annotations)
	}
}

func TestAnEditedLineThatTheLibraryAlreadyHoldsIsSkippedAtApproval(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// The same book already holds the line the edit will produce. If the staged
	// row kept its old hash it would be approved as a second copy.
	c.importApprove("/import/markdown", "sandworm.md", []byte(stagedBookMD))
	stage(t, c, "/import/markdown", "again.md", []byte(
		"---\ntitle: Sandworm Studies\nauthor: Liet Kynes\n---\n\n## Chapter 1\n\n> A line that is only a draft.\n"))
	draft := stagedQuoteByText(t, c, "A line that is only a draft.")

	c.mustDo("PATCH", "/import/staged/quotes/"+itoa(draft.ID),
		map[string]any{"quote": "Fear is the mind-killer."}, http.StatusOK)

	rep := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve", map[string]any{"all": true}, 200))
	if rep.Skipped < 1 {
		t.Fatalf("an edited line equal to one in the library must be skipped as a duplicate: %+v", rep)
	}
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200))
	n := 0
	for _, a := range anns.Annotations {
		if a.Quote == "Fear is the mind-killer." {
			n++
		}
	}
	if n != 1 {
		t.Fatalf("the line is in the library %d times, want once", n)
	}
}

func TestEditingAStagedQuoteToAnotherWaitingQuotesWordsIsRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	first := stagedQuoteByText(t, c, "The spice must flow.")

	rec := c.do("PATCH", "/import/staged/quotes/"+itoa(first.ID), map[string]any{"quote": "fear is the MIND-killer."})
	if rec.Code != http.StatusConflict {
		t.Fatalf("a clash with a waiting quote: got %d %s, want 409", rec.Code, rec.Body)
	}
	if again := stagedQuoteByText(t, c, "The spice must flow."); again.ID != first.ID {
		t.Fatalf("a refused edit changed the row: %+v", again)
	}
}

func TestStagedTextEditRefusesWhatItCannotMean(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	id := itoa(stagedQuoteByText(t, c, "The spice must flow.").ID)

	for name, body := range map[string]map[string]any{
		"nothing sent":          {},
		"all the words cleared": {"quote": "   ", "note": ""},
		"over the ceiling":      {"quote": strings.Repeat("x", maxStagedText+1)},
	} {
		if rec := c.do("PATCH", "/import/staged/quotes/"+id, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d %s, want 400", name, rec.Code, rec.Body)
		}
	}
	if rec := c.do("PATCH", "/import/staged/quotes/999999", map[string]any{"quote": "x"}); rec.Code != http.StatusNotFound {
		t.Errorf("an id that is not in the queue: got %d, want 404", rec.Code)
	}
	if rec := c.do("PATCH", "/import/staged/quotes/abc", map[string]any{"quote": "x"}); rec.Code != http.StatusBadRequest {
		t.Errorf("a bad id: got %d, want 400", rec.Code)
	}
}

func TestAnotherReadersStagedQuoteIsNotFoundNotForbidden(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	other := addUser(t, h, admin, "bob")

	stage(t, admin, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	id := itoa(stagedQuoteByText(t, admin, "The spice must flow.").ID)

	if rec := other.do("PATCH", "/import/staged/quotes/"+id, map[string]any{"quote": "mine now"}); rec.Code != http.StatusNotFound {
		t.Fatalf("another reader's staged quote: got %d %s, want 404", rec.Code, rec.Body)
	}
	if q := stagedQuoteByText(t, admin, "The spice must flow."); q.Quote != "The spice must flow." {
		t.Fatalf("the owner's row was changed: %+v", q)
	}
}

func TestTheBulkDoorStillRefusesWords(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	first := stagedQuoteByText(t, c, "The spice must flow.")

	// `quote` is not a field of the bulk request, so a client that sends it gets an
	// edit with nothing in it, and the words stay.
	c.do("POST", "/import/staged/bulk", map[string]any{"ids": []int64{first.ID}, "quote": "rewritten", "color": "blue"})
	if q := stagedQuoteByText(t, c, "The spice must flow."); q.ID != first.ID {
		t.Fatalf("the bulk door changed the words: %+v", q)
	}
}

func TestCapabilitiesAdvertisesTheStagedTextEdit(t *testing.T) {
	srv := newTestServer(t)
	anon := &testClient{t: t, h: srv.Handler()}
	got := decode[capabilitiesResp](t, anon.mustDo("GET", "/capabilities", nil, http.StatusOK))
	if got.APIRevision < 13 {
		t.Errorf("api_revision = %d, want at least 13", got.APIRevision)
	}
	for _, f := range got.Features {
		if f == "staged-text-edit" {
			return
		}
	}
	t.Errorf("capabilities does not advertise staged-text-edit: %v", got.Features)
}

// The exact file the Android app writes for a spoken audiobook bookmark
// (bookQuoteMarkdown in the app, pinned by its own test). Held here so a change to
// the importer that stops reading it fails on this side too: the app and the server
// are two repositories, and a format agreed in prose drifts.
const appBookmarkFile = `---
type: book
title: Sandworm Studies
author: Liet Kynes
language: en
---

## Chapter 14

> The spice must flow, and the spice is life. Fear is the mind-killer. Who said that?
- location: 3:42:10
- date: 2026-11-27
- note: From an audiobook bookmark
- tags: bookmark
`

func TestABookmarkFileFromTheAppIsQueuedJoinsItsBookAndCanBeTrimmed(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// The book already in the library, written the way the app's mirror writes it.
	c.importApprove("/import/markdown", "sandworm.md", []byte(stagedBookMD))

	rec := c.importAs("bookmark-3f9a.md", []byte(appBookmarkFile), "md")
	if rec.Code != http.StatusOK {
		t.Fatalf("queueing the app's file: %d %s", rec.Code, rec.Body)
	}
	q := queue(t, c, "")
	var named bool
	for _, b := range q.Batches {
		if b.Filename == "bookmark-3f9a.md" {
			named = true
		}
	}
	if !named {
		t.Fatalf("the batch must be named by the file, so the app can see its own: %+v", q.Batches)
	}
	if len(q.Works) != 1 || q.Works[0].TargetID == 0 {
		t.Fatalf("the quote must join the book already in the library, not a new one: %+v", q.Works)
	}
	row := stagedQuoteByText(t, c,
		"The spice must flow, and the spice is life. Fear is the mind-killer. Who said that?")
	if row.Location != "3:42:10" || row.Note != "From an audiobook bookmark" ||
		row.Chapter != "Chapter 14" || !hasName(row.Tags, "bookmark") {
		t.Fatalf("the bindings did not arrive: %+v", row)
	}

	// Trim it in the queue, then approve it into the existing book.
	c.mustDo("PATCH", "/import/staged/quotes/"+itoa(row.ID),
		map[string]any{"quote": "The spice must flow, and the spice is life."}, http.StatusOK)
	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": row.BatchID}, 200)

	books := decode[map[string][]map[string]any](t, c.mustDo("GET", "/books", nil, 200))["books"]
	if len(books) != 1 {
		t.Fatalf("the bookmark made a second book: %d", len(books))
	}
	var landed bool
	for _, a := range decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)).Annotations {
		if a.Quote == "The spice must flow, and the spice is life." {
			landed = true
			if a.Location != "3:42:10" || a.Note != "From an audiobook bookmark" {
				t.Fatalf("approved without its bindings: %+v", a)
			}
		}
	}
	if !landed {
		t.Fatal("the trimmed words did not reach the library")
	}
}
