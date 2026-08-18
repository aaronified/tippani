package httpapi

// The anthology round trip.
//
// The export makes exactly one claim about itself — that the order and the prose
// come back — and that claim is what this file tests. It is the only export whose
// content is partly the reader's own writing, so the failure it guards is not a
// missing field but a missing paragraph.
//
// WHAT IS DELIBERATELY NOT ASSERTED: that a book highlight comes back as a book
// highlight. The file carries no book, because an anthology is a reading document
// and the work a passage came from appears in it as an attribution rather than as
// a record with an ISBN. Every entry re-imports as a standalone quote, and the
// test says so explicitly rather than leaving it to be discovered.

import (
	"net/http"
	"strings"
	"testing"
)

type anthologyList struct {
	Anthologies []anthologyRow `json:"anthologies"`
}

func exportAnthology(t *testing.T, c *testClient, id int64) string {
	t.Helper()
	return c.mustDo("GET", "/anthologies/"+itoa(id)+"/export", nil, http.StatusOK).Body.String()
}

func listAnthologies(t *testing.T, c *testClient) []anthologyRow {
	t.Helper()
	return decode[anthologyList](t, c.mustDo("GET", "/anthologies", nil, http.StatusOK)).Anthologies
}

func setEntryNote(t *testing.T, c *testClient, id int64, kind string, itemID int64, note string) {
	t.Helper()
	c.mustDo("PUT", "/anthologies/"+itoa(id)+"/entries", map[string]any{
		"kind": kind, "item_id": itemID, "note": note,
	}, http.StatusNoContent)
}

func TestAnthologyExportShape(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Cities and their ghosts")
	c.mustDo("PUT", "/anthologies/"+itoa(a.ID), map[string]any{
		"title": "Cities and their ghosts", "intro": "Three passages about the same idea.",
	}, http.StatusNoContent)
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "utterance", "item_id": utt},
	})
	setEntryNote(t, c, a.ID, "book", ann, "Calvino first, because he sets the terms.")

	got := exportAnthology(t, c, a.ID)
	want := "---\ntype: anthology\ntitle: Cities and their ghosts\n---\n" +
		"\nThree passages about the same idea.\n" +
		"\n## Invisible Cities — Italo Calvino\n" +
		"\nCalvino first, because he sets the terms.\n" +
		"\n> Cities, like dreams, are made of desires and fears.\n" +
		"- speaker: Italo Calvino\n" +
		"- occasion: Invisible Cities\n"
	if !strings.HasPrefix(got, want) {
		t.Fatalf("export shape:\n--- got ---\n%s\n--- want prefix ---\n%s", got, want)
	}
	// The second entry, and the heading that makes it findable. A standalone quote's
	// source is its occasion and its credit is its speaker, so the heading reads the
	// same way a book's does without either being a special case.
	if !strings.Contains(got, "\n## Burma Radio broadcast — Subhas Chandra Bose\n") {
		t.Fatalf("the second entry's heading is missing or wrong:\n%s", got)
	}
	// An entry with no commentary writes no paragraph. A blank line where prose
	// would be is a different document, and the parser would read it as commentary.
	if strings.Contains(got, "Bose\n\n\n") {
		t.Errorf("an entry with no commentary left an empty paragraph behind:\n%s", got)
	}
}

// TestAnthologyRoundTrip is the claim in the plan's own words: an anthology with
// commentary exports and re-imports with its order and prose intact.
//
// Into a SECOND account, so nothing can pass by finding the rows already there —
// which is the way a round-trip test quietly stops testing anything.
func TestAnthologyRoundTrip(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, alice)
	a := newAnthology(t, alice, "Cities and their ghosts")
	intro := "Three passages about the same idea.\n\nThey were written sixty years apart."
	alice.mustDo("PUT", "/anthologies/"+itoa(a.ID), map[string]any{
		"title": "Cities and their ghosts",
		// Two paragraphs, because the blank line between them is the only formatting
		// this field has and it is the first thing a round trip loses.
		"intro": intro,
	}, http.StatusNoContent)
	// Deliberately NOT the order they were created in: the order is the feature, so
	// the file has to carry one that is not the id order.
	addEntries(t, alice, a.ID, []map[string]any{
		{"kind": "utterance", "item_id": utt},
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
	})
	setEntryNote(t, alice, a.ID, "utterance", utt, "A voice from outside either.")
	setEntryNote(t, alice, a.ID, "book", ann, "Calvino sets the terms.")
	setEntryNote(t, alice, a.ID, "screen", dia, "And the Zone answers him.")

	md := exportAnthology(t, alice, a.ID)

	bob := addUser(t, h, alice, "bob")
	staged := stageQuotesMD(t, bob, "cities.md", md)
	if staged.Staged != 3 {
		t.Fatalf("staged %d rows from a three-entry anthology", staged.Staged)
	}
	approveBatch(t, bob, staged.BatchID)

	list := listAnthologies(t, bob)
	if len(list) != 1 {
		t.Fatalf("the import made %d anthologies, want 1", len(list))
	}
	rebuilt := list[0]
	if rebuilt.Title != "Cities and their ghosts" {
		t.Errorf("title = %q", rebuilt.Title)
	}
	if rebuilt.Intro != intro {
		t.Errorf("the introduction did not survive:\n got %q\nwant %q", rebuilt.Intro, intro)
	}

	got := getAnthology(t, bob, rebuilt.ID)
	if len(got.Entries) != 3 {
		t.Fatalf("%d entries after the round trip, want 3", len(got.Entries))
	}
	// THE ORDER, which is what an anthology is. Asserted on the quotes rather than
	// on ids, because the ids are new — this is a different account.
	wantOrder := []string{
		"Give me blood, and I will give you freedom",
		"Cities, like dreams, are made of desires and fears.",
		"Let everything that has been planned come true.",
	}
	wantNotes := []string{
		"A voice from outside either.",
		"Calvino sets the terms.",
		"And the Zone answers him.",
	}
	for i, e := range got.Entries {
		if !strings.HasPrefix(e.Quote, wantOrder[i]) {
			t.Errorf("entry %d = %q, want it to start %q", i, e.Quote, wantOrder[i])
		}
		if e.Note != wantNotes[i] {
			t.Errorf("entry %d commentary = %q, want %q", i, e.Note, wantNotes[i])
		}
	}
	// AND THE STATED LOSS. Every entry is a standalone quote now, whatever it was:
	// the file carries no book and no film, so there is nothing to hang the other two
	// kinds off. Asserted rather than left to be found out.
	for _, e := range got.Entries {
		if e.Kind != kindUtterance {
			t.Errorf("entry %s:%d came back as %s; a re-imported anthology is standalone quotes",
				e.Kind, e.ItemID, e.Kind)
		}
	}
	// The attribution is what survives of the work: the book's title as the
	// occasion, its author as the speaker.
	var calvino anthologyEntryRow
	for _, e := range got.Entries {
		if strings.HasPrefix(e.Quote, "Cities, like dreams") {
			calvino = e
		}
	}
	if calvino.Source != "Invisible Cities" || calvino.Credit != "Italo Calvino" {
		t.Errorf("the book's attribution did not survive: %q / %q", calvino.Source, calvino.Credit)
	}
}

// TestReimportingAnAnthologyDoesNotDuplicateIt — the case that actually happens.
//
// Importing the same file twice is how a reader gets an anthology back after
// deleting it, and it is also just a double-click. The quotes collide on their
// dedupe hash and are skipped, and the naive reading of that is to skip the ENTRY
// too — which rebuilds the anthology empty. So a skipped quote is still filed,
// against the row it collided with.
func TestReimportingAnAnthologyDoesNotDuplicateIt(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, alice)
	a := newAnthology(t, alice, "Openings")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	setEntryNote(t, alice, a.ID, "book", ann, "The first line of the book.")
	md := exportAnthology(t, alice, a.ID)

	bob := addUser(t, h, alice, "bob")
	for i := 0; i < 2; i++ {
		staged := stageQuotesMD(t, bob, "openings.md", md)
		approveBatch(t, bob, staged.BatchID)
	}

	list := listAnthologies(t, bob)
	if len(list) != 1 {
		t.Fatalf("two imports of one file made %d anthologies", len(list))
	}
	got := getAnthology(t, bob, list[0].ID)
	if len(got.Entries) != 1 {
		t.Fatalf("%d entries after importing the same file twice, want 1", len(got.Entries))
	}
	if got.Entries[0].Note != "The first line of the book." {
		t.Errorf("the commentary did not survive the second import: %q", got.Entries[0].Note)
	}
}
