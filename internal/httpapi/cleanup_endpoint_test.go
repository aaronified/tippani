package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// THE SWEEP OVER A REAL LIBRARY (GET /cleanup).
//
// cleanup_test.go owns the rules — what fires, and the far longer list of what
// must not. These tests own the pass over the database: that it reaches all three
// kinds, that it reads the fields it claims to and no others, that it stops at
// the user's own shelf, and that it says so when it stops early.

// cleanupSweep is the reply, in the shape a test wants to assert on: the findings
// keyed by the row they belong to, because the order of three queries is not the
// interesting part.
type cleanupSweep struct {
	resp cleanupResp
	// byRule is every (kind, rule, field) the sweep reported, so an assertion
	// names what it means rather than indexing into a slice.
	byRule map[string]cleanupFinding
}

func sweepCleanup(t *testing.T, c *testClient) cleanupSweep {
	t.Helper()
	resp := decode[cleanupResp](t, c.mustDo("GET", "/cleanup", nil, http.StatusOK))
	out := cleanupSweep{resp: resp, byRule: map[string]cleanupFinding{}}
	for _, it := range resp.Items {
		for _, f := range it.Findings {
			out.byRule[it.Kind+"/"+f.Rule+"/"+f.Field] = f
		}
	}
	return out
}

func (s cleanupSweep) has(key string) bool {
	_, ok := s.byRule[key]
	return ok
}

// A book highlight, a film line and a standalone quote are three tables with
// three different shapes, and the sweep is three queries because of it. This is
// the test that would fail if one of them were dropped — which is the whole risk
// of a per-kind loop.
func TestTheCleanupSweepReachesAllThreeKinds(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Book"}, http.StatusCreated))
	// A footnote index welded to the last word — the classic ebook-selection
	// leftover, and invisible in a card.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "the price of conscience12",
	}, http.StatusCreated)

	film := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "A Film"}, http.StatusCreated))
	// A justified line's double space.
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "I  know what you did.",
	}, http.StatusCreated)

	// A dictionary's pronunciation gloss, carried in with the headword.
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "hubris /ˈhjuːbrɪs/ goes before a fall",
	}, http.StatusCreated)

	got := sweepCleanup(t, c)
	if got.resp.Scanned != 3 {
		t.Fatalf("three quotes on the shelf, %d scanned", got.resp.Scanned)
	}
	for _, want := range []string{
		"book/reference-mark/quote",
		"screen/double-space/quote",
		"quote/pronunciation/quote",
	} {
		if !got.has(want) {
			t.Errorf("missing %s; got %v", want, keysOf(got.byRule))
		}
	}
	if got.resp.Truncated {
		t.Error("three rows should not truncate")
	}
}

// The note and the translation are scanned too — they are prose the reader
// pasted, with the same origins as the quote. The FIELD is reported because the
// decision differs: a stray mark in a note is not the same as one in the words
// themselves.
//
// The translation was a standalone quote's alone when this was written; 0051 put
// it on all three kinds, and TestTheStrayMarksSweepScansTranslationsOnEveryKind
// covers the two that gained it.
func TestTheCleanupSweepReadsTheNoteAndTheTranslation(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Book"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a clean line",
		"note": "see also [12] on the same page",
	}, http.StatusCreated)
	c.mustDo("POST", "/quotes", map[string]any{
		"quote": "যা রটে তার কিছু বটে",
		// The field a per-kind list can silently drop: it was on this kind alone until
		// 0051, so the other two scanned a literal '' in its slot.
		"translation": "what is rumoured  is partly true",
	}, http.StatusCreated)

	got := sweepCleanup(t, c)
	if !got.has("book/reference-mark/note") {
		t.Errorf("the note was not scanned: %v", keysOf(got.byRule))
	}
	if !got.has("quote/double-space/translation") {
		t.Errorf("the translation was not scanned: %v", keysOf(got.byRule))
	}
	// And the quote itself, clean in both rows, produced nothing.
	if got.has("book/reference-mark/quote") || got.has("quote/double-space/quote") {
		t.Errorf("a clean quote was reported: %v", keysOf(got.byRule))
	}
}

// NAMES ARE NOT SCANNED, and this is the test that pins it — with a name that
// really would fire. "R2-D2" trips reference-mark (a letter welded to a digit,
// which in prose is a footnote index), and a droid is not a typo. A speaker or an
// actor is picked from autofill far more often than typed, so a name column in
// the scan would light up half a film library and teach the reader to ignore the
// list.
func TestTheCleanupSweepLeavesNamesAlone(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	film := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "A Film"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": film.ID, "quote": "Beep boop.",
		"character": "R2-D2", "actor": "Kenny Baker",
	}, http.StatusCreated)

	got := sweepCleanup(t, c)
	if len(got.resp.Items) != 0 {
		t.Fatalf("a name was scanned: %+v", got.resp.Items)
	}
	if got.resp.Scanned != 1 {
		t.Fatalf("the line was not read at all: scanned=%d", got.resp.Scanned)
	}
}

// Every rule is named whether or not it fired, so the client can show a zero
// instead of omitting the row — a rule that vanishes when it finds nothing reads
// as a rule that is missing. And "nothing found" has to be distinguishable from
// "nothing looked at", which is what Scanned is for.
func TestTheCleanupSweepNamesEveryRuleOnACleanShelf(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Book"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Nothing here needs a decision.",
	}, http.StatusCreated)

	got := sweepCleanup(t, c)
	if len(got.resp.Rules) != len(cleanupRules) {
		t.Fatalf("want all %d rules named, got %v", len(cleanupRules), got.resp.Rules)
	}
	for i, r := range cleanupRules {
		if got.resp.Rules[i] != r.ID {
			t.Errorf("rule %d: got %q want %q", i, got.resp.Rules[i], r.ID)
		}
	}
	if len(got.resp.Items) != 0 {
		t.Errorf("a clean shelf reported findings: %+v", got.resp.Items)
	}
	if got.resp.Scanned != 1 {
		t.Errorf("scanned=%d — a clean shelf must still say it was read", got.resp.Scanned)
	}
	// Items is a list, never null: a client that maps over the reply should not
	// have to special-case an empty library.
	if body := c.mustDo("GET", "/cleanup", nil, http.StatusOK).Body.String(); !strings.Contains(body, `"items":[]`) {
		t.Errorf("empty findings serialised as null: %s", body)
	}
}

// Per-user isolation, the invariant that holds everywhere else in this package: a
// sweep reads through the parent work's user_id, and another reader's dirty
// library is not this reader's worklist.
func TestTheCleanupSweepStopsAtTheReadersOwnShelf(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	aliceBook := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Alice's Book"}, http.StatusCreated))
	alice.mustDo("POST", "/annotations", map[string]any{
		"book_id": aliceBook.ID, "quote": "alice's line with a  double space",
	}, http.StatusCreated)
	alice.mustDo("POST", "/quotes", map[string]any{"quote": "alice's [3] quote"}, http.StatusCreated)

	bobBook := decode[bookDetail](t, bob.mustDo("POST", "/books",
		map[string]any{"title": "Bob's Book"}, http.StatusCreated))
	bob.mustDo("POST", "/annotations", map[string]any{
		"book_id": bobBook.ID, "quote": "bob's line with a  double space",
	}, http.StatusCreated)

	got := sweepCleanup(t, bob)
	if got.resp.Scanned != 1 {
		t.Fatalf("bob read %d rows — alice's shelf leaked", got.resp.Scanned)
	}
	if len(got.resp.Items) != 1 || got.resp.Items[0].WorkTitle != "Bob's Book" {
		t.Fatalf("bob's worklist is not his own: %+v", got.resp.Items)
	}

	// And alice still sees both of hers, so the scoping did not simply hide rows
	// from everybody.
	mine := sweepCleanup(t, alice)
	if mine.resp.Scanned != 2 || len(mine.resp.Items) != 2 {
		t.Fatalf("alice: scanned=%d items=%d", mine.resp.Scanned, len(mine.resp.Items))
	}
}

// A SILENTLY TRUNCATED LIST IS INDISTINGUISHABLE FROM A CLEAN LIBRARY, which is
// why the cap is reported rather than just applied. The rows go in through SQL:
// the assertion is about the cap, and five hundred round trips through the
// handler would buy nothing but a slow test.
func TestTheCleanupSweepSaysWhenItStoppedEarly(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Long Shelf"}, http.StatusCreated))

	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < maxCleanupFindings+5; i++ {
		if _, err := tx.Exec(
			`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (?, ?, 'manual', ?)`,
			book.ID, fmt.Sprintf("line %d with a  double space", i), fmt.Sprintf("hash-%d", i)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	got := sweepCleanup(t, c)
	if !got.resp.Truncated {
		t.Errorf("the cap was reached and not reported: %d items", len(got.resp.Items))
	}
	if len(got.resp.Items) != maxCleanupFindings {
		t.Errorf("want exactly the cap, got %d items", len(got.resp.Items))
	}
	// Scanned counts what was READ, not what was reported, so it stops with the
	// scan rather than continuing to the end of the table.
	if got.resp.Scanned != maxCleanupFindings {
		t.Errorf("scanned=%d, want the cap", got.resp.Scanned)
	}
}

// ?counts=1 — THE ARM THE RAIL'S BADGE USES.
//
// It exists so a number on a permanent surface does not cost five hundred
// findings and their work titles on every page load, and the thing worth testing
// is that dropping the list did not drop the count with it. The sweep past the
// cap is the case that separates the two: with items, the walk stops at
// maxCleanupFindings and the totals stop with it; without them there is nothing
// to cap, so counts=1 is the arm that answers for the WHOLE library.
func TestTheCleanupCountsOnlyArmCountsPastTheCap(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Long Shelf"}, http.StatusCreated))

	const rows = maxCleanupFindings + 5
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < rows; i++ {
		if _, err := tx.Exec(
			`INSERT INTO annotations (book_id, quote, source, dedupe_hash) VALUES (?, ?, 'manual', ?)`,
			book.ID, fmt.Sprintf("line %d with a  double space", i), fmt.Sprintf("hash-%d", i)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	counts := decode[cleanupResp](t, c.mustDo("GET", "/cleanup?counts=1", nil, http.StatusOK))
	if len(counts.Items) != 0 {
		t.Errorf("counts=1 returned %d items; the point is that it builds none", len(counts.Items))
	}
	if counts.Truncated {
		t.Error("counts=1 reported truncation; with no items there is nothing to cap")
	}
	if counts.Scanned != rows {
		t.Errorf("scanned=%d, want the whole library (%d)", counts.Scanned, rows)
	}
	if counts.Counts["open"] != rows {
		t.Errorf("open=%d, want one per row (%d) — the cap must not reach the counts",
			counts.Counts["open"], rows)
	}
	// And the listing arm, on the same library, is the one that stops early —
	// stated here so the difference is a documented contract rather than a
	// surprise to whoever compares the two numbers.
	listed := decode[cleanupResp](t, c.mustDo("GET", "/cleanup", nil, http.StatusOK))
	if !listed.Truncated || listed.Counts["open"] >= counts.Counts["open"] {
		t.Errorf("the listing arm should stop at the cap and count less: truncated=%v open=%d vs %d",
			listed.Truncated, listed.Counts["open"], counts.Counts["open"])
	}
}

// Under the cap the two arms must agree exactly — a badge that disagreed with
// the page it opens would be worse than no badge.
func TestTheCleanupCountsOnlyArmAgreesWithTheList(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Short Shelf"}, http.StatusCreated))
	for _, q := range []string{"a  double space", "another  one", "clean enough"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": book.ID, "quote": q}, http.StatusCreated)
	}

	listed := decode[cleanupResp](t, c.mustDo("GET", "/cleanup", nil, http.StatusOK))
	counts := decode[cleanupResp](t, c.mustDo("GET", "/cleanup?counts=1", nil, http.StatusOK))
	if listed.Counts["open"] != counts.Counts["open"] || listed.Scanned != counts.Scanned {
		t.Errorf("the two arms disagree: list open=%d scanned=%d, counts open=%d scanned=%d",
			listed.Counts["open"], listed.Scanned, counts.Counts["open"], counts.Scanned)
	}
	if counts.Counts["open"] == 0 {
		t.Error("the fixture found nothing, so the agreement above proves nothing")
	}
}

// The sweep is behind auth like every other read here — it enumerates the
// reader's whole library.
func TestTheCleanupSweepNeedsAReader(t *testing.T) {
	h := newTestServer(t).Handler()
	anon := &testClient{t: t, h: h}
	anon.mustDo("GET", "/cleanup", nil, http.StatusUnauthorized)
}

func keysOf(m map[string]cleanupFinding) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
