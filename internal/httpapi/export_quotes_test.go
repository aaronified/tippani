package httpapi

// Markdown export for standalone quotes (ROADMAP §24).
//
// The assertions are on the EXACT bytes, not on "contains speaker". An export
// is one half of a round trip, and a format test that only checks a field
// appears somewhere will pass just as happily when the field lands under the
// wrong quote, after the wrong heading, or with the wrong key — all of which
// come back as wrongly attributed quotes rather than as an error.

import (
	"net/http"
	"strings"
	"testing"
)

func exportQuotes(t *testing.T, c *testClient, ids []int64) string {
	t.Helper()
	body := map[string]any{}
	if ids != nil {
		body["ids"] = ids
	}
	return c.mustDo("POST", "/export/quotes", body, http.StatusOK).Body.String()
}

func TestExportQuotesShape(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	body := bose()
	body["note"] = "the Azad Hind broadcast"
	body["color"] = "blue"
	body["tags"] = []string{"freedom", "1944"}
	body["favorite"] = true
	newUtterance(t, c, body)

	got := exportQuotes(t, c, nil)
	want := "---\ntype: quotes\n---\n" +
		"\n## Burma Radio broadcast\n" +
		"\n> Give me blood, and I will give you freedom\n" +
		"- speaker: Subhas Chandra Bose\n" +
		"- occasion_date: 1944\n" +
		"- place: Burma\n" +
		"- medium: radio\n" +
		"- note: the Azad Hind broadcast\n" +
		"- color: blue\n" +
		"- tags: 1944, freedom\n"
	if !strings.HasPrefix(got, want) {
		t.Fatalf("export shape:\n--- got ---\n%s\n--- want prefix ---\n%s", got, want)
	}
	// date is the day YOU saved it, so it is stamped today rather than fixed.
	if !strings.Contains(got, "\n- date: ") {
		t.Fatalf("the saved-on date is missing:\n%s", got)
	}
	if !strings.Contains(got, "\n- favorite: true\n") {
		t.Fatalf("favorite is missing:\n%s", got)
	}
	// The occasion is the heading, so it must NOT also be a binding — that is
	// the rule the book export applies to chapter, and repeating it would make
	// the file say the same thing twice and re-import ambiguously.
	if strings.Contains(got, "- occasion: ") {
		t.Fatalf("the occasion was repeated as a binding:\n%s", got)
	}
}

// A proverb has no occasion, so it lands before any "## " line. This is not
// cosmetic: the parser attributes a quote to the heading above it, so a proverb
// written after a heading comes back belonging to a speech it was never part of.
func TestExportQuotesPutsUnattributedFirst(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())
	newUtterance(t, c, map[string]any{"quote": "Least said, soonest mended"})

	got := exportQuotes(t, c, nil)
	proverb := strings.Index(got, "Least said, soonest mended")
	heading := strings.Index(got, "## ")
	if proverb < 0 || heading < 0 {
		t.Fatalf("expected both a proverb and a heading:\n%s", got)
	}
	if proverb > heading {
		t.Fatalf("the unattributed quote came after a heading, so it would re-import "+
			"as part of that speech:\n%s", got)
	}
}

// Two quotes from one speech share a heading; a third from another gets its
// own. Grouping is what makes the file readable and what the parser reads back.
func TestExportQuotesGroupsByOccasion(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose())
	second := bose()
	second["quote"] = "Freedom is not given, it is taken"
	newUtterance(t, c, second)
	third := bose()
	third["quote"] = "The only thing we have to fear is fear itself"
	third["speaker"] = "Franklin D. Roosevelt"
	third["occasion"] = "first inaugural address"
	newUtterance(t, c, third)

	got := exportQuotes(t, c, nil)
	if n := strings.Count(got, "## Burma Radio broadcast"); n != 1 {
		t.Fatalf("the shared occasion should appear once as a heading, got %d:\n%s", n, got)
	}
	if n := strings.Count(got, "## first inaugural address"); n != 1 {
		t.Fatalf("the second occasion is missing or doubled:\n%s", got)
	}
	// Both of Bose's lines sit under his heading, before FDR's.
	burma := strings.Index(got, "## Burma Radio broadcast")
	fdr := strings.Index(got, "## first inaugural address")
	for _, line := range []string{"Give me blood", "Freedom is not given"} {
		at := strings.Index(got, line)
		if at < burma || at > fdr {
			t.Fatalf("%q is not under its own heading:\n%s", line, got)
		}
	}
}

// The default colour is left out, so a file only mentions colour when one was
// chosen — the same rule the other two exports keep, and what stops every
// re-import claiming an explicit yellow.
func TestExportQuotesOmitsTheDefaultColour(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, bose())

	if got := exportQuotes(t, c, nil); strings.Contains(got, "- color:") {
		t.Fatalf("the default colour was written out:\n%s", got)
	}
}

func TestExportQuotesSelection(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	keep := newUtterance(t, c, bose())
	other := bose()
	other["quote"] = "Freedom is not given, it is taken"
	newUtterance(t, c, other)

	got := exportQuotes(t, c, []int64{keep.ID})
	if !strings.Contains(got, "Give me blood") {
		t.Fatalf("the selected quote is missing:\n%s", got)
	}
	if strings.Contains(got, "Freedom is not given") {
		t.Fatalf("an unselected quote was exported anyway:\n%s", got)
	}
}

// An export is a read over a parentless table, so it carries its own user
// scope. Passing another account's id must return a file without it — not that
// account's quote, and not an error that confirms the id exists.
func TestExportQuotesIsScopedToTheOwner(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	mine := newUtterance(t, alice, bose())

	if got := exportQuotes(t, bob, nil); strings.Contains(got, "Give me blood") {
		t.Fatalf("another account's quotes were exported:\n%s", got)
	}
	if got := exportQuotes(t, bob, []int64{mine.ID}); strings.Contains(got, "Give me blood") {
		t.Fatalf("naming another account's id exported it:\n%s", got)
	}
	// And a tag on someone else's quote is not leaked through the tag map.
	tagged := bose()
	tagged["quote"] = "a line of bob's"
	tagged["tags"] = []string{"bobs-tag"}
	newUtterance(t, bob, tagged)
	if got := exportQuotes(t, alice, nil); strings.Contains(got, "bobs-tag") {
		t.Fatalf("another account's tags reached this export:\n%s", got)
	}
}

// An empty library exports a file that is still a valid quotes file — the
// frontmatter is what routes a re-import, so an export with no quotes must not
// come back as an untyped, and therefore book-shaped, document.
func TestExportQuotesEmptyStillCarriesItsType(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	got := exportQuotes(t, c, nil)
	if got != "---\ntype: quotes\n---\n" {
		t.Fatalf("empty export: %q", got)
	}
}

// THE FIVE FIELDS 0047 ADDED, ON THE EXACT BYTES — for the reason at the top of
// this file. A "contains" check would pass with `- page:` written under the wrong
// quote, above the wrong heading, or in place of `- work_title:`; only the whole
// block says the file is right.
//
// The order is coarse to fine and pairs each new key with the one it qualifies:
// recipient under speaker (a letter's two parties), circa under occasion_date (the
// date's precision), region under place, and the essay's title above its page.
func TestExportQuotesWritesThePerKindFields(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, map[string]any{
		"quote":          "I have a bird in my hand.",
		"speaker":        "Rabindranath Tagore",
		"recipient":      "Jawaharlal Nehru",
		"occasion":       "a letter from Santiniketan",
		"occasion_date":  "1934",
		"occasion_circa": true,
		"place":          "Santiniketan",
		"region":         "Birbhum",
		"medium":         "letter",
		"work_title":     "Letters to a Friend",
		"locator":        "p. 44",
	})

	got := exportQuotes(t, c, nil)
	want := "---\ntype: quotes\n---\n" +
		"\n## a letter from Santiniketan\n" +
		"\n> I have a bird in my hand.\n" +
		"- speaker: Rabindranath Tagore\n" +
		"- recipient: Jawaharlal Nehru\n" +
		"- occasion_date: 1934\n" +
		"- circa: true\n" +
		"- place: Santiniketan\n" +
		"- region: Birbhum\n" +
		"- medium: letter\n" +
		"- work_title: Letters to a Friend\n" +
		"- page: p. 44\n"
	if !strings.HasPrefix(got, want) {
		t.Fatalf("export shape:\n--- got ---\n%s\n--- want prefix ---\n%s", got, want)
	}
	// The column is `locator`; the FILE key is `page`, because the anthology export
	// already writes "- locator:" for a joined display string. See applyQuoteBinding.
	if strings.Contains(got, "- locator:") {
		t.Fatalf("the quotes export must not write the anthology's key:\n%s", got)
	}
}

// The circa tick is written even with no date beside it, which looks odd and is
// right: the column has no cross-field rule, so an unaccompanied tick is real
// stored state and a file that dropped it would silently untick it.
func TestExportQuotesWritesACircaWithNoDate(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newUtterance(t, c, map[string]any{"quote": "Some time ago.", "occasion_circa": true})

	got := exportQuotes(t, c, nil)
	if !strings.Contains(got, "- circa: true") {
		t.Fatalf("a dateless circa was dropped:\n%s", got)
	}
	if strings.Contains(got, "- occasion_date:") {
		t.Fatalf("there was no date to write:\n%s", got)
	}
}
