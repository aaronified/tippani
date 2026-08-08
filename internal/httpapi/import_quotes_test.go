package httpapi

// Import for standalone quotes (ROADMAP §24), and the round trip.
//
// THE ROUND TRIP IS THE LOAD-BEARING TEST. An exporter and an importer that
// disagree do not fail — they lose attribution on the way back in, and the user
// finds out months later when a quote they saved from a speech is sitting under
// no speech at all. Asserting export→import→row equality is the only check that
// catches a key renamed on one side, a heading that stops carrying, or a date
// written to one field and read from another.

import (
	"net/http"
	"testing"
)

type quotesStagedResp struct {
	BatchID int64 `json:"batch_id"`
	Staged  int   `json:"staged"`
	Works   []struct {
		ID     int64  `json:"id"`
		Kind   string `json:"kind"`
		Title  string `json:"title"`
		Staged int    `json:"staged"`
	} `json:"works"`
}

type quotesApproveResp struct {
	Approved    int `json:"approved"`
	QuotesAdded int `json:"quotes_added"`
	Added       int `json:"added"`
	Skipped     int `json:"skipped"`
}

// stageQuotesMD uploads a markdown file and returns the staging reply. It uses
// the shared importFile helper so these tests upload exactly the way every
// other import test does.
func stageQuotesMD(t *testing.T, c *testClient, filename, body string) quotesStagedResp {
	t.Helper()
	rec := c.importFile("/import/markdown", filename, []byte(body))
	if rec.Code != http.StatusOK {
		t.Fatalf("import: got %d — %s", rec.Code, rec.Body.String())
	}
	return decode[quotesStagedResp](t, rec)
}

// approveBatch approves exactly what one upload staged. Scoping by batch
// matters here: a test that imports the same file twice must approve each
// upload separately, or the second approve finds an empty queue and proves
// nothing.
func approveBatch(t *testing.T, c *testClient, batchID int64) quotesApproveResp {
	t.Helper()
	return decode[quotesApproveResp](t, c.mustDo("POST", "/import/staged/approve",
		map[string]any{"batch_id": batchID}, http.StatusOK))
}

func TestQuotesRoundTripThroughMarkdown(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// One fully attributed quote, one proverb, and a second line from the same
	// speech — the three shapes the format has to keep apart.
	full := bose()
	full["note"] = "the Azad Hind broadcast"
	full["color"] = "blue"
	full["tags"] = []string{"freedom"}
	full["favorite"] = true
	newUtterance(t, c, full)

	second := bose()
	second["quote"] = "Freedom is not given, it is taken"
	newUtterance(t, c, second)

	newUtterance(t, c, map[string]any{"quote": "Least said, soonest mended"})

	md := exportQuotes(t, c, nil)

	// A second account imports the file, so the round trip is a real one rather
	// than a no-op against rows that already exist.
	bob := addUser(t, h, c, "bob")
	staged := stageQuotesMD(t, bob, "tippani-quotes.md", md)
	approveBatch(t, bob, staged.BatchID)

	got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 3 {
		t.Fatalf("expected three quotes back, got %d: %+v", len(got.Utterances), got.Utterances)
	}
	byQuote := map[string]utteranceRow{}
	for _, u := range got.Utterances {
		byQuote[u.Quote] = u
	}

	a, ok := byQuote["Give me blood, and I will give you freedom"]
	if !ok {
		t.Fatalf("the attributed quote did not survive: %+v", got.Utterances)
	}
	if a.Speaker != "Subhas Chandra Bose" || a.Occasion != "Burma Radio broadcast" {
		t.Fatalf("attribution lost in the round trip: %+v", a)
	}
	if a.OccasionDate != "1944" {
		t.Fatalf("occasion date lost: %q", a.OccasionDate)
	}
	if a.Place != "Burma" || a.Medium != "radio" {
		t.Fatalf("place/medium lost: %+v", a)
	}
	if a.Note != "the Azad Hind broadcast" || a.Color != "blue" || !a.Favorite {
		t.Fatalf("note/colour/favourite lost: %+v", a)
	}
	if len(a.Tags) != 1 || a.Tags[0] != "freedom" {
		t.Fatalf("tags lost: %v", a.Tags)
	}

	// The heading carried to the second line of the same speech...
	if b := byQuote["Freedom is not given, it is taken"]; b.Occasion != "Burma Radio broadcast" {
		t.Fatalf("the heading did not carry to the second quote: %+v", b)
	}
	// ...and did NOT reach the proverb, which was written before it.
	p := byQuote["Least said, soonest mended"]
	if p.Occasion != "" || p.Speaker != "" {
		t.Fatalf("the proverb picked up an attribution it never had: %+v", p)
	}
}

// A file that names the same line on the same occasion twice stages once, so
// the count the user approves matches what they will get.
func TestImportQuotesCollapsesInFileDuplicates(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n## Burma Radio broadcast\n\n" +
		"> Give me blood\n- speaker: Bose\n\n" +
		"> Give me blood\n- speaker: Bose\n"
	staged := stageQuotesMD(t, c, "dupes.md", md)
	if staged.Staged != 1 {
		t.Fatalf("expected one staged row, got %d", staged.Staged)
	}
}

// The same words on a DIFFERENT occasion are a different quote — the dedupe
// rule §24 inverts. A staging hash that used the plain DedupeHash would collapse
// these two and silently lose one.
func TestImportQuotesKeepsTheSameLineOnTwoOccasions(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n" +
		"## Burma Radio broadcast\n\n> Give me blood\n- speaker: Bose\n\n" +
		"## Singapore rally\n\n> Give me blood\n- speaker: Bose\n"
	staged := stageQuotesMD(t, c, "two-occasions.md", md)
	if staged.Staged != 2 {
		t.Fatalf("the occasion must discriminate: staged %d, want 2", staged.Staged)
	}
	approveBatch(t, c, staged.BatchID)
	got := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 2 {
		t.Fatalf("expected both occasions saved, got %d", len(got.Utterances))
	}
}

// Re-importing a file you already approved adds nothing. This is the live
// UNIQUE doing its job at approval time, reported as a skip rather than an error.
func TestImportQuotesIsIdempotent(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n## a rally\n\n> a line worth keeping\n- speaker: Someone\n"
	one := stageQuotesMD(t, c, "q.md", md)
	first := approveBatch(t, c, one.BatchID)
	if first.QuotesAdded != 1 {
		t.Fatalf("first approve added %d, want 1", first.QuotesAdded)
	}

	two := stageQuotesMD(t, c, "q.md", md)
	second := approveBatch(t, c, two.BatchID)
	if second.QuotesAdded != 0 {
		t.Fatalf("re-importing added %d rows, want 0", second.QuotesAdded)
	}
	got := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 1 {
		t.Fatalf("re-import duplicated the quote: %d rows", len(got.Utterances))
	}
}

// An occasion date the calendar refuses is dropped, not fatal. The quote is
// what is worth keeping; a bad date is recoverable by hand, and failing the
// whole approval over one would lose the rest of the file.
func TestImportQuotesDropsAnImpossibleDate(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n## a rally\n\n> a line\n- speaker: Someone\n- occasion_date: 1944-02-30\n"
	staged := stageQuotesMD(t, c, "baddate.md", md)
	approveBatch(t, c, staged.BatchID)

	got := decode[utterancesResp](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	if len(got.Utterances) != 1 {
		t.Fatalf("the quote was lost along with its date: %d rows", len(got.Utterances))
	}
	if got.Utterances[0].OccasionDate != "" {
		t.Fatalf("an impossible date was stored: %q", got.Utterances[0].OccasionDate)
	}
}

// A staged batch belongs to the account that uploaded it, and approving it
// writes to that account only.
func TestImportQuotesStaysWithItsAccount(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	md := "---\ntype: quotes\n---\n\n## a rally\n\n> a line of alice's\n- speaker: Someone\n"
	staged := stageQuotesMD(t, alice, "q.md", md)
	approveBatch(t, alice, staged.BatchID)

	if got := decode[utterancesResp](t, bob.mustDo("GET", "/quotes", nil, http.StatusOK)); len(got.Utterances) != 0 {
		t.Fatalf("another account's import reached this one: %+v", got.Utterances)
	}
	if got := decode[utterancesResp](t, alice.mustDo("GET", "/quotes", nil, http.StatusOK)); len(got.Utterances) != 1 {
		t.Fatalf("the importing account did not get its quote: %d", len(got.Utterances))
	}
}

// A quotes file must not be routed to the book parser. Before MarkdownKind knew
// a third shape, one would have fallen through and come back as a book with no
// title — the same hole `type:` closed for the catalogue.
func TestImportQuotesFileIsNotReadAsABook(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	md := "---\ntype: quotes\n---\n\n> a line\n- speaker: Someone\n"
	staged := stageQuotesMD(t, c, "q.md", md)
	approveBatch(t, c, staged.BatchID)

	var books struct {
		Books []bookDetail `json:"books"`
	}
	books = decode[struct {
		Books []bookDetail `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 0 {
		t.Fatalf("a quotes file created %d books: %+v", len(books.Books), books.Books)
	}
}
