package httpapi

import (
	"net/http"
	"testing"
)

// A BOOK'S TWO SUPPLIER IDS, on the owner's instruction: "ol id: add them back".
//
// THE STATE THIS REPLACES. `google_id` and `openlibrary_id` have existed since
// 0001 and were written by exactly one path — adopting a looked-up candidate,
// which sets whichever one matches `source`. No response carried either of them
// and no request could set one, so the Ids strip could not draw an OL pill for a
// book that had an id, and a reader who had the key in their hand had nowhere to
// type it. The gap was recorded as an audit rather than a bug because making the
// columns full-state would have let every other client of PUT /books/:id clear
// them by omission.
//
// WHAT IS PINNED. That the GET returns both; that a PUT can set and clear each;
// that OMITTING them leaves them alone — the pointer contract that makes the
// change safe, and the one assertion that fails if somebody later folds these two
// columns into the main SET; and that adopting a candidate still wins over a
// stale id carried in the same body, which is the order the merge screen needs.

type bookIDs struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	GoogleID      string `json:"google_id"`
	OpenLibraryID string `json:"openlibrary_id"`
}

func TestABooksSupplierIDsAreServedAndSettable(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookIDs](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
	}, http.StatusCreated))

	// A READER TYPES THE KEY IN. Both at once, because the strip's editor saves
	// the whole strip.
	saved := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "The Master and Margarita", "author": "Mikhail Bulgakov",
		"openlibrary_id": "/works/OL82563W", "google_id": "ftPPDwAAQBAJ",
	}, http.StatusOK))
	if saved.OpenLibraryID != "/works/OL82563W" || saved.GoogleID != "ftPPDwAAQBAJ" {
		t.Fatalf("the PUT stored neither id: %+v", saved)
	}
	// And the GET returns them, which is the half the strip reads.
	got := decode[bookIDs](t, c.mustDo("GET", "/books/"+itoa(made.ID), nil, http.StatusOK))
	if got.OpenLibraryID != "/works/OL82563W" || got.GoogleID != "ftPPDwAAQBAJ" {
		t.Fatalf("the GET does not carry them: %+v", got)
	}
}

func TestOmittingASupplierIDLeavesItAlone(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookIDs](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dead Souls", "openlibrary_id": "/works/OL1W", "google_id": "vol1",
	}, http.StatusCreated))

	// THE POINTER CONTRACT, and the reason these two columns are not in the main
	// SET. A body that says nothing about an id must leave it standing: every
	// other writer of this record — the bulk editor, an import approval, the
	// metadata console — names its own columns and has never heard of these, and a
	// supplier id is not a field a reader retypes each save. It is what a re-sync
	// pulls from.
	after := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "Dead Souls", "author": "Nikolai Gogol",
	}, http.StatusOK))
	if after.OpenLibraryID != "/works/OL1W" || after.GoogleID != "vol1" {
		t.Fatalf("a PUT that named neither id wiped one: %+v", after)
	}

	// A PRESENT EMPTY STRING IS THE CLEAR, which is how the strip's editor empties
	// a field — the same distinction `movieReq`'s supplier ids draw.
	cleared := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "Dead Souls", "author": "Nikolai Gogol", "openlibrary_id": "",
	}, http.StatusOK))
	if cleared.OpenLibraryID != "" {
		t.Fatalf("an explicit empty string did not clear the OL id: %+v", cleared)
	}
	if cleared.GoogleID != "vol1" {
		t.Fatalf("clearing one id cleared the other: %+v", cleared)
	}
}

func TestAdoptingACandidateBeatsAStaleIDInTheSameBody(t *testing.T) {
	c := signupAdmin(t, newTestServer(t).Handler())
	made := decode[bookIDs](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Dead Souls", "openlibrary_id": "/works/OLstaleW",
	}, http.StatusCreated))

	// The merge screen assembles its body from the record AND the candidate, so
	// the stale id rides along with the adoption. `source`/`source_id` name what
	// the reader actually picked, so they are applied last.
	after := decode[bookIDs](t, c.mustDo("PUT", "/books/"+itoa(made.ID), map[string]any{
		"title": "Dead Souls", "openlibrary_id": "/works/OLstaleW",
		"source": "openlibrary", "source_id": "/works/OLfreshW",
	}, http.StatusOK))
	if after.OpenLibraryID != "/works/OLfreshW" {
		t.Fatalf("the adopted candidate lost to the stale id in the same body: %+v", after)
	}
}
