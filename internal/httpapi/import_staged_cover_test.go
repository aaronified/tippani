// THE DESTINATION'S ARTWORK REACHES THE QUEUE, BY BOTH ROUTES.
//
// A reader with four Kindle exports of one library wants to narrow the queue to a
// BOOK, not to a file — and a list of titles in a dropdown is the file filter again.
// The poster is what makes it a different control, and `stagedWorkRow` carried no
// path to build one from.
//
// TWO ROUTES, AND THAT IS THE WHOLE REASON THIS FILE EXISTS. A staged group resolves
// its destination one of two ways: `libraryWork` when the reader has PINNED one
// (retarget), and `previewStagedTarget` when the app matched it by title. They are
// different functions with different queries, so a cover added to one leaves exactly
// half of a real queue drawing a blank tile — and which half depends on how each
// group happened to be matched, which is invisible from any single row.
//
// A case covering only the pinned path would pass over that.

package httpapi

import (
	"net/http"
	"testing"
)

// setCover writes artwork straight onto the row. The API has no "set the cover path"
// verb — a cover arrives by upload or by a metadata fetch, neither of which belongs
// in a test about the import queue — so the column is set directly and the queue is
// asked what it reports.
func setCover(t *testing.T, srv *Server, table, col string, id int64, path string) {
	t.Helper()
	if _, err := srv.Store.DB.Exec(`UPDATE `+table+` SET `+col+` = ? WHERE id = ?`, path, id); err != nil {
		t.Fatalf("set %s.%s: %v", table, col, err)
	}
}

func TestTheQueueReportsAPinnedDestinationsArtwork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// A film nobody would match this book to by title, so the only way the group
	// reaches it is the reader's own retarget — which is the pinned path.
	m := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Dune", "release_year": 2021}, http.StatusCreated))
	setCover(t, srv, "movies", "poster_path", m.ID, "dune.jpg")

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ids := stagedIDs(queue(t, c, ""))
	c.mustDo("POST", "/import/staged/bulk", map[string]any{
		"ids": ids, "retarget": map[string]any{"kind": "movie", "id": m.ID},
	}, 200)

	w := queue(t, c, "").Works[0]
	if !w.Pinned {
		t.Fatalf("this case is about the PINNED route and the row is not pinned: %+v", w)
	}
	if w.TargetCover != "dune.jpg" {
		t.Fatalf("pinned destination's artwork missing: %+v", w)
	}
}

func TestTheQueueReportsAMatchedDestinationsArtwork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// SAME TITLE AS THE FIXTURE, so the app matches it by itself and the group is
	// resolved by previewStagedTarget rather than by a pin.
	b := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Sandworm Studies", "author": "Liet Kynes"}, http.StatusCreated))
	setCover(t, srv, "books", "cover_path", b.ID, "sandworm.jpg")

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))

	w := queue(t, c, "").Works[0]
	if w.Pinned {
		t.Fatalf("this case is about the MATCHED route and the row is pinned: %+v", w)
	}
	if w.TargetID != b.ID {
		t.Fatalf("the fixture did not match the book it was meant to: %+v", w)
	}
	if w.TargetCover != "sandworm.jpg" {
		t.Fatalf("matched destination's artwork missing: %+v", w)
	}
}

// A GROUP BOUND FOR A NEW WORK REPORTS NO ARTWORK, and reports it as "" rather than
// failing. That is the same state `target_title` is already in for such a row, so
// the client needs no second branch — which is the point of the empty string over,
// say, omitting the key.
func TestAGroupThatMatchesNothingReportsNoArtwork(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))

	w := queue(t, c, "").Works[0]
	if w.TargetID != 0 {
		t.Fatalf("nothing should have matched: %+v", w)
	}
	if w.TargetCover != "" {
		t.Fatalf("a new work reported artwork it cannot have: %q", w.TargetCover)
	}
}
