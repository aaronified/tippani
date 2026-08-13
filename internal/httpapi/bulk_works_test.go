package httpapi

import (
	"net/http"
	"testing"
)

// What a selection of WORKS can do, which is a different list from what a
// selection of quotes can do — a book has no colour and no tag of its own, and a
// quote has no shelf.
//
// Two of the three are dangerous in ways the quote versions are not:
//
//   - DELETE takes children with it. Five books can be four hundred highlights,
//     their tags, their review schedules, their genres and their read logs, and all
//     of that has to land in ONE bin entry or an undo brings back a book with no
//     quotes in it.
//   - SHELF STATE moves the read log. The lifecycle's one rule is that completed
//     is settled, and a selection of forty holding one finished book must not
//     refuse the other thirty-nine.

type bulkDeleteWorkResp struct {
	Deleted int   `json:"deleted"`
	TrashID int64 `json:"trash_id"`
}

type bulkStatusResp struct {
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
}

func TestBulkDeletingBooksTakesTheirQuotesAndComesBackWhole(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	var books []int64
	for _, title := range []string{"The Dispossessed", "A Wizard of Earthsea"} {
		id := createBook(t, c, title)
		books = append(books, id)
		for _, q := range []string{"first", "second", "third"} {
			c.mustDo("POST", "/annotations",
				map[string]any{"book_id": id, "quote": title + ": " + q, "tags": []string{"le guin"}},
				http.StatusCreated)
		}
	}
	third := createBook(t, c, "Ficciones") // not selected; must survive untouched
	c.mustDo("POST", "/annotations", map[string]any{"book_id": third, "quote": "the garden"}, http.StatusCreated)

	// The phrase is the server's, and it names the count and the kind.
	c.mustDo("POST", "/books/bulk/delete",
		map[string]any{"ids": books, "confirm": "delete 1 book"}, http.StatusBadRequest)

	got := decode[bulkDeleteWorkResp](t, c.mustDo("POST", "/books/bulk/delete",
		map[string]any{"ids": books, "confirm": "delete 2 books"}, 200))
	if got.Deleted != 2 || got.TrashID == 0 {
		t.Fatalf("delete = %+v, want 2 and a bin entry", got)
	}

	// One entry for the whole selection, holding all six highlights.
	entries := binOf(t, c).Trash
	if len(entries) != 1 {
		t.Fatalf("bin holds %d entries, want 1 for the whole selection", len(entries))
	}
	if entries[0].ChildCount != 2 {
		t.Errorf("bin entry child_count = %d, want 2 works", entries[0].ChildCount)
	}

	// The unselected book and its quote are still there.
	if n := len(listAnnotations(t, c, third)); n != 1 {
		t.Errorf("the unselected book has %d quotes, want 1", n)
	}

	// And back.
	c.mustDo("POST", "/trash/"+itoa(entries[0].ID)+"/restore", nil, 200)
	for _, id := range books {
		if n := len(listAnnotations(t, c, id)); n != 3 {
			t.Errorf("book %d came back with %d quotes, want 3", id, n)
		}
	}
}

func TestBulkDeletingFilmsTakesTheirLines(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	id := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": id, "quote": "round up the usual suspects"}, http.StatusCreated)

	// "title", not "movie" — the bin's own word for a film or a show, and the
	// server owns it because the server is where the phrase is checked.
	got := decode[bulkDeleteWorkResp](t, c.mustDo("POST", "/movies/bulk/delete",
		map[string]any{"ids": []int64{id}, "confirm": "delete 1 title"}, 200))
	if got.Deleted != 1 {
		t.Fatalf("delete = %+v", got)
	}
	c.mustDo("POST", "/trash/"+itoa(got.TrashID)+"/restore", nil, 200)
	rows := decode[struct {
		Dialogues []dialogueRow `json:"dialogues"`
	}](t, c.mustDo("GET", "/dialogues?movie_id="+itoa(id), nil, 200)).Dialogues
	if len(rows) != 1 {
		t.Errorf("the film came back with %d lines, want 1", len(rows))
	}
}

func TestBulkDeleteRefusesSomebodyElsesBooks(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	aliceBook := createBook(t, alice, "Alice's book")
	// 404, never 403: a 403 would confirm the id exists.
	bob.mustDo("POST", "/books/bulk/delete",
		map[string]any{"ids": []int64{aliceBook}, "confirm": "delete 1 book"}, http.StatusNotFound)
	if len(binOf(t, bob).Trash) != 0 {
		t.Error("a refused delete left something in Bob's bin")
	}
	books := decode[struct {
		Books []struct{ ID int64 } `json:"books"`
	}](t, alice.mustDo("GET", "/books", nil, 200)).Books
	if len(books) != 1 {
		t.Errorf("Alice's library = %d books, want 1", len(books))
	}
}

func TestBulkShelfState(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	var ids []int64
	for _, title := range []string{"one", "two", "three"} {
		ids = append(ids, createBook(t, c, title))
	}

	got := decode[bulkStatusResp](t, c.mustDo("POST", "/books/bulk/status",
		map[string]any{"ids": ids, "status": "reading"}, 200))
	if got.Updated != 3 || got.Skipped != 0 {
		t.Fatalf("status = %+v, want 3 updated", got)
	}
	for _, b := range listBooksBrief(t, c) {
		if b.Status != "reading" {
			t.Errorf("book %d status = %q, want reading", b.ID, b.Status)
		}
	}

	// A move into reading opens a read; finishing closes it. The bulk path goes
	// through the same applyStatusChange, so the log cannot drift from the status.
	c.mustDo("POST", "/books/bulk/status", map[string]any{"ids": ids, "status": "completed"}, 200)
	detail := decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(ids[0]), nil, 200))
	if len(detail.Reads) != 1 || detail.Reads[0].Outcome != ReadFinished {
		t.Errorf("reads = %+v, want one finished read", detail.Reads)
	}
}

func TestBulkShelfStateSkipsACompletedWorkRatherThanRefusingTheBatch(t *testing.T) {
	// The lifecycle's one rule: completed is settled and can only be started
	// again. A selection of three holding one finished book must not cost the
	// other two their move — a bulk action whose success depends on a property of
	// its least convenient member is a bulk action nobody can predict.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	done := createBook(t, c, "already finished")
	a := createBook(t, c, "a")
	b := createBook(t, c, "b")
	c.mustDo("PUT", "/books/"+itoa(done)+"/status", map[string]any{"status": "completed"}, 200)

	got := decode[bulkStatusResp](t, c.mustDo("POST", "/books/bulk/status",
		map[string]any{"ids": []int64{done, a, b}, "status": "paused"}, 200))
	if got.Updated != 2 || got.Skipped != 1 {
		t.Fatalf("status = %+v, want 2 updated and 1 skipped", got)
	}
	byID := map[int64]string{}
	for _, x := range listBooksBrief(t, c) {
		byID[x.ID] = x.Status
	}
	if byID[done] != "completed" {
		t.Errorf("the finished book moved to %q", byID[done])
	}
	if byID[a] != "paused" || byID[b] != "paused" {
		t.Errorf("the other two did not move: %q %q", byID[a], byID[b])
	}
}

func TestBulkShelfStateRefusesAStatusTheKindDoesNotHave(t *testing.T) {
	// A book reads and a film watches. Accepting the other side's word would put a
	// value in the column that no filter chip on either board can match.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := createBook(t, c, "one")
	c.mustDo("POST", "/books/bulk/status",
		map[string]any{"ids": []int64{id}, "status": "watching"}, http.StatusBadRequest)
	movie := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/movies/bulk/status",
		map[string]any{"ids": []int64{movie}, "status": "reading"}, http.StatusBadRequest)
}

// ---- fill the gaps ----------------------------------------------------------

func TestMissingStoredDecidesWhatMayBeFilled(t *testing.T) {
	// The whole endpoint is this one predicate, so it is asserted directly as well
	// as through the API: everything else in metadata_fill.go is reused from
	// re-verify, and this is the only new idea in it.
	filled := []any{nil, "", "   ", 0, int64(0), 0.0, []string{}}
	for _, v := range filled {
		if !missingStored(v) {
			t.Errorf("missingStored(%#v) = false, want true", v)
		}
	}
	kept := []any{"a title", " x ", 1, int64(2), 1.5, []string{"Fiction"}, true, struct{}{}}
	for _, v := range kept {
		if missingStored(v) {
			t.Errorf("missingStored(%#v) = true — it would overwrite something", v)
		}
	}
}

func TestFillNeedsSomethingToFill(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/metadata/fill", map[string]any{}, http.StatusBadRequest)
	many := make([]int64, maxReverifyItems+1)
	c.mustDo("POST", "/metadata/fill", map[string]any{"book_ids": many}, http.StatusBadRequest)
}

func TestFillReportsAnUnpinnedBookRatherThanGuessing(t *testing.T) {
	// A book with no isbn/asin/google id has no identity to re-check, and
	// re-guessing by title is how a fill run quietly rewrites the wrong book's
	// description. Same refusal re-verify makes, reported per item so a selection
	// of fifteen where two are unpinned still fills the other thirteen.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := createBook(t, c, "typed in by hand")

	got := decode[struct {
		Results []fillResult `json:"results"`
		Checked int          `json:"checked"`
		Filled  int          `json:"filled"`
		Fields  int          `json:"fields"`
	}](t, c.mustDo("POST", "/metadata/fill", map[string]any{"book_ids": []int64{id}}, 200))
	if got.Checked != 1 || len(got.Results) != 1 {
		t.Fatalf("fill = %+v", got)
	}
	if got.Results[0].Status != "unpinned" {
		t.Errorf("status = %q, want unpinned", got.Results[0].Status)
	}
	if got.Filled != 0 || got.Fields != 0 {
		t.Errorf("it claimed to fill something: %+v", got)
	}
}

func TestFillOnlyTouchesAnotherAccountsRowsToSayNotFound(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	aliceBook := createBook(t, alice, "Alice's book")

	got := decode[struct {
		Results []fillResult `json:"results"`
	}](t, bob.mustDo("POST", "/metadata/fill", map[string]any{"book_ids": []int64{aliceBook}}, 200))
	if len(got.Results) != 1 || got.Results[0].Status != "not_found" {
		t.Errorf("fill over somebody else's book = %+v, want not_found", got.Results)
	}
}

// listAnnotations / listBooksBrief read back what the boards read, rather than
// counting rows: a bulk action that changed the table and not the response is
// still broken from where the reader stands.
func listAnnotations(t *testing.T, c *testClient, bookID int64) []annotationRow {
	t.Helper()
	return decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
}

func listBooksBrief(t *testing.T, c *testClient) []struct {
	ID     int64  `json:"id"`
	Status string `json:"status"`
} {
	t.Helper()
	return decode[struct {
		Books []struct {
			ID     int64  `json:"id"`
			Status string `json:"status"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200)).Books
}
