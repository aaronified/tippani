package httpapi

import (
	"net/http"
	"testing"
)

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
	c.mustDo("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)

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
	c.mustDo("POST", "/import/staged/approve", map[string]any{"batch_id": first.BatchID}, http.StatusOK)

	// The cast row arrives BETWEEN the two imports, so the first approval had
	// nothing to link to and the second one is the only chance the link gets.
	row := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Woland"}, http.StatusCreated))

	second := stage(t, c, "/import/markdown", "loud.md", []byte(stagedSpokenBookMD))
	ap := decode[approveReply](t, c.mustDo("POST", "/import/staged/approve",
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
