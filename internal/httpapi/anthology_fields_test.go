package httpapi

// PER-ANTHOLOGY FIELD VISIBILITY (0045). Six switches, stored on the row, and one
// rule that gives them their shape: what you SEE when you read an anthology is what
// you GET when you export it.
//
// Every default is the zero value, which is why four are hide_ and two are show_.
// The first test below is the one that matters most — an anthology nobody has
// touched must export exactly as it did before the feature existed, or every file
// anyone has already exported stops diffing clean against a fresh one.

import (
	"net/http"
	"strings"
	"testing"
)

// exportAnthology, setEntryNote and listAnthologies live in export_anthology_test.go.

func setFields(t *testing.T, c *testClient, id int64, title string, flags map[string]any) {
	t.Helper()
	body := map[string]any{"title": title}
	for k, v := range flags {
		body[k] = v
	}
	c.mustDo("PUT", "/anthologies/"+itoa(id), body, http.StatusNoContent)
}

func TestAnthologyFieldsDefaultToShowingWhatItAlwaysShowed(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Untouched")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})

	got := getAnthology(t, c, a.ID)
	if f := got.Anthology.anthologyFields; f != (anthologyFields{}) {
		t.Fatalf("a new anthology carries %+v, want every flag zero", f)
	}

	md := exportAnthology(t, c, a.ID)
	// The two the migration turned off by default appear nowhere, so a file written
	// before 0045 still diffs clean against a fresh export.
	if strings.Contains(md, "- locator:") || strings.Contains(md, "- date:") {
		t.Errorf("a default anthology exported a locator or a date:\n%s", md)
	}
	// And the things that were always there still are.
	for _, want := range []string{
		"- speaker: Italo Calvino",
		"- occasion: Invisible Cities",
		"## Invisible Cities — Italo Calvino",
	} {
		if !strings.Contains(md, want) {
			t.Errorf("missing %q from:\n%s", want, md)
		}
	}
}

func TestHidingAFieldHidesItFromTheExportToo(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "A document of passages")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	setFields(t, c, a.ID, "A document of passages", map[string]any{"hide_credit": true, "hide_source": true})

	// Stored AND reported back: a switch the reading view cannot read is a switch
	// only the export honours, which is the asymmetry the feature exists to remove.
	got := getAnthology(t, c, a.ID)
	if !got.Anthology.HideCredit || !got.Anthology.HideSource {
		t.Fatalf("flags = %+v, want credit and source hidden", got.Anthology.anthologyFields)
	}

	md := exportAnthology(t, c, a.ID)
	if strings.Contains(md, "Italo Calvino") {
		t.Errorf("the credit is hidden and the export still names it:\n%s", md)
	}
	if strings.Contains(md, "Invisible Cities") {
		t.Errorf("the source is hidden and the export still names it:\n%s", md)
	}
	// THE HEADING IS WHERE A HIDDEN FIELD WOULD LEAK LOUDEST — it is built from the
	// source and the credit, in the largest type on the page. With both hidden it
	// falls back to the position, which is what the delimiter has always been for.
	if !strings.Contains(md, "\n## 1\n") {
		t.Errorf("want the position as the heading, got:\n%s", md)
	}
	// The passage itself is never a switch.
	if !strings.Contains(md, "Cities, like dreams") {
		t.Errorf("the words went missing:\n%s", md)
	}
}

func TestShowingTheLocatorAndDateAddsThemToTheExport(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "A Book", "author": "An Author"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a line", "chapter_no": 7, "chapter": "The Fall",
		"location": "p. 288", "noted_at": "2026-03-04",
	}, http.StatusCreated))
	a := newAnthology(t, c, "With citations")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})
	setFields(t, c, a.ID, "With citations", map[string]any{"show_locator": true, "show_date": true})

	// The locator is assembled per kind in SQL, and its shape has to match what the
	// rest of the app writes: "<number> · <name>", then the page.
	got := getAnthology(t, c, a.ID)
	if len(got.Entries) != 1 {
		t.Fatalf("want one entry, got %d", len(got.Entries))
	}
	if want := "7 · The Fall · p. 288"; got.Entries[0].Locator != want {
		t.Errorf("locator = %q, want %q", got.Entries[0].Locator, want)
	}
	if got.Entries[0].Date != "2026-03-04" {
		t.Errorf("date = %q, want the day it was noted rather than the day it was added", got.Entries[0].Date)
	}

	md := exportAnthology(t, c, a.ID)
	for _, want := range []string{"- locator: 7 · The Fall · p. 288", "- date: 2026-03-04"} {
		if !strings.Contains(md, want) {
			t.Errorf("missing %q from:\n%s", want, md)
		}
	}
}

// A whole chapter number keeps no decimal point, because "7.0 · The Fall" is not
// how anybody writes a chapter — the same rule chapterHeading follows in Go and
// chapterLabel in JS. Three copies of one format is a real cost, and this is the
// assertion that keeps the SQL copy honest.
func TestTheLocatorFormatsAChapterTheWayTheRestOfTheAppDoes(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, http.StatusCreated))
	a := newAnthology(t, c, "Chapters")

	for _, tc := range []struct {
		name string
		anno map[string]any
		want string
	}{
		{"a whole number alone", map[string]any{"chapter_no": 7}, "7"},
		{"a number and a name", map[string]any{"chapter_no": 7, "chapter": "The Fall"}, "7 · The Fall"},
		{"a name alone", map[string]any{"chapter": "Coda"}, "Coda"},
		{"a page alone", map[string]any{"location": "p. 12"}, "p. 12"},
		{"nothing at all", map[string]any{}, ""},
		{"a decimal chapter", map[string]any{"chapter_no": 7.5}, "7.5"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"book_id": book.ID, "quote": "a line about " + tc.name}
			for k, v := range tc.anno {
				body[k] = v
			}
			ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", body, http.StatusCreated))
			addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

			got := getAnthology(t, c, a.ID)
			var e *anthologyEntryRow
			for i := range got.Entries {
				if got.Entries[i].ItemID == ann.ID {
					e = &got.Entries[i]
				}
			}
			if e == nil {
				t.Fatal("the entry did not come back")
			}
			if e.Locator != tc.want {
				t.Errorf("locator = %q, want %q", e.Locator, tc.want)
			}
		})
	}
}

// The commentary switch on its own, because it is the one most likely to be used in
// anger: an anthology made to send somebody is not always one you want your
// marginalia in.
func TestHidingTheCommentaryKeepsItStoredAndOutOfTheFile(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Sent to a friend")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	setEntryNote(t, c, a.ID, "book", ann, "the thought I had about this")

	if md := exportAnthology(t, c, a.ID); !strings.Contains(md, "the thought I had about this") {
		t.Fatalf("the commentary is not in the default export:\n%s", md)
	}
	setFields(t, c, a.ID, "Sent to a friend", map[string]any{"hide_commentary": true})

	if md := exportAnthology(t, c, a.ID); strings.Contains(md, "the thought I had about this") {
		t.Errorf("the commentary is hidden and the export still carries it:\n%s", md)
	}
	// HIDDEN, NOT DELETED. The switch is about what leaves the app; a reader who
	// turns it back on must find their writing where they left it.
	got := getAnthology(t, c, a.ID)
	if got.Entries[0].Note != "the thought I had about this" {
		t.Errorf("the note itself is gone: %q", got.Entries[0].Note)
	}
}

func TestHidingTheColourLeavesTheColourAlone(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "A Book"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "a blue line", "color": "blue",
	}, http.StatusCreated))
	a := newAnthology(t, c, "No colours")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann.ID}})

	if md := exportAnthology(t, c, a.ID); !strings.Contains(md, "- color: blue") {
		t.Fatalf("a non-default colour is not in the default export:\n%s", md)
	}
	setFields(t, c, a.ID, "No colours", map[string]any{"hide_colour": true})

	if md := exportAnthology(t, c, a.ID); strings.Contains(md, "- color:") {
		t.Errorf("the colour is hidden and the export still binds it:\n%s", md)
	}
	// The quote's own colour is untouched: this is a rendering choice, not an edit.
	got := getAnthology(t, c, a.ID)
	if got.Entries[0].Color != "blue" {
		t.Errorf("the quote's colour changed to %q", got.Entries[0].Color)
	}
}

// A create can set them too, so a client offering the switches on the new-anthology
// form is not silently ignored — the failure that looks like a saved setting
// reverting by itself.
func TestFieldsCanBeSetWhenTheAnthologyIsCreated(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	created := decode[anthologyRow](t, c.mustDo("POST", "/anthologies", map[string]any{
		"title": "Born plain", "hide_credit": true, "show_date": true,
	}, http.StatusCreated))
	if !created.HideCredit || !created.ShowDate {
		t.Fatalf("create returned %+v, want credit hidden and date shown", created.anthologyFields)
	}
	// Read back from the row rather than echoed from the request.
	got := getAnthology(t, c, created.ID)
	if !got.Anthology.HideCredit || !got.Anthology.ShowDate {
		t.Errorf("stored %+v", got.Anthology.anthologyFields)
	}
	// And setting two did not set the other four — the failure mode of a positional
	// argument list that has drifted from its column list.
	if got.Anthology.HideSource || got.Anthology.HideCommentary || got.Anthology.HideColour || got.Anthology.ShowLocator {
		t.Errorf("setting two flags set others: %+v", got.Anthology.anthologyFields)
	}
}

// THE COLUMN LIST AND THE SCAN ORDER ARE ONE THING OR THEY ARE A BUG. Six booleans
// read positionally means a mismatch shows up as the wrong switch working, which
// looks like a UI fault and is not. Each flag is set alone and checked alone, which
// is the only arrangement that catches a transposition.
func TestEachFlagIsTheFlagItSaysItIs(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	for _, name := range []string{"hide_credit", "hide_source", "hide_commentary", "hide_colour", "show_locator", "show_date"} {
		t.Run(name, func(t *testing.T) {
			a := newAnthology(t, c, "One flag: "+name)
			setFields(t, c, a.ID, "One flag: "+name, map[string]any{name: true})
			got := getAnthology(t, c, a.ID).Anthology.anthologyFields
			set := map[string]bool{
				"hide_credit":     got.HideCredit,
				"hide_source":     got.HideSource,
				"hide_commentary": got.HideCommentary,
				"hide_colour":     got.HideColour,
				"show_locator":    got.ShowLocator,
				"show_date":       got.ShowDate,
			}
			for k, v := range set {
				if want := k == name; v != want {
					t.Errorf("set %s and %s came back %v — the column list and the scan order disagree", name, k, v)
				}
			}
		})
	}
}
