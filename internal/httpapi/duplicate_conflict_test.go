package httpapi

import (
	"net/http"
	"testing"
)

// A 409 on create used to be a bare {"error": "duplicate annotation"}. That is
// enough for a browser, where the user can see what happened, but it strands an
// offline client: the phone POSTs a queued capture, the connection drops before
// the response arrives, it retries, and gets a 409 it cannot interpret. Was that
// its own earlier POST landing, or a genuine clash with something else? Dropping
// the capture and reporting a permanent failure are both wrong.
//
// Returning the existing row makes the retry idempotent from the client's side:
// same body it would have got on the first success, so the outbox item is simply
// marked done.

// existingOf reads the annotation/dialogue a 409 now carries.
type conflictBody struct {
	Error    string `json:"error"`
	Existing struct {
		ID    int64  `json:"id"`
		Quote string `json:"quote"`
		Note  string `json:"note"`
	} `json:"existing"`
}

func TestDuplicateAnnotationReturnsExisting(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")

	quote := "Cities, like dreams, are made of desires and fears."
	note := "Calvino's cities are all Venice, seen from different angles."

	// The rows share one book: a quote and a note hash differently, so neither
	// row's create can collide with the other's, and each row's assertions look
	// only at the row it just wrote.
	cases := []struct {
		name    string
		payload map[string]any
		// An empty want means "this row does not assert that field", so the
		// merge adds no assertion the separate tests did not already make.
		wantQuote string
		wantNote  string
	}{
		{
			name:      "a duplicate quote",
			payload:   map[string]any{"book_id": bookID, "quote": quote},
			wantQuote: quote,
		},
		// Note-only annotations dedupe on the note (annotationReq.hash), so the 409 has
		// to find the existing row by that hash too, not by an empty quote.
		{
			name:     "a duplicate note-only annotation",
			payload:  map[string]any{"book_id": bookID, "note": note},
			wantNote: note,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			first := decode[annotationRow](t, c.mustDo("POST", "/annotations", tc.payload, http.StatusCreated))

			rec := c.mustDo("POST", "/annotations", tc.payload, http.StatusConflict)
			got := decode[conflictBody](t, rec)

			if got.Error == "" {
				t.Fatal("409 should still carry a human-readable error")
			}
			if got.Existing.ID != first.ID {
				t.Fatalf("409 existing.id = %d, want the original %d", got.Existing.ID, first.ID)
			}
			if tc.wantQuote != "" && got.Existing.Quote != tc.wantQuote {
				t.Fatalf("409 existing.quote = %q, want %q", got.Existing.Quote, tc.wantQuote)
			}
			if tc.wantNote != "" && got.Existing.Note != tc.wantNote {
				t.Fatalf("409 existing.note = %q, want %q", got.Existing.Note, tc.wantNote)
			}
		})
	}
}

func TestDuplicateDialogueReturnsExisting(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	movieID := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker"}, http.StatusCreated)).ID

	quote := "Let everything that has been planned come true."
	first := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": quote,
	}, http.StatusCreated))

	got := decode[conflictBody](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": quote,
	}, http.StatusConflict))

	if got.Existing.ID != first.ID {
		t.Fatalf("409 existing.id = %d, want the original %d", got.Existing.ID, first.ID)
	}
	if got.Existing.Quote != quote {
		t.Fatalf("409 existing.quote = %q, want %q", got.Existing.Quote, quote)
	}
}

// The uniqueness constraint is per-book, so the same passage quoted from two
// different books is two annotations. A client that treated any 409 as "already
// saved" would be wrong here — hence pinning that this is *not* a conflict.
func TestSameQuoteInDifferentBookIsNotDuplicate(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	first := newTestBook(t, c, "Invisible Cities")
	second := newTestBook(t, c, "If on a Winter's Night a Traveller")

	quote := "The traveller finds again a past of his."
	c.mustDo("POST", "/annotations", map[string]any{"book_id": first, "quote": quote}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": second, "quote": quote}, http.StatusCreated)
}

// The scenario the whole change exists for, end to end over a device token:
// re-POSTing a queued capture yields the same row, so a flush is idempotent and
// nothing is written twice.
func TestOutboxRetryIsIdempotent(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	web := signupAdmin(t, h)
	bookID := newTestBook(t, web, "Invisible Cities")
	phone := pairDevice(t, srv, h, "alice")

	capture := map[string]any{
		"book_id": bookID,
		"quote":   "Memory's images, once they are fixed in words, are erased.",
	}

	first := decode[annotationRow](t, phone.mustDo("POST", "/annotations", capture, http.StatusCreated))
	for i := 0; i < 3; i++ {
		got := decode[conflictBody](t, phone.mustDo("POST", "/annotations", capture, http.StatusConflict))
		if got.Existing.ID != first.ID {
			t.Fatalf("retry %d resolved to id %d, want %d", i, got.Existing.ID, first.ID)
		}
	}

	list := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, phone.mustDo("GET", "/annotations", nil, http.StatusOK))
	if len(list.Annotations) != 1 {
		t.Fatalf("retries created %d annotations, want 1", len(list.Annotations))
	}
}
