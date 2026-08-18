package httpapi

// The quiz opt-out, and the write path that did not know about it.
//
// 0033's rule is that a work's flag reaches its quotes as a WRITE rather than as
// a term in the deck's query, and the corollary is that every path which creates
// a quote under a work has to seed the child from its parent. `POST /annotations`
// did. The importer did not — so excluding a reference manual and then importing
// into it put the new highlights straight back in the deck, which reads as the
// opt-out being broken rather than as one insert missing a column.
//
// It is the ordinary life of the feature, not a corner: you exclude a book BECAUSE
// you keep adding to it and do not want to be asked, and adding to it means
// importing your clippings again.
//
// These go through the API and count what the reader sees — reviewTotal is the
// same `where()` the deck itself splices — rather than reading the column, because
// a test that asserts the column is a test that passes while the badge and the
// deck disagree.

import (
	"net/http"
	"strings"
	"testing"
)

// stagedBookMDAgain is stagedBookMD with a third quote: the same book, re-imported
// the way a clippings file grows. The first two collide on their dedupe hash and
// are skipped; the third is the new row whose flag is the whole question.
const stagedBookMDAgain = "---\ntitle: Sandworm Studies\nauthor: Liet Kynes\n---\n\n" +
	"## Chapter 1\n\n" +
	"> The spice must flow.\n- loc: p.142\n- tags: politics\n\n" +
	"> Fear is the mind-killer.\n- loc: 610-612\n- color: blue\n\n" +
	"> He who controls the spice controls the universe.\n- loc: 712\n"

const stagedFilmMDAgain = "---\ntitle: The Long Goodbye\ndirector: Robert Altman\nyear: 1973\ntype: movie\n---\n\n" +
	"> Nobody cares but me.\n- character: Philip Marlowe\n- timestamp: 01:02:03\n\n" +
	"> It's okay with me.\n- character: Philip Marlowe\n- timestamp: 00:04:30\n\n" +
	"> I'll never learn.\n- character: Philip Marlowe\n- timestamp: 01:44:00\n"

func approveStaged(t *testing.T, c *testClient, batchID int64) approveReply {
	t.Helper()
	return decode[approveReply](t, c.mustDo("POST", "/import/staged/approve",
		map[string]any{"batch_id": batchID}, http.StatusOK))
}

// bookCount guards the test against passing for the wrong reason: if the second
// import created a SECOND book instead of enriching the first, the new quote
// would be legitimately included and the count would look like the bug.
func bookCount(t *testing.T, c *testClient) int {
	t.Helper()
	return len(decode[struct {
		Books []struct {
			ID int64 `json:"id"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK)).Books)
}

func TestAnImportIntoAnExcludedBookStaysOutOfTheDeck(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	first := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	ap := approveStaged(t, c, first.BatchID)
	if len(ap.BookIDs) != 1 {
		t.Fatalf("the first import made %d books, want 1", len(ap.BookIDs))
	}
	book := ap.BookIDs[0]
	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("before excluding: %d cards in reach, want 2", got)
	}

	// Exclude the WORK, which is what somebody does with a manual they keep
	// quoting. 0033's cascade writes the flag onto both quotes it has today.
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{book}, "review": false}, http.StatusOK)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("after excluding the book: %d, want 0", got)
	}

	// And now the file grows and gets imported again.
	second := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMDAgain))
	ap2 := approveStaged(t, c, second.BatchID)
	if ap2.Added != 1 {
		t.Fatalf("the re-import added %d quotes, want 1 (two should collide on their hash)", ap2.Added)
	}
	if n := bookCount(t, c); n != 1 {
		t.Fatalf("the re-import made a second book (%d total), so this test is not measuring what it thinks", n)
	}
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("a highlight imported into an excluded book is in the deck: %d, want 0", got)
	}
}

func TestAnImportIntoAnExcludedFilmStaysOutOfTheDeck(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	first := stage(t, c, "/import/markdown", "goodbye.md", []byte(stagedFilmMD))
	ap := approveStaged(t, c, first.BatchID)
	if len(ap.MovieIDs) != 1 {
		t.Fatalf("the first import made %d films, want 1", len(ap.MovieIDs))
	}
	film := ap.MovieIDs[0]
	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("before excluding: %d cards in reach, want 2", got)
	}

	c.mustDo("POST", "/movies/bulk", map[string]any{"ids": []int64{film}, "review": false}, http.StatusOK)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("after excluding the film: %d, want 0", got)
	}

	second := stage(t, c, "/import/markdown", "goodbye.md", []byte(stagedFilmMDAgain))
	if ap2 := approveStaged(t, c, second.BatchID); ap2.Added != 1 {
		t.Fatalf("the re-import added %d lines, want 1", ap2.Added)
	}
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("a line imported into an excluded film is in the deck: %d, want 0", got)
	}
}

// TestTheImportedQuoteReportsTheExclusionItInherited — the mark, not just the gate.
//
// The card carries `review_excluded` so the menu can offer "Add to quiz" instead
// of "Skip in quiz". A row that is correctly kept out of the deck but reports
// itself as included gives the reader a control whose label is wrong, and 0033's
// own history is that the two disagreeing is worse than either being wrong.
func TestTheImportedQuoteReportsTheExclusionItInherited(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	first := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	book := approveStaged(t, c, first.BatchID).BookIDs[0]
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{book}, "review": false}, http.StatusOK)

	second := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMDAgain))
	approveStaged(t, c, second.BatchID)

	anns := decode[annList](t, c.mustDo("GET", "/annotations?book_id="+itoa(book), nil, http.StatusOK)).Annotations
	if len(anns) != 3 {
		t.Fatalf("%d highlights after the re-import, want 3", len(anns))
	}
	for _, a := range anns {
		if !a.ReviewExcluded {
			t.Errorf("highlight %q reports itself as in the quiz, in a book that is not", trunc(a.Quote))
		}
	}
}

// TestMergingIntoAnExcludedBookCarriesTheOptOut — the other path that puts a quote
// under a work. Two editions of the same manual, one of them the one you excluded.
func TestMergingIntoAnExcludedBookCarriesTheOptOut(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	keep := createBook(t, c, "The Chicago Manual of Style")
	dupe := createBook(t, c, "Chicago Manual of Style, 17th ed.")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": keep, "quote": "see 6.19"}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": dupe, "quote": "see 7.84"}, http.StatusCreated)

	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{keep}, "review": false}, http.StatusOK)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("after excluding one of the two: %d, want 1 (the duplicate's own quote)", got)
	}

	c.mustDo("POST", "/books/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("a quote merged into an excluded book is in the deck: %d, want 0", got)
	}
}

// And the half that must NOT happen: a merge is not a moment to erase a per-quote
// answer. Excluding travels into an excluded target; including does not travel out
// of an included one.
func TestMergingIntoAnIncludedBookLeavesEachQuotesOwnAnswerAlone(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	keep := createBook(t, c, "Ficciones")
	dupe := createBook(t, c, "Ficciones (Grove)")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": keep, "quote": "the garden of forking paths"}, http.StatusCreated)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": dupe, "quote": "a labyrinth of symbols"}, http.StatusCreated)

	// The duplicate's book is excluded, so its quote is too.
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{dupe}, "review": false}, http.StatusOK)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("before the merge: %d, want 1", got)
	}

	c.mustDo("POST", "/books/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("the merge changed a quote's own opt-out: %d in reach, want 1 — "+
			"an excluded quote arriving in an included book stays excluded", got)
	}
}

func TestMergingIntoAnExcludedFilmCarriesTheOptOut(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	keep := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "The Long Goodbye"}, 201).Body.Bytes())
	dupe := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Long Goodbye, The"}, 201).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": keep, "quote": "Nobody cares but me."}, http.StatusCreated)
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": dupe, "quote": "It's okay with me."}, http.StatusCreated)

	c.mustDo("POST", "/movies/bulk", map[string]any{"ids": []int64{keep}, "review": false}, http.StatusOK)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("after excluding one of the two: %d, want 1", got)
	}

	c.mustDo("POST", "/movies/merge", map[string]any{"into": keep, "from": []int64{dupe}}, http.StatusOK)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("a line merged into an excluded film is in the deck: %d, want 0", got)
	}
}

func trunc(s string) string {
	if len(s) <= 40 {
		return s
	}
	return strings.TrimSpace(s[:40]) + "…"
}
