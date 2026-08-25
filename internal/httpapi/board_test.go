package httpapi

// Boards (0036) — the shelves /quotes lists.
//
// The cases here are the RULES, not the plumbing. Three of them are load-bearing
// and each would fail silently without a test:
//
//   - deleting a board asks where its quotes go, which is what lets all three
//     seeded boards stay ordinary with no permanent bucket;
//   - the default board is a preference pointing at a ROW, so deleting that row
//     has to repoint it or the next quote captured outside a board resolves a
//     dangling id;
//   - a PUT is full-state, so a body with no board_id MOVES the quote — the same
//     trap 0034 caught on translator and 0035 on category.

import (
	"net/http"
	"testing"
)

type boardsResp struct {
	Boards []boardRow `json:"boards"`
	Total  int        `json:"total"`
}

func listBoards(t *testing.T, c *testClient) boardsResp {
	t.Helper()
	return decode[boardsResp](t, c.mustDo("GET", "/boards", nil, http.StatusOK))
}

// There is no GET /quotes/{id} — a standalone quote is only ever read as part of
// a list (0026) — so a single row is fetched by listing and picking.
func quoteByID(t *testing.T, c *testClient, id int64) utteranceRow {
	t.Helper()
	got := decode[struct {
		Utterances []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, http.StatusOK))
	for _, u := range got.Utterances {
		if u.ID == id {
			return u
		}
	}
	t.Fatalf("quote %d is not in the list", id)
	return utteranceRow{}
}

func newBoard(t *testing.T, c *testClient, name string) boardRow {
	t.Helper()
	return decode[boardRow](t, c.mustDo("POST", "/boards", map[string]any{"name": name}, http.StatusCreated))
}

// A fresh account has no boards at all — 0036 seeds from quotes the reader
// already had, and somebody who has never saved one should not open the app to
// three empty shelves. The first quote makes the first board.
func TestTheFirstQuoteMakesTheFirstBoard(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	if got := listBoards(t, c); len(got.Boards) != 0 {
		t.Fatalf("a new account has %d boards, want none", len(got.Boards))
	}
	u := newUtterance(t, c, bose())
	if u.BoardID == 0 {
		t.Fatal("the quote was filed on no board")
	}
	after := listBoards(t, c)
	if len(after.Boards) != 1 || after.Boards[0].ID != u.BoardID {
		t.Fatalf("boards after the first quote: %+v", after.Boards)
	}
	if after.Boards[0].Quotes != 1 || after.Total != 1 {
		t.Fatalf("counts wrong: board=%d total=%d", after.Boards[0].Quotes, after.Total)
	}
}

func TestABoardNameIsUniquePerReader(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	newBoard(t, c, "Kennedy")
	// 409 rather than silently handing back the existing shelf: the reader typed
	// a name meaning to make something new.
	c.mustDo("POST", "/boards", map[string]any{"name": "Kennedy"}, http.StatusConflict)
	// Case-insensitively, so "kennedy" is not a second shelf beside it.
	c.mustDo("POST", "/boards", map[string]any{"name": "kennedy"}, http.StatusConflict)

	// A second reader keeps their own Kennedy — boards are scoped by user, like
	// people (0027) and the dedupe hash (0026).
	other := addUser(t, h, c, "other")
	newBoard(t, other, "Kennedy")
}

func TestDeletingABoardAsksWhereItsQuotesGo(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	u := newUtterance(t, c, bose())
	home := u.BoardID
	dest := newBoard(t, c, "Speeches")

	// No move_to, and quotes on it: refused. This is the rule that means no board
	// has to be permanent.
	c.mustDo("DELETE", "/boards/"+itoa(home), nil, http.StatusBadRequest)
	// Moving them to itself is the same refusal, not a no-op that then deletes.
	c.mustDo("DELETE", "/boards/"+itoa(home), map[string]any{"move_to": home}, http.StatusBadRequest)
	// A board that is not the reader's is not a destination.
	c.mustDo("DELETE", "/boards/"+itoa(home), map[string]any{"move_to": home + 9999}, http.StatusBadRequest)

	c.mustDo("DELETE", "/boards/"+itoa(home), map[string]any{"move_to": dest.ID}, http.StatusNoContent)

	after := listBoards(t, c)
	if len(after.Boards) != 1 || after.Boards[0].ID != dest.ID {
		t.Fatalf("boards after delete: %+v", after.Boards)
	}
	// The quote moved rather than dying with the shelf it sat on.
	if after.Boards[0].Quotes != 1 || after.Total != 1 {
		t.Fatalf("the quote did not move: board=%d total=%d", after.Boards[0].Quotes, after.Total)
	}
	if got := quoteByID(t, c, u.ID); got.BoardID != dest.ID {
		t.Fatalf("quote is on board %d, want %d", got.BoardID, dest.ID)
	}
}

func TestAnEmptyBoardDeletesFreely(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newBoard(t, c, "Spare")
	c.mustDo("DELETE", "/boards/"+itoa(b.ID), nil, http.StatusNoContent)
}

// The default board is a preference pointing at a row, so deleting that row has
// to repoint it. Without this the next quote captured outside a board resolves a
// dangling id — which defaultBoardID tolerates, but leaving it to be tolerated is
// how a stale pointer survives a release.
func TestDeletingTheDefaultBoardRepointsIt(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	first := newUtterance(t, c, bose())
	dest := newBoard(t, c, "Speeches")
	c.mustDo("DELETE", "/boards/"+itoa(first.BoardID), map[string]any{"move_to": dest.ID}, http.StatusNoContent)

	// A quote captured with no board now has to land somewhere real.
	next := newUtterance(t, c, map[string]any{"quote": "Another line entirely"})
	if next.BoardID != dest.ID {
		t.Fatalf("new quote filed on %d, want the surviving board %d", next.BoardID, dest.ID)
	}
}

func TestAQuoteIsFiledWhereTheRequestSays(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	first := newUtterance(t, c, bose())
	speeches := newBoard(t, c, "Speeches")

	body := bose()
	body["quote"] = "A second line"
	body["board_id"] = speeches.ID
	u := newUtterance(t, c, body)
	if u.BoardID != speeches.ID {
		t.Fatalf("filed on %d, want %d", u.BoardID, speeches.ID)
	}

	// Somebody else's board is a 400, not a silent fall back to the default:
	// filing a quote somewhere other than where the request said is worse than
	// refusing it, because nothing on screen would say it happened.
	other := addUser(t, h, c, "other")
	theirs := newBoard(t, other, "Theirs")
	bad := bose()
	bad["quote"] = "A third line"
	bad["board_id"] = theirs.ID
	c.mustDo("POST", "/quotes", bad, http.StatusBadRequest)

	// ?board= narrows the list, and an id that is not the reader's is a 400
	// rather than an empty shelf — an empty shelf hides the bug.
	got := decode[struct {
		Utterances []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes?board="+itoa(speeches.ID), nil, http.StatusOK))
	if len(got.Utterances) != 1 || got.Utterances[0].ID != u.ID {
		t.Fatalf("?board= returned %d rows", len(got.Utterances))
	}
	c.mustDo("GET", "/quotes?board="+itoa(theirs.ID), nil, http.StatusBadRequest)
	_ = first
}

// Every PUT here is full-state. A client that omits board_id moves the quote to
// the default board — which is correct for a full-state contract and is exactly
// why utteranceState on the client has to carry it.
func TestAFullStatePutCarriesTheBoard(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	home := newUtterance(t, c, bose())
	speeches := newBoard(t, c, "Speeches")

	body := bose()
	body["board_id"] = speeches.ID
	got := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(home.ID), body, http.StatusOK))
	if got.BoardID != speeches.ID {
		t.Fatalf("board did not move: %d", got.BoardID)
	}

	// And omitting it puts the quote back on the default, rather than leaving it
	// where it was. Asserted so the contract is written down: it is the trap, not
	// an accident.
	back := decode[utteranceRow](t, c.mustDo("PUT", "/quotes/"+itoa(home.ID), bose(), http.StatusOK))
	if back.BoardID == speeches.ID {
		t.Fatal("an omitted board_id left the quote where it was; the PUT is meant to be full-state")
	}
}

func TestABoardCanBeRenamedRecolouredAndHidden(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	b := newBoard(t, c, "Kennedy")

	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{
		"name": "JFK", "color": "blue", "description": "speeches worth the walk", "hidden": true,
	}, http.StatusNoContent)

	got := listBoards(t, c)
	if len(got.Boards) != 1 {
		t.Fatalf("boards: %+v", got.Boards)
	}
	g := got.Boards[0]
	if g.Name != "JFK" || g.Color != "blue" || g.Description != "speeches worth the walk" || !g.Hidden {
		t.Fatalf("update did not stick: %+v", g)
	}

	// Hidden boards are SENT, not filtered out: hiding is a view the reader can
	// switch off, so the client needs the whole list to be able to show it.
	if !got.Boards[0].Hidden {
		t.Fatal("a hidden board vanished from the list")
	}

	// hidden is a pointer on the request, so an edit of the name alone must not
	// un-hide it as a side effect.
	c.mustDo("PUT", "/boards/"+itoa(b.ID), map[string]any{"name": "JFK", "color": "blue"}, http.StatusNoContent)
	again := listBoards(t, c)
	if !again.Boards[0].Hidden {
		t.Fatal("renaming a board un-hid it")
	}
}

func TestABoardNeedsAName(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	c.mustDo("POST", "/boards", map[string]any{"name": "   "}, http.StatusBadRequest)
	c.mustDo("POST", "/boards", map[string]any{"name": "Fine", "color": "chartreuse"}, http.StatusBadRequest)
}

// EVERY WRITER FILES ITS QUOTE, and this exists because two of them did not.
//
// 1.14.0 gave utterances a board and wired the create and update handlers, and
// missed the other two paths that write the table: the proverb seeder and the
// importer. Both left board_id NULL, which does not fail and does not warn — the
// quotes are simply on no shelf. They show under All quotes, they are counted in
// no board's total, and the board the reader was standing on when they pressed
// "Add 10 Bengali proverbs" stays empty. That reads exactly like a feature that
// silently did nothing.
//
// The assertion is deliberately over the WHOLE TABLE rather than over the rows a
// particular endpoint made: the next writer added to utterances is the one this
// is meant to catch.
func TestEveryQuoteIsFiledOnABoard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// One of each writer: the create handler, the seeder, and an import.
	newUtterance(t, c, bose())
	c.mustDo("POST", "/quotes/starters", map[string]any{"language": "Bengali"}, http.StatusOK)
	// A real round trip rather than a hand-written file: export what is here and
	// import it into a second account, which is how the importer is exercised
	// everywhere else in this package.
	md := exportQuotes(t, c, nil)
	bob := addUser(t, h, c, "bob")
	staged := stageQuotesMD(t, bob, "tippani-quotes.md", md)
	approveBatch(t, bob, staged.BatchID)

	var unfiled int
	if err := srv.Store.DB.QueryRow(`SELECT COUNT(*) FROM utterances WHERE board_id IS NULL`).Scan(&unfiled); err != nil {
		t.Fatal(err)
	}
	if unfiled != 0 {
		t.Fatalf("%d quotes are on no board", unfiled)
	}

	// And the counts add up: every quote is on exactly one board, so the sum of
	// the board counts is the total. A NULL board_id breaks this silently.
	got := listBoards(t, c)
	sum := 0
	for _, b := range got.Boards {
		sum += b.Quotes
	}
	if sum != got.Total {
		t.Fatalf("board counts sum to %d but there are %d quotes", sum, got.Total)
	}
}

// The seeder files onto the board that offered them, because the offer is made
// ON an empty board — the same rule capture inside a board follows.
func TestStarterProverbsLandOnTheBoardThatOfferedThem(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)

	newUtterance(t, c, bose()) // makes the first board, so there is a default to differ from
	shelf := newBoard(t, c, "Bengali proverbs")
	c.mustDo("POST", "/quotes/starters",
		map[string]any{"language": "Bengali", "board_id": shelf.ID}, http.StatusOK)

	for _, b := range listBoards(t, c).Boards {
		if b.ID == shelf.ID && b.Quotes == 0 {
			t.Fatal("the proverbs did not land on the board that asked for them")
		}
	}
}

// THE DEFAULT BOARD SURVIVES AN UNRELATED SETTINGS CHANGE, and until 1.16.1 it
// did not.
//
// `defaultBoardId` is a preference pointing at a row, and it is the one
// preference written from outside handleUpdatePreferences — 0036's migration and
// setDefaultBoard both reach into the blob with SQL json_set. But that handler
// ends in `json.Marshal(cur)` over the `prefs` struct and one full-row UPDATE,
// and the key is not a field on that struct: loadPrefs drops it on unmarshal and
// the marshal never writes it back. So clicking an accent swatch deleted it.
//
// Nothing threw. defaultBoardID tolerates a missing key by falling back to
// `ORDER BY pos, id LIMIT 1` and repointing — so the reader's chosen shelf
// silently became their FIRST shelf, and the next quote captured outside a board
// was filed on the wrong one. 0036's own backfill produces exactly the shape
// that shows it: Others is seeded at pos 2, and Proverbs at pos 0 is what the
// fallback picks.
//
// Two assertions, because the key surviving and the filing being right are
// different claims and only the second is what the reader sees.
func TestASettingsChangeDoesNotMoveYourDefaultBoard(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	// Scanned through a NULL-tolerant pointer, because the failure this test
	// exists for DELETES the key rather than changing it — and "converting NULL
	// to int64 is unsupported" is a scan error that says nothing about what went
	// wrong. 0 means the key is not there at all.
	storedDefault := func() int64 {
		t.Helper()
		var id *int64
		if err := srv.Store.DB.QueryRow(
			`SELECT CAST(json_extract(preferences, '$.defaultBoardId') AS INTEGER) FROM users WHERE id = 1`,
		).Scan(&id); err != nil {
			t.Fatalf("read defaultBoardId: %v", err)
		}
		if id == nil {
			return 0
		}
		return *id
	}

	// The first quote makes the first board and points the preference at it.
	first := newUtterance(t, c, bose())
	if storedDefault() != first.BoardID {
		t.Fatalf("defaultBoardId = %d after the first quote, want board %d", storedDefault(), first.BoardID)
	}

	// A second shelf, and the reader's default moved onto it — the shape 0036's
	// backfill leaves behind, where the default is NOT the first board by
	// (pos, id). Written the way the migration writes it, which is the point:
	// this key has always been set from outside the preferences handler.
	dest := newBoard(t, c, "Speeches")
	if _, err := srv.Store.DB.Exec(
		`UPDATE users SET preferences = json_set(
		   CASE WHEN COALESCE(preferences,'') = '' THEN '{}' ELSE preferences END,
		   '$.defaultBoardId', ?) WHERE id = 1`, dest.ID); err != nil {
		t.Fatal(err)
	}

	// Something entirely unrelated: one accent swatch.
	c.mustDo("PUT", "/auth/me/preferences",
		map[string]any{"materialSet": "manuscript", "theme": "light", "accent": "olive"}, http.StatusOK)

	if got := storedDefault(); got != dest.ID {
		t.Fatalf("defaultBoardId = %d after an accent change, want %d — the preferences PUT deleted it", got, dest.ID)
	}

	// And the consequence the reader would actually notice: a quote captured
	// outside any board still lands on the shelf they chose.
	next := newUtterance(t, c, map[string]any{"quote": "Another line entirely"})
	if next.BoardID != dest.ID {
		t.Fatalf("a quote captured after a settings change landed on board %d, want %d", next.BoardID, dest.ID)
	}
}
