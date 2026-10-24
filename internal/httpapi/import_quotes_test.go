package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Import for standalone quotes (ROADMAP §24), and the round trip.
//
// THE ROUND TRIP IS THE LOAD-BEARING TEST. An exporter and an importer that
// disagree do not fail — they lose attribution on the way back in, and the user
// finds out months later when a quote they saved from a speech is sitting under
// no speech at all. Asserting export→import→row equality is the only check that
// catches a key renamed on one side, a heading that stops carrying, or a date
// written to one field and read from another.

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
	return decode[quotesApproveResp](t, c.mustFollow("POST", "/import/staged/approve",
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

// crossSourceBooks is the slice of GET /books these two tests need: a title is
// all either one asserts on.
type crossSourceBooks struct {
	Books []struct {
		ID    int64  `json:"id"`
		Title string `json:"title"`
	} `json:"books"`
}

// One book arriving from two of its own sources. The owner's Kindle wrote
// The Idiot into My Clippings.txt and Bookcision exported the same book as
// JSON: 22 highlights on one side, 11 records on the other, 8 of them the same
// sentences. Importing both has to leave one book whose annotations are the
// union, and this is the case a BOM stuck to the device's title line used to
// break — the two sources became two books whose titles differed by a character
// nobody can see, so nothing ever met its duplicate to be collapsed.
//
// Reads the owner's real exports, so it skips wherever they are absent, as CI
// is. The synthetic cross-source case below runs everywhere.
func TestImportTheSameBookFromTwoRealSources(t *testing.T) {
	const dir = "../importer/testdata"
	clips, err := os.ReadFile(filepath.Join(dir, "kindle_clippings_real.txt"))
	if err != nil {
		t.Skip("real My Clippings.txt not present (gitignored — owner privacy)")
	}
	bc, err := os.ReadFile(filepath.Join(dir, "bookcision_real", "the_idiot.json"))
	if err != nil {
		t.Skip("real Bookcision corpus not present (gitignored — owner privacy)")
	}

	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	// The device file first: it carries several books, The Idiot among them.
	first := stage(t, c, "/import/kindle-clippings", "My Clippings.txt", clips)
	firstApproved := decode[approveReply](t, c.follow("POST", "/import/staged/approve",
		map[string]any{"batch_id": first.BatchID}))
	if firstApproved.Added == 0 {
		t.Fatalf("clippings import added nothing: %+v", firstApproved)
	}

	// Then the JSON export of one of those same books.
	second := stage(t, c, "/import/bookcision", "the_idiot.json", bc)

	// Staging must recognise it, and this is the whole guarantee: the queue says
	// "you may already have this book" and names the row. It cannot merge on its
	// own — two sources of one book legitimately disagree about the edition, so
	// the target is a decision, not a deduction.
	if len(second.Dupes) == 0 {
		t.Fatalf("the second source went unrecognised: works=%+v", second.Works)
	}
	if !strings.Contains(second.Dupes[0].Title, "Idiot") {
		t.Fatalf("wrong duplicate named: %+v", second.Dupes)
	}
	target := second.Dupes[0].ID

	// Take the hint, which is what the queue's UI does when you accept it.
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"batch_id": second.BatchID,
		"retarget": map[string]any{"kind": "book", "id": target},
	}, http.StatusOK)

	approved := decode[approveReply](t, c.follow("POST", "/import/staged/approve",
		map[string]any{"batch_id": second.BatchID}))
	// Eight sentences are in both files: they must land on the existing rows
	// rather than beside them.
	if approved.Skipped == 0 {
		t.Errorf("the two sources share 8 highlights; none was skipped: staged %d, added %d, skipped %d",
			second.Staged, approved.Added, approved.Skipped)
	}
	if approved.Added == second.Staged {
		t.Errorf("every staged row was added, so nothing was recognised as already held: %+v", approved)
	}

	// One Idiot, not two. Two rows with the same title is what the BOM used to
	// guarantee, because the titles differed by a character nobody can see and
	// no hint was ever raised.
	books := decode[crossSourceBooks](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	var idiots []string
	for _, b := range books.Books {
		if strings.Contains(b.Title, "Idiot") {
			idiots = append(idiots, b.Title)
		}
	}
	if len(idiots) != 1 {
		t.Fatalf("got %d books matching Idiot %q, want 1", len(idiots), idiots)
	}
	if strings.ContainsRune(idiots[0], '\ufeff') {
		t.Errorf("a BOM reached the library: %q", idiots[0])
	}

	// And no quote is stored twice in that book.
	anns := decode[annList](t, c.mustDo("GET", "/annotations?limit=500", nil, http.StatusOK))
	seen := map[string]bool{}
	for _, a := range anns.Annotations {
		key := strings.Join(strings.Fields(strings.ToLower(a.Quote)), " ")
		if key == "" {
			continue
		}
		if seen[key] {
			t.Errorf("the same quote is stored twice: %.60q", a.Quote)
		}
		seen[key] = true
	}
	t.Logf("one book, %d annotations from two sources (%d staged, %d added, %d already held)",
		len(anns.Annotations), second.Staged, approved.Added, approved.Skipped)
}

// The same property without the owner's files, so CI holds the line too: two
// sources, one book, an overlapping quote and a fresh one. The device file's
// title line carries a BOM because a real one does.
func TestImportTheSameBookFromTwoSources(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	const shared = "The same sentence in both files."
	clips := strings.Join([]string{
		"\ufeffA Borrowed Light (Ashworth, N.)",
		"- Your Highlight on page 12 | Location 100-101 | Added on Monday, 5 January 2026 10:00:00",
		"",
		shared,
		"==========",
		"\ufeffA Borrowed Light (Ashworth, N.)",
		"- Your Highlight on page 20 | Location 200-201 | Added on Monday, 5 January 2026 10:05:00",
		"",
		"Only the device has this one.",
		"==========",
		"",
	}, "\n")

	first := stage(t, c, "/import/kindle-clippings", "My Clippings.txt", []byte(clips))
	if a := decode[approveReply](t, c.follow("POST", "/import/staged/approve",
		map[string]any{"batch_id": first.BatchID})); a.Added != 2 {
		t.Fatalf("clippings added %d, want 2", a.Added)
	}

	bc := `{"asin":"B00TEST001","title":"A Borrowed Light","authors":"N. Ashworth","highlights":[` +
		`{"text":"` + shared + `","isNoteOnly":false,"note":null,"location":{"value":100}},` +
		`{"text":"Only the export has this one.","isNoteOnly":false,"note":null,"location":{"value":300}}]}`
	second := stage(t, c, "/import/bookcision", "light.json", []byte(bc))
	// The device file and the JSON export name the same book, so the queue must
	// say so rather than quietly opening a second shelf entry.
	if len(second.Dupes) == 0 {
		t.Fatalf("the export was not recognised as the book already held: %+v", second.Works)
	}
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"batch_id": second.BatchID,
		"retarget": map[string]any{"kind": "book", "id": second.Dupes[0].ID},
	}, http.StatusOK)

	got := decode[approveReply](t, c.follow("POST", "/import/staged/approve",
		map[string]any{"batch_id": second.BatchID}))
	if got.Added != 1 || got.Skipped != 1 {
		t.Fatalf("the shared line must be skipped and the new one added: %+v", got)
	}

	books := decode[crossSourceBooks](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(books.Books) != 1 {
		var titles []string
		for _, b := range books.Books {
			titles = append(titles, b.Title)
		}
		t.Fatalf("got %d books %q, want 1", len(books.Books), titles)
	}
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, http.StatusOK))
	if len(anns.Annotations) != 3 {
		t.Fatalf("got %d annotations, want 3 (the union of the two files)", len(anns.Annotations))
	}
}

// vForVendettaQuotes is a minimal saved IMDb quotes page (the shape imdb.go's
// regexes read): year 2005, one single-speaker exchange and one two-speaker
// exchange. Year 2005 differs on purpose from the TMDB release year (2006) so
// the test exercises anchoring across a year mismatch.
const vForVendettaQuotes = `<html><body><script id="__NEXT_DATA__" type="application/json">` +
	`{"props":{"pageProps":{"contentData":{"data":{"title":{"id":"tt0434409",` +
	`"titleText":{"text":"V for Vendetta","__typename":"TitleText"},` +
	`"releaseYear":{"year":2005,"endYear":null,"__typename":"YearRange"},` +
	`"titleType":{"id":"movie","text":"Movie","isSeries":false,"__typename":"TitleType"},` +
	`"quotes":{"total":2,"edges":[` +
	`{"node":{"__typename":"TitleQuote","id":"qt1","displayableArticle":{"body":{"plainText":"\n* V: People should not be afraid of their governments.\n","__typename":"Markdown"}}}},` +
	`{"node":{"__typename":"TitleQuote","id":"qt2","displayableArticle":{"body":{"plainText":"\n* Evey: Who are you?\n* V: I am V.\n","__typename":"Markdown"}}}}` +
	`]}}}}}}}</script></body></html>`

type imdbImportResp struct {
	MovieID      int64  `json:"movie_id"`
	MediaType    string `json:"media_type"`
	Title        string `json:"title"`
	Created      bool   `json:"created"`
	Anchored     bool   `json:"anchored"`
	YearImported int    `json:"year_imported"`
	MatchedYear  int    `json:"matched_year"`
	Ambiguous    bool   `json:"ambiguous"`
	Alternatives int    `json:"alternatives"`
	Added        int    `json:"added"`
	Skipped      int    `json:"skipped"`
}

type movieListResp struct {
	Movies []struct {
		ID            int64 `json:"id"`
		DialogueCount int   `json:"dialogue_count"`
	} `json:"movies"`
}

// TestIMDbImportAnchors covers the reported bug: a title added first (via a
// lookup, year 2006) must have imported IMDb dialogues (year 2005) attach to it
// rather than spawn a poster-less duplicate — and the response reports the
// anchor + year mismatch for the review UI.
func TestIMDbImportAnchors(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// "Added prior": a curated row (a lookup would set the year to 2006).
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "V for Vendetta", "release_year": 2006}, http.StatusCreated))

	// Import the quotes page — must anchor onto m, not create a second title.
	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if res.MovieID != m.ID || res.Created || !res.Anchored {
		t.Fatalf("expected anchor onto movie %d, got %+v", m.ID, res)
	}
	if res.YearImported != 2005 || res.MatchedYear != 2006 {
		t.Fatalf("year reporting: %+v", res)
	}
	if res.Added != 2 || res.Skipped != 0 || res.Ambiguous {
		t.Fatalf("dialogue counts: %+v", res)
	}

	// Exactly one title, carrying both dialogues (no duplicate spawned).
	list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200))
	if len(list.Movies) != 1 || list.Movies[0].ID != m.ID || list.Movies[0].DialogueCount != 2 {
		t.Fatalf("library after import: %+v", list.Movies)
	}

	// Re-import is idempotent: same dialogues skipped, still one title.
	res2 := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if res2.Added != 0 || res2.Skipped != 2 {
		t.Fatalf("re-import not idempotent: %+v", res2)
	}
	if list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200)); len(list.Movies) != 1 {
		t.Fatalf("re-import spawned a title: %+v", list.Movies)
	}
}

// TestIMDbImportCreatesWhenNoMatch: with no same-title film present, the import
// creates a new bare row (the pre-anchoring behaviour, still correct).
func TestIMDbImportCreatesWhenNoMatch(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if !res.Created || res.Anchored || res.Added != 2 {
		t.Fatalf("expected a fresh create, got %+v", res)
	}
	if res.Title != "V for Vendetta" || res.MediaType != "movie" {
		t.Fatalf("header: %+v", res)
	}
}

// TestIMDbImportAmbiguous: two same-title films → the import anchors to one and
// flags the ambiguity so the review UI can prompt a check.
func TestIMDbImportAmbiguous(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	c.mustDo("POST", "/movies", map[string]any{"title": "V for Vendetta", "release_year": 2006}, http.StatusCreated)
	c.mustDo("POST", "/movies", map[string]any{"title": "V for Vendetta", "release_year": 1988}, http.StatusCreated)

	res := decode[imdbImportResp](t, c.importApprove("/import/imdb-quotes", "v.htm", []byte(vForVendettaQuotes)))
	if !res.Anchored || !res.Ambiguous || res.Alternatives != 1 {
		t.Fatalf("expected ambiguous anchor, got %+v", res)
	}
	// The 2005 import should have preferred neither-year-match; both lack posters
	// and dialogues, so recency wins — the 1988 row was created last.
	if list := decode[movieListResp](t, c.mustDo("GET", "/movies", nil, 200)); len(list.Movies) != 2 {
		t.Fatalf("ambiguous import spawned a title: %+v", list.Movies)
	}
}

// A book export whose quotes name a speaker, which is the field 0047 added to the
// Markdown format and the reason this file exists: an import is a path that writes
// a quote, so it owes the speaker link every other path writes.
const stagedSpokenBookMD = "---\ntitle: The Master and Margarita\nauthor: Mikhail Bulgakov\n---\n\n" +
	"> Manuscripts don't burn.\n- character: Woland\n\n" +
	"> Never talk to strangers.\n- character: Woland\n"

// The same file with the speaker taken off, so the second import donates it to a
// row that already exists — the enrichment arm rather than the insert.
const stagedSilentBookMD = "---\ntitle: The Master and Margarita\nauthor: Mikhail Bulgakov\n---\n\n" +
	"> Manuscripts don't burn.\n"

// The cast list is deliberately NOT read in either test below. Reading it adopts
// the character and catches every quote up (LinkWorkQuotesToCast), which would
// heal the very hole being pinned: the import's own write has to land the link,
// because "wrong until somebody opens the book" is the state the column was
// introduced to end.

func TestApprovingAnImportLinksTheSpeakerItWrites(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	bookID := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")
	row := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Woland"}, http.StatusCreated))

	res := stage(t, c, "/import/markdown", "mm.md", []byte(stagedSpokenBookMD))
	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)

	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, http.StatusOK))
	if len(anns.Annotations) != 2 {
		t.Fatalf("the import wrote %d highlights: %+v", len(anns.Annotations), anns.Annotations)
	}
	for _, a := range anns.Annotations {
		if got := speakerCast(t, srv, "annotations", a.ID); got != row.ID {
			t.Fatalf("imported highlight %d points at cast row %d, want %d", a.ID, got, row.ID)
		}
	}
}

func TestAnImportThatDonatesASpeakerLinksTheRowItEnriched(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	bookID := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")

	first := stage(t, c, "/import/markdown", "quiet.md", []byte(stagedSilentBookMD))
	c.mustFollow("POST", "/import/staged/approve", map[string]any{"batch_id": first.BatchID}, http.StatusOK)

	// The cast row arrives BETWEEN the two imports, so the first approval had
	// nothing to link to and the second one is the only chance the link gets.
	row := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Woland"}, http.StatusCreated))

	second := stage(t, c, "/import/markdown", "loud.md", []byte(stagedSpokenBookMD))
	ap := decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve",
		map[string]any{"batch_id": second.BatchID}, http.StatusOK))
	if ap.Enriched != 1 {
		t.Fatalf("want one enriched highlight, got %+v", ap)
	}

	anns := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, http.StatusOK))
	for _, a := range anns.Annotations {
		if a.Character != "Woland" {
			continue
		}
		if got := speakerCast(t, srv, "annotations", a.ID); got != row.ID {
			t.Fatalf("the enriched highlight points at cast row %d, want %d", got, row.ID)
		}
		return
	}
	t.Fatalf("no highlight came back naming Woland: %+v", anns.Annotations)
}
