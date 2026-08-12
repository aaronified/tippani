package httpapi

import (
	"net/http"
	"testing"
)

// Deleting more than one thing on purpose.
//
// This is the only path in the app that removes many rows at once, so every case
// here is either "it did exactly what was asked" or "it refused". The refusals
// matter more: a bulk delete that acts on one id the caller did not own, or on a
// phrase they did not type, is the kind of thing nobody discovers until the rows
// are gone.
//
// It is recoverable — one bin entry for the whole selection — and that is WHY it
// can exist at all, not a reason to be casual about it.

type bulkDeleteResp struct {
	Deleted int   `json:"deleted"`
	TrashID int64 `json:"trash_id"`
}

func threeQuotes(t *testing.T, c *testClient) []int64 {
	t.Helper()
	var ids []int64
	for _, q := range []string{"the first line", "the second line", "the third line"} {
		ids = append(ids, idOf(t, c.mustDo("POST", "/quotes",
			map[string]any{"quote": q, "speaker": "A"}, 201).Body.Bytes()))
	}
	return ids
}

func TestBulkDeleteTakesTheWholeSelectionAsOneBinEntry(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	ids := threeQuotes(t, c)

	got := decode[bulkDeleteResp](t, c.mustDo("POST", "/quotes/bulk/delete", map[string]any{
		"ids": ids, "confirm": "delete 3 quotes",
	}, 200))
	if got.Deleted != 3 || got.TrashID == 0 {
		t.Fatalf("response: %+v", got)
	}

	// Gone from the library.
	var live int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances`).Scan(&live); err != nil {
		t.Fatal(err)
	}
	if live != 0 {
		t.Fatalf("%d quotes survived", live)
	}

	// ONE entry, not three: the bin shows one decision. Forty entries for one act
	// would be a wall of rows, and undoing it would be forty restores that can each
	// half-fail.
	bin := binOf(t, c).Trash
	if len(bin) != 1 {
		t.Fatalf("bin holds %+v", bin)
	}
	if bin[0].Kind != "selection" || bin[0].ChildCount != 3 || bin[0].Label != "3 quotes" {
		t.Fatalf("entry: %+v", bin[0])
	}
}

func TestRestoringASelectionBringsThemAllBack(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	ids := threeQuotes(t, c)
	// One of them wears a tag, so the restore has joins to put back too.
	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": ids[:1], "add_tags": []string{"grief"}}, 200)

	c.mustDo("POST", "/quotes/bulk/delete", map[string]any{"ids": ids, "confirm": "delete 3 quotes"}, 200)
	restore(t, c, binOf(t, c).Trash[0].ID, http.StatusOK)

	rows := decode[struct {
		Quotes []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, 200)).Quotes
	if len(rows) != 3 {
		t.Fatalf("came back: %+v", rows)
	}
	byID := map[int64]utteranceRow{}
	for _, q := range rows {
		byID[q.ID] = q
	}
	for _, id := range ids {
		if _, ok := byID[id]; !ok {
			t.Fatalf("quote %d did not come back with its own id", id)
		}
	}
	if len(byID[ids[0]].Tags) != 1 || byID[ids[0]].Tags[0] != "grief" {
		t.Errorf("the tag did not come back: %+v", byID[ids[0]].Tags)
	}
	// And the entry is spent.
	if left := binOf(t, c).Trash; len(left) != 0 {
		t.Fatalf("the bin still holds %+v", left)
	}
}

func TestBulkDeleteNeedsThePhrase(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	ids := threeQuotes(t, c)

	for _, confirm := range []string{"", "yes", "DELETE", "delete 3 items", "delete 2 quotes"} {
		rec := c.do("POST", "/quotes/bulk/delete", map[string]any{"ids": ids, "confirm": confirm})
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("confirm %q was accepted (%d)", confirm, rec.Code)
		}
	}
	// Nothing was deleted by any of those, and nothing was binned either.
	var live, binned int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances`).Scan(&live)
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM trash`).Scan(&binned)
	if live != 3 || binned != 0 {
		t.Fatalf("after the refusals: %d quotes, %d bin entries", live, binned)
	}

	// Case and surrounding space are forgiven — the phrase is a speed bump, not a
	// spelling test.
	c.mustDo("POST", "/quotes/bulk/delete", map[string]any{"ids": ids, "confirm": "  Delete 3 Quotes "}, 200)
}

func TestBulkDeletePhraseCountsWhatItWillActuallyDelete(t *testing.T) {
	// The subtle one. A selection holding one id that is not yours must not ask for
	// a phrase naming the number you SELECTED — the reader would type what the
	// screen said, be refused, and have no way to find out why.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	mine := threeQuotes(t, bob)
	theirs := idOf(t, admin.mustDo("POST", "/quotes",
		map[string]any{"quote": "not bob's", "speaker": "Z"}, 201).Body.Bytes())

	ids := append([]int64{theirs}, mine...)
	// Four selected, three deletable: the phrase is about the three.
	rec := bob.do("POST", "/quotes/bulk/delete", map[string]any{"ids": ids, "confirm": "delete 4 quotes"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a phrase counting a foreign id was accepted: %d", rec.Code)
	}
	bob.mustDo("POST", "/quotes/bulk/delete", map[string]any{"ids": ids, "confirm": "delete 3 quotes"}, 200)

	// The admin's quote is untouched, and bob's are gone.
	var foreign int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances WHERE id = ?`, theirs).Scan(&foreign)
	if foreign != 1 {
		t.Fatal("bob deleted the admin's quote")
	}
	var left int
	srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances`).Scan(&left)
	if left != 1 {
		t.Fatalf("%d quotes left, want just the admin's", left)
	}
}

func TestBulkDeleteWorksForHighlightsAndFilmLines(t *testing.T) {
	// The other two kinds, and the nouns their phrases use — a highlight is not a
	// "quote" in the confirmation, because the reader is looking at a book.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	bookID := createBook(t, c, "The Dispossessed")
	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, 201).Body.Bytes())
	ann := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "a highlight"}, 201).Body.Bytes())
	dlg := idOf(t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": movieID, "quote": "a film line"}, 201).Body.Bytes())

	c.do("POST", "/annotations/bulk/delete", map[string]any{"ids": []int64{ann}, "confirm": "delete 1 quote"})
	c.mustDo("POST", "/annotations/bulk/delete",
		map[string]any{"ids": []int64{ann}, "confirm": "delete 1 highlight"}, 200)
	c.mustDo("POST", "/dialogues/bulk/delete",
		map[string]any{"ids": []int64{dlg}, "confirm": "delete 1 film line"}, 200)

	if left := binOf(t, c).Trash; len(left) != 2 {
		t.Fatalf("bin: %+v", left)
	}
}

func TestBulkDeleteGuards(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	c.mustDo("POST", "/quotes/bulk/delete", map[string]any{"ids": []int64{}, "confirm": "delete 0 quotes"}, http.StatusBadRequest)
	c.mustDo("POST", "/quotes/bulk/delete", map[string]any{"ids": []int64{9999}, "confirm": "delete 1 quote"}, http.StatusNotFound)
}
