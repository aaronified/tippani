package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
	firstApproved := decode[approveReply](t, c.do("POST", "/import/staged/approve",
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

	approved := decode[approveReply](t, c.do("POST", "/import/staged/approve",
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
	if a := decode[approveReply](t, c.do("POST", "/import/staged/approve",
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

	got := decode[approveReply](t, c.do("POST", "/import/staged/approve",
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
