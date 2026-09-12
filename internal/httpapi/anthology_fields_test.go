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
	"reflect"
	"strings"
	"testing"

	"tippani/internal/store"
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
	// DeepEqual AND NOT `!=`, since 0074 gave this struct a map. The claim is the
	// same one it has always made — a new anthology has every switch at its zero
	// value — and it is worth keeping the reason: `!=` stopped compiling the moment
	// a field was not a bool, which is a better failure than a comparison that
	// silently starts meaning something narrower.
	if f := got.Anthology.anthologyFields; !reflect.DeepEqual(f, anthologyFields{}) {
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

// AN ESSAY HEADS ITS OWN SECTION, and before this it exported under a number.
//
// A standalone quote's Source is its OCCASION, and `entriesFor` read no other
// column for it — so a passage filed the way the capture screen asks for an essay
// (its source title, no occasion) arrived at `anthologyHeading` with both Source
// and Credit empty and fell through to the position fallback. That fallback's own
// comment says it is for "the one case where the reader has written the least",
// and an essay with a title and an author is not that case.
//
// THE TITLE GOES OUT UNDER `work_title` AND NOT UNDER `occasion`, which is the
// half a COALESCE would have got wrong: the quotes importer maps `occasion` to
// the occasion column (quote_markdown.go), so folding the two would move the
// field on the way back in. This asserts both — the heading, and the key.
func TestAnEssayHeadsItsSectionByItsTitle(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	utt := newUtterance(t, c, map[string]any{
		"quote": "the economic anarchy of capitalist society", "kind": "essay",
		"speaker": "Albert Einstein", "work_title": "Why Socialism?",
	})
	// THE CASE THAT ACTUALLY REACHED THE NUMBER, and the reason there are two. The
	// essay above carries a speaker, so before the fix it headed "## Albert
	// Einstein" — mistitled, but not a bare position. The fallback is only reached
	// when the credit is empty TOO, which is an essay filed with its title and
	// nothing else: exactly the row the capture screen produces when the reader
	// fills the field the screen asks for and no other. Without this entry the
	// test passes over a heading that was never a number.
	bare := newUtterance(t, c, map[string]any{
		"quote": "a society in which every man is dependent on nobody", "kind": "essay",
		"work_title": "On Liberty",
	})
	a := newAnthology(t, c, "Openings")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "utterance", "item_id": utt.ID},
		{"kind": "utterance", "item_id": bare.ID},
	})

	md := exportAnthology(t, c, a.ID)
	if !strings.Contains(md, "## Why Socialism? — Albert Einstein") {
		t.Errorf("the essay did not head its own section:\n%s", md)
	}
	if !strings.Contains(md, "## On Liberty\n") {
		t.Errorf("the essay with no speaker did not head its own section:\n%s", md)
	}
	// Reverted, THIS is the assertion that fails: entry two has nothing else to be
	// called, so it heads as "## 2".
	if strings.Contains(md, "## 2\n") {
		t.Errorf("the essay still exported under its position:\n%s", md)
	}
	// THE KEY IS THE ONE THE IMPORTER READS BACK TO THE SAME COLUMN.
	if !strings.Contains(md, "- work_title: Why Socialism?") {
		t.Errorf("the title went out under some other key:\n%s", md)
	}
	if strings.Contains(md, "- occasion: Why Socialism?") {
		t.Errorf("the title went out as an occasion, which re-imports into the wrong column:\n%s", md)
	}
}

// THE WORK JOIN (0074) — everything the book or the film knows, which an entry has
// carried the id of since 0043 and which no part of the anthology ever read.
//
// THREE CLAIMS, AND THE FIRST TWO ARE THE ONES THAT MATTER. A field that is off
// appears nowhere (so a default export is unchanged, which the test at the top of
// this file holds byte for byte); a field that is on appears in BOTH the reading
// view's JSON and the exported Markdown (0045's promise that the screen and the
// file are one document); and a field belonging to a kind the entry is not simply
// does not print, rather than printing empty.
func TestTheWorkFieldsAnAnthologyIsToldToShow(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "A Wizard of Earthsea", "author": "Ursula K. Le Guin",
		"publisher": "Parnassus Press", "published_year": 1968,
		"series": "Earthsea", "series_index": 1, "pages": 183,
	}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Only in silence the word,",
	}, http.StatusCreated))
	// A standalone quote in the same anthology, because the interesting failure is
	// a work field printed on an entry that HAS no work.
	utt := newUtterance(t, c, map[string]any{"quote": "The sea is not a thing.", "speaker": "Nobody"})

	a := newAnthology(t, c, "Earthsea")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann.ID},
		{"kind": "utterance", "item_id": utt.ID},
	})

	// OFF FIRST. The work is joined and sent regardless — the reading view has to
	// be able to honour a switch without refetching — but nothing is WRITTEN.
	md := exportAnthology(t, c, a.ID)
	for _, k := range []string{"- publisher:", "- year:", "- series:", "- pages:"} {
		if strings.Contains(md, k) {
			t.Errorf("a default anthology exported %q:\n%s", k, md)
		}
	}

	setFields(t, c, a.ID, "Earthsea", map[string]any{
		"fields": map[string]any{"publisher": true, "year": true, "series": true, "pages": true},
	})

	got := getAnthology(t, c, a.ID)
	if !got.Anthology.Extra["publisher"] {
		t.Fatalf("the switch did not survive the round trip to the row: %+v", got.Anthology.Extra)
	}
	if w := got.Entries[0].Work; w["publisher"] != "Parnassus Press" || w["year"] != "1968" || w["pages"] != "183" {
		t.Errorf("the entry did not carry its work's fields: %+v", w)
	}
	// SERIES AND ITS NUMBER ARE ONE FIELD, joined the way a reader writes it.
	if w := got.Entries[0].Work; w["series"] != "Earthsea 1" {
		t.Errorf("series = %q, want %q", w["series"], "Earthsea 1")
	}
	// A STANDALONE QUOTE HAS NO WORK AT ALL — not an empty map, absent.
	if w := got.Entries[1].Work; len(w) != 0 {
		t.Errorf("a standalone quote carried work fields: %+v", w)
	}

	md = exportAnthology(t, c, a.ID)
	for _, want := range []string{
		"- publisher: Parnassus Press",
		"- year: 1968",
		"- series: Earthsea 1",
		"- pages: 183",
	} {
		if !strings.Contains(md, want) {
			t.Errorf("missing %q from:\n%s", want, md)
		}
	}
	// AND NOT ON THE QUOTE THAT HAS NO BOOK. Counted rather than searched, because
	// "contains publisher" would pass with it printed twice on the wrong entry.
	if n := strings.Count(md, "- publisher:"); n != 1 {
		t.Errorf("publisher written %d times over two entries, want 1:\n%s", n, md)
	}
}

// A FIELD BELONGING TO THE OTHER KIND IS NOT WRITTEN, which is the registry's
// `Kinds` list doing its job rather than the value happening to be empty. `isbn`
// is a book's and `media_type` is a film's, and each is switched on over an
// anthology holding both.
func TestAWorkFieldOfTheOtherKindIsNotWritten(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, dia, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Both")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
	})
	setFields(t, c, a.ID, "Both", map[string]any{
		"fields": map[string]any{"isbn": true, "media_type": true, "director": true, "author": true},
	})
	md := exportAnthology(t, c, a.ID)
	// The film has a director and the book does not; neither has an ISBN or a media
	// type recorded, so the proof that Kinds is being read is the AUTHOR: it is a
	// book field, the film's director is in the same registry slot under another
	// key, and a registry that ignored Kinds would print the author's binding for
	// the film entry with the director's value in it.
	if !strings.Contains(md, "- author: Italo Calvino") {
		t.Errorf("the book's author did not reach the file:\n%s", md)
	}
	if !strings.Contains(md, "- director: Andrei Tarkovsky") {
		t.Errorf("the film's director did not reach the file:\n%s", md)
	}
	if n := strings.Count(md, "- author:"); n != 1 {
		t.Errorf("author written %d times, want 1 — a film has no author:\n%s", n, md)
	}
	if n := strings.Count(md, "- director:"); n != 1 {
		t.Errorf("director written %d times, want 1 — a book has no director:\n%s", n, md)
	}
}

// AN UNKNOWN KEY IS NOT STORED. The `fields` column is the registry's vocabulary,
// and a client inventing a name must not get it persisted — otherwise the column
// accumulates whatever any version of any client ever posted, and the set of
// things an anthology "shows" stops being answerable from the registry alone.
func TestAFieldNameTheRegistryDoesNotKnowIsDropped(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	a := newAnthology(t, c, "Vocabulary")
	setFields(t, c, a.ID, "Vocabulary", map[string]any{
		"fields": map[string]any{"publisher": true, "not_a_field": true},
	})
	got := getAnthology(t, c, a.ID)
	if !got.Anthology.Extra["publisher"] {
		t.Errorf("the known key did not survive: %+v", got.Anthology.Extra)
	}
	if got.Anthology.Extra["not_a_field"] {
		t.Errorf("an invented key was stored: %+v", got.Anthology.Extra)
	}
	// AND NEITHER IS ONE OF THE SIX, which have columns of their own: accepting
	// "credit" here would give the same switch two homes that could disagree.
	setFields(t, c, a.ID, "Vocabulary", map[string]any{"fields": map[string]any{"credit": true}})
	if got := getAnthology(t, c, a.ID); got.Anthology.Extra["credit"] {
		t.Errorf("a 0045 column was mirrored into the fields blob: %+v", got.Anthology.Extra)
	}
}

// THE PERSON JOIN (0074) — the life behind the name, which is the first group of
// fields a STANDALONE QUOTE can show: everything in the work join needs a parent
// work and a proverb has none.
//
// THE MISS IS THE CLAIM WORTH TESTING. `people` matches by exact name and a row
// exists only where somebody looked that name up, so most entries have none. A
// second entry whose speaker has no record is in here for that reason: the failure
// this guards is not "the bio is missing" but "the bio from the entry above it is
// printed under this one", which a single-entry test cannot see.
func TestThePersonBehindAPassage(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Ursula K. Le Guin",
		"bio": "Wrote about anarchism and dragons.", "born": "1929", "died": "2018",
	}, http.StatusOK)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "A Wizard of Earthsea", "author": "Ursula K. Le Guin",
	}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Only in silence the word,",
	}, http.StatusCreated))
	// A speaker with NO record — the ordinary case.
	utt := newUtterance(t, c, map[string]any{
		"quote": "The sea is not a thing.", "speaker": "Someone Unrecorded",
	})

	a := newAnthology(t, c, "Silence")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann.ID},
		{"kind": "utterance", "item_id": utt.ID},
	})
	setFields(t, c, a.ID, "Silence", map[string]any{
		"fields": map[string]any{"bio": true, "born": true},
	})

	got := getAnthology(t, c, a.ID)
	if p := got.Entries[0].Person; p["bio"] != "Wrote about anarchism and dragons." || p["born"] != "1929" {
		t.Errorf("the author's record did not reach the entry: %+v", p)
	}
	// DIED IS IN THE RECORD AND SWITCHED OFF, so it must be joined and not written.
	// Sent on the row — the reading view honours a switch without refetching — and
	// absent from the file.
	if p := got.Entries[0].Person; p["died"] != "2018" {
		t.Errorf("the row should carry every field it has, switch or no switch: %+v", p)
	}
	if p := got.Entries[1].Person; len(p) != 0 {
		t.Errorf("a speaker with no record carried a person: %+v", p)
	}

	md := exportAnthology(t, c, a.ID)
	if !strings.Contains(md, "- bio: Wrote about anarchism and dragons.") {
		t.Errorf("the bio did not reach the file:\n%s", md)
	}
	if !strings.Contains(md, "- born: 1929") {
		t.Errorf("the birth year did not reach the file:\n%s", md)
	}
	if strings.Contains(md, "- died:") {
		t.Errorf("a switched-off field was written:\n%s", md)
	}
	// Once, on the entry that owns it — not on the quote whose speaker has no row.
	if n := strings.Count(md, "- bio:"); n != 1 {
		t.Errorf("bio written %d times over two entries, want 1:\n%s", n, md)
	}
}

// THE CAST JOIN AND THE TWO PORTRAITS (0048/0050).
//
// THE VOCABULARY MISMATCH IS THE WHOLE RISK. An anthology entry is
// `book | screen | utterance` and a cast row is `book | movie` — the same word for
// books and a different one for films. Getting that wrong matches no rows and looks
// exactly like a work with no cast, which is the ordinary state, so nothing on
// screen would say anything was wrong. The film case below is the one that would
// fail; the book case is there so a fix that inverted the mapping cannot pass.
func TestACharactersFaceReachesTheEntryThatNamesThem(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated))
	dia := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Let everything that has been planned come true.",
		"character": "Stalker", "actor": "Alexander Kaidanovsky",
	}, http.StatusCreated))
	// The cast row a film screen would have written, WITH a downloaded face.
	// Written directly because the path that fills it fetches from a provider, and
	// what is under test is the join rather than the fetch.
	//
	// `kind` IS 'movie' AND THE ANTHOLOGY ENTRY'S IS 'screen' — the mismatch this
	// test exists for. A join that passed the entry's kind straight through would
	// find nothing here and look exactly like a film with no cast.
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_cast (user_id, kind, work_id, character, character_key, actor, actor_key,
		                        character_image_path, billing, origin, source)
		 VALUES (1, 'movie', ?, 'Stalker', ?, 'Alexander Kaidanovsky', ?,
		         '00112233445566aa.jpg', 0, 'provider', 'tmdb')`,
		movie.ID, store.CastKey("Stalker"), store.CastKey("Alexander Kaidanovsky")); err != nil {
		t.Fatal(err)
	}

	a := newAnthology(t, c, "Zone")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "screen", "item_id": dia.ID}})
	setFields(t, c, a.ID, "Zone", map[string]any{"fields": map[string]any{"character_portrait": true}})

	got := getAnthology(t, c, a.ID).Entries[0].Cast
	if got["character_portrait"] != "00112233445566aa.jpg" {
		t.Errorf("the character's face did not reach the entry: %+v", got)
	}
}

// AND THE MAPPING ITSELF, asserted directly, because the test above can only fail
// one way round: a mapping that returned "screen" would find nothing, and so would
// one that returned "" — two different bugs with one symptom.
func TestAnEntrysKindBecomesTheCastTablesKind(t *testing.T) {
	for _, tc := range []struct{ entry, cast string }{
		{kindBook, "book"},
		{kindScreen, "movie"},
		{kindUtterance, ""},
	} {
		if got := castKindOfEntry(tc.entry); got != tc.cast {
			t.Errorf("a %q entry looks for %q cast rows, want %q", tc.entry, got, tc.cast)
		}
	}
}

// A PORTRAIT IS NOT A MARKDOWN BINDING, which is the third meaning `Binding: ""`
// carries in the registry — and the one worth a test, because the other two are
// fields that ARE written and this is a field that must not be.
func TestAPortraitIsNeverWrittenIntoTheMarkdown(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	c.mustDo("PUT", "/people", map[string]any{
		"kind": "author", "name": "Italo Calvino", "bio": "Wrote about cities.",
	}, http.StatusOK)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Cities")
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	setFields(t, c, a.ID, "Cities", map[string]any{
		"fields": map[string]any{"portrait": true, "character_portrait": true, "bio": true},
	})
	md := exportAnthology(t, c, a.ID)
	// The bio IS written — so this is not passing because the switches were ignored.
	if !strings.Contains(md, "- bio: Wrote about cities.") {
		t.Fatalf("the bio did not reach the file, so this test proves nothing:\n%s", md)
	}
	for _, key := range []string{"- portrait:", "- character_portrait:"} {
		if strings.Contains(md, key) {
			t.Errorf("a picture was written into the Markdown as %q:\n%s", key, md)
		}
	}
}
