package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// Not this one. A quote you keep, and never want to be asked about.
//
// The rule is one string — reviewSource.where() — and that is exactly why it is
// worth testing from the outside. FIVE queries splice that string: the three
// candidate fetches, the count behind the "cards left" badge, and the status
// breakdown behind "where you stand". A filter that reached four of them would
// produce a badge counting a card the deck will never serve, which reads as the
// quiz being broken rather than as a filter being inconsistent — so every
// assertion here goes through the API and checks the COUNT the reader sees, not
// the column.
//
// The other half is the work-level flag, and it exists because "this book is not
// for quizzing" is a fact about the book: exclude a reference manual and the
// highlight added to it tomorrow has to be excluded too, or the exclusion is a
// chore you have to repeat.

// reviewTotal is how many quotes the app believes are in the deck's reach. It
// comes from reviewStates, which is the same `where()` the deck itself uses.
func reviewTotal(t *testing.T, c *testClient) int {
	t.Helper()
	return decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200)).States.Total
}

func TestExcludingQuotesFromReview(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Dispossessed")
	var ann []int64
	for _, q := range []string{"the wall was inside", "a shipment of ideas", "you cannot buy the revolution"} {
		ann = append(ann, idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": bookID, "quote": q}, http.StatusCreated).Body.Bytes()))
	}
	if got := reviewTotal(t, c); got != 3 {
		t.Fatalf("before: %d quotes in reach, want 3", got)
	}

	// Exclude one.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ann[:1], "review": false}, 200)
	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("after excluding one: %d in reach, want 2", got)
	}

	// The row says so, which is what lets the bar offer the right word rather
	// than always offering "Exclude" over a selection that already is.
	rows := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	for _, a := range rows {
		want := a.ID == ann[0]
		if a.ReviewExcluded != want {
			t.Errorf("annotation %d: review_excluded = %v, want %v", a.ID, a.ReviewExcluded, want)
		}
	}

	// And back in again. An exclusion that cannot be undone is a delete with
	// extra steps.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ann[:1], "review": true}, 200)
	if got := reviewTotal(t, c); got != 3 {
		t.Fatalf("after including it again: %d in reach, want 3", got)
	}
}

func TestExcludingAWorkCoversTheQuotesAddedAfterwards(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Chicago Manual of Style")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": "see 6.19"}, http.StatusCreated)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("before: %d, want 1", got)
	}

	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": false}, 200)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("after excluding the book: %d, want 0", got)
	}

	// The whole point of the work-level flag: this one was saved AFTER the
	// exclusion, and nobody is going to remember to exclude it too.
	c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": "see 6.20"}, http.StatusCreated)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("a highlight added to an excluded book is in the deck: %d, want 0", got)
	}

	// And the book row reports it.
	books := decode[struct {
		Books []struct {
			ID             int64 `json:"id"`
			ReviewExcluded bool  `json:"review_excluded"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200)).Books
	if len(books) != 1 || !books[0].ReviewExcluded {
		t.Errorf("books = %+v, want one excluded", books)
	}

	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": true}, 200)
	if got := reviewTotal(t, c); got != 2 {
		t.Fatalf("after including the book: %d, want 2", got)
	}
}

func TestExcludedQuotesLeaveTheDailyDeckItself(t *testing.T) {
	// The count and the deck are two different queries over one `where()`. This
	// is the one that would catch a rule added to reviewStates and forgotten in
	// the candidate fetches — a "where you stand" that says nothing is left while
	// the quiz keeps asking.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "Ficciones")
	for _, q := range []string{"the garden of forking paths", "a labyrinth of symbols",
		"time forks perpetually", "the book of sand", "mirrors and fatherhood"} {
		c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": q}, http.StatusCreated)
	}
	ann := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	ids := make([]int64, 0, len(ann))
	for _, a := range ann {
		ids = append(ids, a.ID)
	}

	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ids, "review": false}, 200)

	// Practice draws the WHOLE in-scope pool with no due or age gate, so an empty
	// one here is the deck agreeing with the count.
	pool := decode[practiceDeckResp](t, c.mustDo("GET", "/review/practice", nil, 200))
	if len(pool.Items) != 0 {
		t.Errorf("practice served %d cards from a wholly excluded library", len(pool.Items))
	}
	daily := decode[reviewDeckResp](t, c.mustDo("GET", "/review/daily", nil, 200))
	if len(daily.Items) != 0 {
		t.Errorf("the daily deck served %d cards from a wholly excluded library", len(daily.Items))
	}
}

func TestReviewExclusionIsPerAccount(t *testing.T) {
	// The ownership filter, in both directions. One that matches nothing is a
	// bulk action reporting success and doing nothing; one that matches
	// everything is somebody else's library.
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	aBook := createBook(t, alice, "Alice's book")
	aAnn := idOf(t, alice.mustDo("POST", "/annotations",
		map[string]any{"book_id": aBook, "quote": "alice's highlight"}, http.StatusCreated).Body.Bytes())

	// Bob cannot exclude Alice's highlight, and gets the same 404 a missing id
	// gets — never a 403, which would confirm the id exists.
	bob.mustDo("POST", "/annotations/bulk",
		map[string]any{"ids": []int64{aAnn}, "review": false}, http.StatusNotFound)
	if got := reviewTotal(t, alice); got != 1 {
		t.Fatalf("Alice's deck changed from Bob's call: %d, want 1", got)
	}
	// And Alice can.
	alice.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{aAnn}, "review": false}, 200)
	if got := reviewTotal(t, alice); got != 0 {
		t.Fatalf("Alice could not exclude her own highlight: %d, want 0", got)
	}
}

// ---- what the row says about itself (1.14.2) --------------------------------
//
// The deck has excluded a child of an excluded work since 0033, and until now
// the row said nothing about it. That gap is invisible from the server's side —
// every count above is already right — and it is the whole feature from the
// reader's: exclude a reference manual and its forty highlights carry no mark,
// so the app shows forty cards it has quietly stopped asking about and gives no
// way to tell them from the thirty-nine thousand it has not.
//
// Asserted as a PAIR of values rather than as "excluded", because the two flags
// mean different things to the control that undoes them: the child's own column
// is what /annotations/bulk writes, and the parent's is not.

func TestAChildRowReportsItsWorksExclusion(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Chicago Manual of Style")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": bookID, "quote": "see 6.19"}, http.StatusCreated)
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": false}, 200)

	rows := decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	if len(rows) != 1 {
		t.Fatalf("expected one highlight, got %d", len(rows))
	}
	// Its own column IS set now, and that is the correction. The deck reads this
	// flag and no other, so skipping the book has to reach the highlight rather
	// than being ANDed in at query time — otherwise the control that clears this
	// column reports "back in the quiz" about a card the deck still refuses.
	if !rows[0].ReviewExcluded {
		t.Errorf("excluding the book left the highlight's own flag clear; the deck reads that flag")
	}
	if !rows[0].WorkReviewExcluded {
		t.Errorf("work_review_excluded = false on a highlight of a skipped book")
	}

	// The one job the work's column still has: saved AFTER the exclusion, and it
	// inherits. The create response is the same shape the list returns.
	made := decode[annotationRow](t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "see 6.20"}, http.StatusCreated))
	if !made.ReviewExcluded || !made.WorkReviewExcluded {
		t.Errorf("a highlight added to a skipped book: own=%v book=%v, want true/true",
			made.ReviewExcluded, made.WorkReviewExcluded)
	}

	// And back: putting the book in clears the flag on every child at once. This
	// is the same control run the other way, which is what makes the decision
	// undoable — 0033's version could not be undone from the card at all.
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": true}, 200)
	rows = decode[struct {
		Annotations []annotationRow `json:"annotations"`
	}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	if len(rows) != 2 {
		t.Fatalf("expected two highlights, got %d", len(rows))
	}
	for _, a := range rows {
		if a.ReviewExcluded || a.WorkReviewExcluded {
			t.Errorf("annotation %d still excluded after the book went back in: own=%v book=%v",
				a.ID, a.ReviewExcluded, a.WorkReviewExcluded)
		}
	}
}

// THE REPORT THIS CHANGE CAME FROM. A highlight excluded on its own account and
// by its book: the bar reads the own flag, offers "Add to quiz", clears it — and
// under 0033 the deck went on refusing the card because the book's flag was
// still ANDed in. The toast said "back in the quiz" about a card that was not.
func TestClearingAQuotesOwnFlagPutsItBackInTheDeck(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Chicago Manual of Style")
	annID := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "see 6.19"}, http.StatusCreated).Body.Bytes())
	ageSeededItems(t, srv)

	// Excluded both ways round: the book's control, then the quote's own.
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{bookID}, "review": false}, 200)
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{annID}, "review": false}, 200)
	if got := reviewTotal(t, c); got != 0 {
		t.Fatalf("an excluded highlight is still in the deck: %d", got)
	}

	// The one control the card and the bar both offer. Afterwards the deck must
	// actually serve it, because that is what the toast says happened.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": []int64{annID}, "review": true}, 200)
	if got := reviewTotal(t, c); got != 1 {
		t.Fatalf("Add to quiz said the highlight was back and the deck still will not serve it: %d, want 1", got)
	}
}

func TestSearchCarriesTheQuizMark(t *testing.T) {
	// One query reaching every kind at once, for the reason the colour test
	// gives: the failure mode is one shape disagreeing with the other four, and
	// a test per kind goes on passing through exactly that.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Revolution in the Margins",
	}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "You cannot buy the revolution.",
	}, http.StatusCreated)
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "The Revolution Will Not Be Televised",
	}, http.StatusCreated))
	dlg := idOf(t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "the revolution is not a dinner party", "character": "Narrator",
	}, http.StatusCreated).Body.Bytes())
	utt := newUtterance(t, c, map[string]any{
		"quote": "A revolution is not a bed of roses.", "speaker": "Fidel Castro",
	}).ID

	// The book goes out as a WORK; the dialogue and the standalone quote go out
	// on their own account. Between them every field added to the five hit
	// shapes is exercised with a true value, which is what stops a scan reading
	// the wrong column from passing on all-false rows.
	c.mustDo("POST", "/books/bulk", map[string]any{"ids": []int64{book.ID}, "review": false}, 200)
	c.mustDo("POST", "/dialogues/bulk", map[string]any{"ids": []int64{dlg}, "review": false}, 200)
	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": []int64{utt}, "review": false}, 200)

	res := decode[searchResults](t, c.mustDo("GET", "/search?q=revolution", nil, http.StatusOK))

	if len(res.Books) != 1 {
		t.Fatalf("expected one book hit, got %d", len(res.Books))
	}
	if !res.Books[0].ReviewExcluded {
		t.Errorf("book hit: review_excluded = false on an excluded book")
	}
	if len(res.Annotations) != 1 {
		t.Fatalf("expected one annotation hit, got %d", len(res.Annotations))
	}
	// The inherited half, in search. Excluding the book writes the flag onto its
	// highlights now — the deck reads the highlight's own column and nothing
	// else — so the hit carries both, and the mark it draws is about a card the
	// quiz genuinely will not serve.
	if !res.Annotations[0].ReviewExcluded {
		t.Errorf("annotation hit: own flag clear after its book was excluded")
	}
	if !res.Annotations[0].WorkReviewExcluded {
		t.Errorf("annotation hit: work_review_excluded = false, so a result of a skipped book wears no mark")
	}
	if len(res.Movies) != 1 {
		t.Fatalf("expected one movie hit, got %d", len(res.Movies))
	}
	// Not excluded — only its line was — so this one pins the negative and
	// proves the column being read is the film's own and not the line's.
	if res.Movies[0].ReviewExcluded {
		t.Errorf("movie hit: review_excluded = true on a film nobody excluded")
	}
	if len(res.Dialogues) != 1 {
		t.Fatalf("expected one dialogue hit, got %d", len(res.Dialogues))
	}
	if !res.Dialogues[0].ReviewExcluded {
		t.Errorf("dialogue hit: review_excluded = false on an excluded line")
	}
	if res.Dialogues[0].WorkReviewExcluded {
		t.Errorf("dialogue hit: work_review_excluded = true on a film nobody excluded")
	}
	if len(res.Quotes) != 1 {
		t.Fatalf("expected one standalone quote hit, got %d", len(res.Quotes))
	}
	if !res.Quotes[0].ReviewExcluded {
		t.Errorf("quote hit: review_excluded = false on an excluded quote")
	}
}

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
	return decode[approveReply](t, c.mustFollow("POST", "/import/staged/approve",
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

func trunc(s string) string {
	if len(s) <= 40 {
		return s
	}
	return strings.TrimSpace(s[:40]) + "…"
}
