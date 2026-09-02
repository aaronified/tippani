package httpapi

import (
	"net/http"
	"testing"
)

// A quote's speaker and a cast row are one thing, end to end.
//
// THE STATE THIS REPLACES. `speaker_cast_id` has been on `annotations` and
// `dialogues` since characters got their own records — the two quote tables that
// hang off a work, which is what a cast row belongs to; a standalone quote has no
// work and no cast to point into — and nothing has ever written one — the
// column was NULL on every row of every library. Everything that needed to know
// which cast row a line's speaker was re-derived it by FOLDING the character text
// and matching `work_cast.character_key`: the picture on a chip, the adoption that
// puts a quoted character onto a work's cast, the guard that refuses to take a
// character off a work while its quotes name them. Three folds, three chances to
// write the join differently — and none of them could answer the question in
// reverse, because a LIKE over a text column is not an answer to "which quotes
// are this role's".
//
// So what is pinned here is that the link is WRITTEN, that it follows the three
// rules the person link already follows, and that a library which predates it
// gets caught up on the read that was already reconciling the two tables.

func speakerCast(t *testing.T, srv *Server, table string, id int64) int64 {
	t.Helper()
	var v *int64
	if err := srv.Store.DB.QueryRow(
		`SELECT speaker_cast_id FROM `+table+` WHERE id = ?`, id).Scan(&v); err != nil {
		t.Fatal(err)
	}
	if v == nil {
		return 0
	}
	return *v
}

func TestAHighlightsSpeakerBecomesItsCastRow(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	castID := charDetail(t, c, charID).Appearances[0].CastID

	line := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Manuscripts don't burn", "character": "Woland",
	}, http.StatusCreated))
	if got := speakerCast(t, srv, "annotations", line.ID); got != castID {
		t.Fatalf("the highlight points at cast row %d, want %d", got, castID)
	}
}

func TestTheLinkFollowsTheNameAndClearsWhenNobodySaidIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	c.mustDo("POST", "/books/"+itoa(bookID)+"/cast", map[string]any{"character": "Behemoth"}, http.StatusCreated)
	_ = charID
	byName := map[string]int64{}
	all := decode[struct {
		Cast []castOut `json:"cast"`
	}](t, c.mustDo("GET", "/books/"+itoa(bookID)+"/cast", nil, http.StatusOK))
	for _, row := range all.Cast {
		byName[row.Character] = row.ID
	}

	line := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "A cat the size of a hog", "character": "Woland",
	}, http.StatusCreated))
	if got := speakerCast(t, srv, "annotations", line.ID); got != byName["Woland"] {
		t.Fatalf("first save linked %d, want %d", got, byName["Woland"])
	}

	// THE READER CHANGED WHO SAID IT, so the link moves with the name. This is the
	// case the whole column exists for: the string and the id have to agree, and
	// the string is what the reader edits.
	c.mustDo("PUT", "/annotations/"+itoa(line.ID), map[string]any{
		"quote": "A cat the size of a hog", "character": "Behemoth",
	}, http.StatusOK)
	if got := speakerCast(t, srv, "annotations", line.ID); got != byName["Behemoth"] {
		t.Fatalf("after the rename the link is %d, want %d", got, byName["Behemoth"])
	}

	// AN EMPTY NAME CLEARS IT. "Nobody said this" is a real answer — narration, an
	// epigraph, a line not attributed yet — and a stale id would make a cast row
	// claim a line that no longer names it.
	c.mustDo("PUT", "/annotations/"+itoa(line.ID), map[string]any{
		"quote": "A cat the size of a hog",
	}, http.StatusOK)
	if got := speakerCast(t, srv, "annotations", line.ID); got != 0 {
		t.Fatalf("clearing the speaker left the link at %d", got)
	}
}

func TestALineNamingTwoCharactersLinksToNeither(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	_, bookID := oneWoland(t, c)
	c.mustDo("POST", "/books/"+itoa(bookID)+"/cast", map[string]any{"character": "Behemoth"}, http.StatusCreated)

	// There is no honest single answer: taking the first would file a two-hander
	// under one of them and hide it from the other. The person link makes exactly
	// the same call on the same shape of line, and its own comment says so.
	line := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "The two of them", "character": "Woland, Behemoth",
	}, http.StatusCreated))
	if got := speakerCast(t, srv, "annotations", line.ID); got != 0 {
		t.Fatalf("a two-speaker line linked to cast row %d", got)
	}
	// The name is still printed, still searched, and still what the picture lookup
	// folds — nothing about the text changed.
	if got := lineOf(t, c, bookID, line.ID).Character; got != "Woland, Behemoth" {
		t.Fatalf("the printed characters changed to %q", got)
	}
}

func TestAQuoteNamingSomebodyNotOnTheCastLinksWhenTheListIsRead(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	bookID := createTestBook(t, c, "The Master and Margarita", "Mikhail Bulgakov")

	// NOTHING ON THE LIST ANSWERS TO THIS NAME YET, and that is not an error and
	// not a reason to create a row here: adoption is the only thing that writes
	// one, deliberately, because a second creator would be a second set of rules
	// about origin, billing and tombstones.
	line := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Never talk to strangers", "character": "Woland",
	}, http.StatusCreated))
	if got := speakerCast(t, srv, "annotations", line.ID); got != 0 {
		t.Fatalf("linked to %d before any cast row existed", got)
	}

	// Reading the work's cast adopts the character AND catches the quote up. This
	// is the whole reason a library that has been in use for a year gets the link
	// without a migration: the reconciliation already happened here.
	cast := decode[struct {
		Cast []castOut `json:"cast"`
	}](t, c.mustDo("GET", "/books/"+itoa(bookID)+"/cast", nil, http.StatusOK))
	if len(cast.Cast) != 1 {
		t.Fatalf("adoption produced %d rows: %+v", len(cast.Cast), cast.Cast)
	}
	if got := speakerCast(t, srv, "annotations", line.ID); got != cast.Cast[0].ID {
		t.Fatalf("after the list read the link is %d, want %d", got, cast.Cast[0].ID)
	}
}

func TestTheWholeHistoryIsCaughtUpOnOneListRead(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	castID := charDetail(t, c, charID).Appearances[0].CastID

	// A LIBRARY THAT PREDATES THE COLUMN, simulated exactly: rows whose speaker is
	// printed and whose link is NULL, which is every quote in every install until
	// now. The save path cannot reach them — nothing will edit them again — so if
	// the read did not do this the feature would be for new quotes only.
	var ids []int64
	for _, q := range []string{"one", "two", "three"} {
		l := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
			"book_id": bookID, "quote": q, "character": "Woland",
		}, http.StatusCreated))
		ids = append(ids, l.ID)
	}
	if _, err := srv.Store.DB.Exec(`UPDATE annotations SET speaker_cast_id = NULL`); err != nil {
		t.Fatal(err)
	}

	c.mustDo("GET", "/books/"+itoa(bookID)+"/cast", nil, http.StatusOK)
	for _, id := range ids {
		if got := speakerCast(t, srv, "annotations", id); got != castID {
			t.Fatalf("quote %d is linked to %d after the read, want %d", id, got, castID)
		}
	}
}

func TestRemovingACharacterFromAWorkTakesTheLinkWithIt(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	castID := charDetail(t, c, charID).Appearances[0].CastID
	line := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Manuscripts don't burn", "character": "Woland",
	}, http.StatusCreated))
	if speakerCast(t, srv, "annotations", line.ID) != castID {
		t.Fatal("seed did not link")
	}

	// The removal rewrites the quotes first — that is what makes it a removal
	// rather than something adoption undoes — and the link has to follow the name
	// it was rewritten to. A tombstoned row is not on the list, so a link left
	// pointing at one would be a quote whose speaker is a deletion.
	c.mustDo("DELETE", "/characters/"+itoa(charID)+"/works/"+itoa(castID)+"?quotes=clear", nil, http.StatusOK)
	c.mustDo("GET", "/books/"+itoa(bookID)+"/cast", nil, http.StatusOK)
	if got := speakerCast(t, srv, "annotations", line.ID); got != 0 {
		t.Fatalf("the quote still points at cast row %d after its character was removed", got)
	}
}

func TestAFilmLineLinksToItsCastRowToo(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "The Master and Margarita"}, http.StatusCreated).Body.Bytes())
	row := decode[castOut](t, c.mustDo("POST", "/movies/"+itoa(movieID)+"/cast",
		map[string]any{"character": "Woland", "actor": "Oleg Basilashvili"}, http.StatusCreated))

	line := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movieID, "quote": "Manuscripts don't burn",
		"character": "Woland", "actor": "Oleg Basilashvili",
	}, http.StatusCreated))
	// BOTH LINKS, AND THEY ARE DIFFERENT FACTS. actor_id says which human; this
	// says which role on this film, which is what a picture and a character record
	// hang off — and the reason a book highlight has the second and not the first.
	if got := speakerCast(t, srv, "dialogues", line.ID); got != row.ID {
		t.Fatalf("the line points at cast row %d, want %d", got, row.ID)
	}
}

// ---- what the link is FOR --------------------------------------------------

func TestACharacterCanBeAskedWhatTheyHaveSaid(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	c.mustDo("POST", "/books/"+itoa(bookID)+"/cast", map[string]any{"character": "Behemoth"}, http.StatusCreated)
	for _, q := range []string{"Manuscripts don't burn", "Never talk to strangers"} {
		c.mustDo("POST", "/annotations", map[string]any{
			"book_id": bookID, "quote": q, "character": "Woland",
		}, http.StatusCreated)
	}
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Somebody else entirely", "character": "Behemoth",
	}, http.StatusCreated)
	// A TWO-HANDER, which the linker refuses to file under either — the count is
	// what stops the list being quietly wrong about how much was said.
	c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "The two of them", "character": "Woland, Behemoth",
	}, http.StatusCreated)

	got := decode[struct {
		Lines []struct {
			ID        int64  `json:"id"`
			Kind      string `json:"kind"`
			Text      string `json:"text"`
			WorkTitle string `json:"work_title"`
		} `json:"lines"`
		SharedLines int `json:"shared_lines"`
	}](t, c.mustDo("GET", "/characters/"+itoa(charID), nil, http.StatusOK))

	if len(got.Lines) != 2 {
		t.Fatalf("want two linked lines, got %d: %+v", len(got.Lines), got.Lines)
	}
	for _, l := range got.Lines {
		if l.Kind != "highlight" {
			t.Errorf("a book line came back as kind %q", l.Kind)
		}
		if l.WorkTitle == "" {
			t.Errorf("a line came back with no work: %+v", l)
		}
		if l.Text == "Somebody else entirely" {
			t.Errorf("another character's line is on this record: %+v", l)
		}
	}
	if got.SharedLines != 1 {
		t.Fatalf("shared_lines = %d, want the one two-hander", got.SharedLines)
	}
}

func TestFindAndReplaceOverACharacterMovesTheLinkWithTheName(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	charID, bookID := oneWoland(t, c)
	woland := charDetail(t, c, charID).Appearances[0].CastID
	other := decode[castOut](t, c.mustDo("POST", "/books/"+itoa(bookID)+"/cast",
		map[string]any{"character": "Behemoth"}, http.StatusCreated))

	line := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": bookID, "quote": "Manuscripts don't burn", "character": "Woland",
	}, http.StatusCreated))
	if speakerCast(t, srv, "annotations", line.ID) != woland {
		t.Fatal("seed did not link")
	}

	// CORRECTING ONE SPELLING ACROSS FOUR HUNDRED ROWS IS WHAT THIS ENDPOINT IS
	// FOR, and `character` is one of the fields it rewrites — so a row it changed
	// and did not re-link would leave the character page listing lines that no
	// longer name them. It self-heals on the next cast-list read, which is exactly
	// why it has to happen here too: "wrong until somebody opens the book" is not a
	// state to leave a library in after a write the reader asked for.
	c.mustDo("POST", "/replace/apply", map[string]any{
		"kind": "annotation", "ids": []int64{line.ID}, "field": "character",
		"find": "Woland", "replace": "Behemoth", "match_case": true,
	}, http.StatusOK)

	if got := speakerCast(t, srv, "annotations", line.ID); got != other.ID {
		t.Fatalf("after find-and-replace the link is %d, want %d", got, other.ID)
	}
}
