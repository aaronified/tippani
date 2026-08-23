package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// WHAT ACTUALLY ENFORCES THE MERGE RULE (0048).
//
// Two of the mechanisms 0048's header names as protections turned out to be
// unpinned: a skeptic deleted each one and the whole suite went on passing. That
// is worse than an unprotected row, because the comment reads as a guarantee and
// the next person to tidy the function has nothing telling them they broke it.
//
// So this file is the other half of cast_merge_test.go. Where that file proves the
// RULE ("my row survived"), each test here fails when a specific STATEMENT is
// removed, and its comment names the statement. Both cases need a fetch that has
// stopped listing something or has changed its own spelling — which is why no
// existing test reached them: every one of those either keeps the provider's list
// constant or changes a name on a row that is still in it.

// THE STATEMENT: `row.origin != castProvider` in mergeProviderCast's retraction
// pass. Delete it and this test fails with the reader's row gone.
//
// A HAND-TYPED ROW IS NOT PROTECTED "BY CONSTRUCTION", which is what 0048 and
// cast.go both said, and that claim is why this case was missed. The claim was
// that a reader row has no provider_key and the merge reads only rows that have
// one, so a refetch cannot see it at all. True on the day it is typed, and false
// from the first fetch in which the provider catches up: adoptCastRow gives that
// row a provider key, deliberately, so the listing is re-matched rather than
// duplicated beside it. From then on the row IS in the merge's set, and the only
// thing between it and a DELETE is the origin check in the retraction pass.
//
// TestAdoptingAReaderRowTheProviderLaterAgreesWith stops one step short of this:
// it refetches twice with the provider still listing the entry, so the retraction
// pass never considers the row. The provider dropping it again is the case, and it
// is not exotic — it is what happens when a supplier tidies an uncredited part
// back out of its list after the reader has already typed it in.
func TestARetractionLeavesTheReadersAdoptedRowAlone(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	mine := decode[castRow](t, c.mustDo("POST", "/movies/"+itoa(m.ID)+"/cast", map[string]any{
		"character": "wheatley", "actor": "stephen merchant",
	}, http.StatusCreated))

	// The provider catches up, and adoption claims the row — the step that makes it
	// visible to every later merge.
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`
	resyncFromTMDB(t, c, m.ID)
	var key string
	if err := srv.Store.DB.QueryRow(
		`SELECT provider_key FROM work_cast WHERE id = ?`, mine.ID).Scan(&key); err != nil {
		t.Fatal(err)
	}
	if key == "" {
		t.Fatal("the row was not adopted, so this test is not testing what it says it is")
	}

	// And now the provider drops the entry again. The row is in the merge's stored
	// set, the fresh list does not account for it, and it must not go.
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("a retraction deleted the reader's own row: %+v", list.Cast)
	}
	kept := castRowFor(t, c, m.ID, "wheatley")
	if kept.ID != mine.ID || kept.Actor != "stephen merchant" || kept.Origin != "reader" {
		t.Fatalf("a hand-typed credit must survive the provider changing its mind: %+v", kept)
	}
}

// THE SAME STATEMENT, on the other origin it protects: a correction. Delete the
// origin check and this test fails on its first assertion — the corrected row is
// deleted outright the moment the provider stops listing the entry behind it.
//
// The second half is the retraction comment's own claim, which was equally
// unpinned: a retracted correction KEEPS ITS PROVIDER KEY, so the provider listing
// that person again re-matches the row instead of adding a second one beside it.
// Clear the key on retraction rather than keeping the row and the count below
// reads 3.
func TestARetractedCorrectionIsKeptAndStillRematched(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"wheatley","name":"Stephen Merchant"}]`}
	_, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	w := castRowFor(t, c, m.ID, "wheatley")
	c.mustDo("PUT", "/cast/"+itoa(w.ID), map[string]any{
		"character": "Wheatley", "actor": "Stephen Merchant",
	}, http.StatusOK)

	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	kept := castRowFor(t, c, m.ID, "Wheatley")
	if kept.ID != w.ID || kept.Origin != "corrected" {
		t.Fatalf("a retraction took a name the reader had fixed: %+v", kept)
	}

	// The provider lists the person again, in its own spelling. The row's frozen key
	// still matches that entry, so it is claimed rather than duplicated — and the
	// correction survives being re-matched, which is what makes the protection
	// permanent rather than good for one fetch.
	stub.cast = `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	              {"id":7,"character":"wheatley","name":"Stephen Merchant"}]`
	resyncFromTMDB(t, c, m.ID)

	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 2 {
		t.Fatalf("the re-listed entry was added beside the correction instead of claiming it: %+v", list.Cast)
	}
	again := castRowFor(t, c, m.ID, "Wheatley")
	if again.ID != w.ID || again.Origin != "corrected" {
		t.Fatalf("the correction did not survive the provider agreeing with it again: %+v", again)
	}
}

// THE STATEMENT: the empty `case castRemoved:` in mergeProviderCast's switch. Fold
// it into the provider case — `case castProvider, castRemoved:` — and this test
// fails on the tombstone's stored names; let it fall through to `default:` instead
// and it fails on the billing and the portrait URL.
//
// WHAT THAT BRANCH DOES AND DOES NOT ENFORCE, because the comment on it claimed
// the wrong one. It is NOT what stops a deleted row coming back: nothing in the
// merge writes `origin` at all, so a tombstone stays a tombstone down every
// branch, and what makes it invisible is handleDeleteCast keeping the row plus the
// `origin <> 'removed'` filter on every read.
// TestARemovedCastRowIsNotResurrectedByARefetch pins that, and it passes with this
// branch deleted — which is exactly how the branch came to look load-bearing while
// pinning nothing.
//
// What it does enforce is narrower and real: A TOMBSTONE RECORDS WHAT THE READER
// DELETED, IN THE WORDS THEY WERE LOOKING AT. It is the one row in the table
// nobody can see, so the export is the only place it is ever shown back to them —
// and if a refetch may rewrite it, the file describes their deletion in a spelling
// they never saw and re-orders it against the list.
//
// THE ROUTE IN IS A SUPPLIER RE-CASING ITS OWN NAMES, which no other test in the
// feature exercises. Re-casing changes the provider key and not the folded pair, so
// the fresh entry misses byKey and lands in adoptCastRow — which returns the
// TOMBSTONE rather than passing over it. That is a second unpinned statement on
// the same path: add `AND origin <> 'removed'` to that lookup and the entry
// inserts a fresh live row instead, resurrecting the credit by the side door,
// which is what the first two assertions below catch.
func TestARecasedRefetchNeitherRevivesNorRewritesTheTombstone(t *testing.T) {
	stub := &castStub{cast: `[{"id":6384,"character":"GLaDOS","name":"Ellen McLain"},
	                          {"id":7,"character":"Wheatley","name":"Stephen Merchant"}]`}
	srv, c, done := castTMDBServer(t, stub)
	defer done()

	m := addFromTMDB(t, c)
	gone := castRowFor(t, c, m.ID, "Wheatley")
	if gone.Billing != 1 || gone.ImageURL != "" {
		t.Fatalf("the fixture is wrong: this row must start second-billed and with no headshot: %+v", gone)
	}
	c.mustDo("DELETE", "/cast/"+itoa(gone.ID), nil, http.StatusNoContent)

	// The supplier re-cases both names AND bills the entry first, and now has a
	// portrait for it. All three are things the provider owns on a live row and must
	// not write onto a deletion.
	stub.cast = `[{"id":7,"character":"WHEATLEY","name":"STEPHEN MERCHANT","profile_path":"/s.jpg"},
	              {"id":6384,"character":"GLaDOS","name":"Ellen McLain"}]`
	resyncFromTMDB(t, c, m.ID)

	// Not revived, and not duplicated either — adoptCastRow found the tombstone.
	list := castOf(t, c, "/movies/"+itoa(m.ID)+"/cast")
	if len(list.Cast) != 1 || list.Cast[0].Character != "GLaDOS" {
		t.Fatalf("the deleted credit came back under the provider's new casing: %+v", list.Cast)
	}
	var rows int
	if err := srv.Store.DB.QueryRow(
		`SELECT COUNT(*) FROM work_cast WHERE kind = 'movie' AND work_id = ?`, m.ID).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 2 {
		t.Fatalf("work_cast holds %d rows, want 2 — a second row was inserted beside the tombstone", rows)
	}

	// And the tombstone still says what the reader deleted.
	var character, actor, origin, imageURL string
	var billing int
	if err := srv.Store.DB.QueryRow(
		`SELECT character, actor, billing, origin, image_url FROM work_cast WHERE id = ?`, gone.ID).
		Scan(&character, &actor, &billing, &origin, &imageURL); err != nil {
		t.Fatal(err)
	}
	if character != "Wheatley" || actor != "Stephen Merchant" {
		t.Fatalf("the tombstone was rewritten to %q / %q — it records the row the reader deleted, "+
			"in the words they were looking at when they deleted it", character, actor)
	}
	if billing != 1 || imageURL != "" || origin != "removed" {
		t.Fatalf("a refetch wrote the provider's facts onto a deletion: billing %d, image %q, origin %q",
			billing, imageURL, origin)
	}

	// THE CONSEQUENCE, in the one place a tombstone is ever shown back: the file.
	// The whole line is asserted rather than a substring, because the defect this
	// pins moves the deletion to the head of the list as well as respelling it.
	md := c.mustDo("GET", "/movies/"+itoa(m.ID)+"/export", nil, http.StatusOK).Body.String()
	want := "cast: GLaDOS — Ellen McLain; Wheatley — Stephen Merchant (removed)"
	if !strings.Contains(md, want) {
		t.Fatalf("the export should carry the reader's own deletion record, %q:\n%s", want, md)
	}
}
