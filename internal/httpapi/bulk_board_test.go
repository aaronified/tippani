package httpapi

import (
	"net/http"
	"testing"
)

// Moving quotes between boards in bulk.
//
// Until now the only way to change which board a quote was on was to open its
// edit form and change one select in it — a full-state PUT, for a move — so
// re-filing a dozen quotes was a dozen forms. `board_id` on POST /quotes/bulk is
// that move, and the card's own ⋯ posts to it with a single id.
//
// The two refusals below are the whole risk. A bulk write that reports success
// and moves nothing is indistinguishable from one that worked, and a board id is
// the one field here that can point at somebody else's row.

func TestBulkMoveQuotesToBoard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	board := idOf(t, c.mustDo("POST", "/boards", map[string]any{"name": "Speeches"}, http.StatusCreated).Body.Bytes())
	a := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "the first line", "speaker": "A"}, http.StatusCreated).Body.Bytes())
	b := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "the second line", "speaker": "B"}, http.StatusCreated).Body.Bytes())

	got := decode[bulkResp](t, c.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": []int64{a, b}, "board_id": board,
	}, http.StatusOK))
	if got.Updated != 2 {
		t.Fatalf("updated = %d, want 2", got.Updated)
	}

	rows := decode[struct {
		Quotes []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK)).Quotes
	if len(rows) != 2 {
		t.Fatalf("quotes: %+v", rows)
	}
	for _, q := range rows {
		if q.BoardID != board {
			t.Errorf("quote %d is on board %d, want %d", q.ID, q.BoardID, board)
		}
	}
}

// A board id belonging to somebody else is refused outright rather than swapped
// for the default. Filing forty quotes somewhere other than where the request
// said is worse than refusing it, because nothing on screen would say so — the
// same rule resolveBoard states for a single quote.
func TestBulkMoveRefusesAnotherReadersBoard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	other := addUser(t, h, owner, "stranger")

	theirs := idOf(t, other.mustDo("POST", "/boards", map[string]any{"name": "Theirs"}, http.StatusCreated).Body.Bytes())
	mine := idOf(t, owner.mustDo("POST", "/quotes", map[string]any{"quote": "a line", "speaker": "A"}, http.StatusCreated).Body.Bytes())

	owner.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": []int64{mine}, "board_id": theirs,
	}, http.StatusNotFound)

	// And the quote did not move on the way to being refused.
	rows := decode[struct {
		Quotes []utteranceRow `json:"utterances"`
	}](t, owner.mustDo("GET", "/quotes", nil, http.StatusOK)).Quotes
	if len(rows) != 1 || rows[0].BoardID == theirs {
		t.Fatalf("quote landed on another reader's board: %+v", rows)
	}
}

// Highlights and film lines have no board — they belong to their book and their
// film. Accepting the field and ignoring it would make "move these to Speeches"
// report success over a selection of highlights.
func TestBulkMoveRefusedForQuotesThatHaveNoBoard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	board := idOf(t, c.mustDo("POST", "/boards", map[string]any{"name": "Speeches"}, http.StatusCreated).Body.Bytes())
	book := idOf(t, c.mustDo("POST", "/books", map[string]any{"title": "Persuasion"}, http.StatusCreated).Body.Bytes())
	ann := idOf(t, c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "a highlight"}, http.StatusCreated).Body.Bytes())

	c.mustDo("POST", "/annotations/bulk", map[string]any{
		"ids": []int64{ann}, "board_id": board,
	}, http.StatusBadRequest)
}
