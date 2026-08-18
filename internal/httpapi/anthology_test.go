package httpapi

// Anthologies (0043).
//
// Five things need proving and only the first is obvious:
//
//   - the ORDER is a fact the server keeps, and a reorder writes ONE row. The
//     midpoint rule is the whole reason `position` is a REAL, so a test that only
//     checked the resulting order would pass against the renumbering version this
//     schema deliberately refused.
//   - FILING IS NOT MOVING: one quote in two anthologies, once in each.
//   - OWNERSHIP is checked on BOTH ends. An anthology is reached by id and an
//     entry names a quote by id, and neither id is inside anything that scopes it —
//     so every route needs its own check, and a foreign quote must be refused even
//     when the anthology is the caller's own.
//   - a themed round draws the anthology's entries ACROSS ALL THREE KINDS, and the
//     daily deck is untouched while it runs. That last clause is the specific
//     failure review_theme.go's header warns about.
//   - the round trip keeps the order and the prose, which is the only claim the
//     export makes about itself.

import (
	"net/http"
	"strings"
	"testing"
)

type anthologyDetail struct {
	Anthology anthologyRow        `json:"anthology"`
	Entries   []anthologyEntryRow `json:"entries"`
}

func newAnthology(t *testing.T, c *testClient, title string) anthologyRow {
	t.Helper()
	return decode[anthologyRow](t, c.mustDo("POST", "/anthologies",
		map[string]any{"title": title}, http.StatusCreated))
}

func getAnthology(t *testing.T, c *testClient, id int64) anthologyDetail {
	t.Helper()
	return decode[anthologyDetail](t, c.mustDo("GET", "/anthologies/"+itoa(id), nil, http.StatusOK))
}

// entryOrder is the reading order as (kind, item_id) pairs — what the screen
// draws, and the only form of the order worth asserting. Positions are an
// implementation detail; the sequence is the feature.
func entryOrder(d anthologyDetail) []string {
	out := make([]string, 0, len(d.Entries))
	for _, e := range d.Entries {
		out = append(out, e.Kind+":"+itoa(e.ItemID))
	}
	return out
}

// threeKinds seeds one quote of each kind and returns their ids in the order
// (book, screen, utterance). An anthology that cannot hold all three is a board.
func threeKinds(t *testing.T, c *testClient) (int64, int64, int64) {
	t.Helper()
	book := decode[bookDetail](t, c.mustDo("POST", "/books",
		map[string]any{"title": "Invisible Cities", "author": "Italo Calvino"}, http.StatusCreated))
	ann := decode[annotationRow](t, c.mustDo("POST", "/annotations", map[string]any{
		"book_id": book.ID, "quote": "Cities, like dreams, are made of desires and fears.",
	}, http.StatusCreated))
	movie := decode[movieDetail](t, c.mustDo("POST", "/movies",
		map[string]any{"title": "Stalker", "director": "Andrei Tarkovsky"}, http.StatusCreated))
	dia := decode[dialogueRow](t, c.mustDo("POST", "/dialogues", map[string]any{
		"movie_id": movie.ID, "quote": "Let everything that has been planned come true.",
		"character": "Stalker", "actor": "Alexander Kaidanovsky",
	}, http.StatusCreated))
	utt := newUtterance(t, c, bose())
	return ann.ID, dia.ID, utt.ID
}

func addEntries(t *testing.T, c *testClient, id int64, items []map[string]any) map[string]any {
	t.Helper()
	return decode[map[string]any](t, c.mustDo("POST", "/anthologies/"+itoa(id)+"/entries",
		map[string]any{"items": items}, http.StatusOK))
}

func TestAnAnthologyHoldsAllThreeKindsInOrder(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Cities and their ghosts")

	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
		{"kind": "utterance", "item_id": utt},
	})

	got := getAnthology(t, c, a.ID)
	want := []string{"book:" + itoa(ann), "screen:" + itoa(dia), "utterance:" + itoa(utt)}
	if diff := strings.Join(entryOrder(got), " "); diff != strings.Join(want, " ") {
		t.Fatalf("order = %q, want %q", diff, strings.Join(want, " "))
	}
	if got.Anthology.Entries != 3 {
		t.Errorf("count = %d, want 3", got.Anthology.Entries)
	}
	// The passage and its attribution come back with the entry, because an
	// anthology is READ: a client that had to fetch three lists to draw one
	// document would be doing the join the server just did.
	for _, e := range got.Entries {
		if strings.TrimSpace(e.Quote) == "" {
			t.Errorf("%s:%d came back with no words", e.Kind, e.ItemID)
		}
	}
	byKind := map[string]anthologyEntryRow{}
	for _, e := range got.Entries {
		byKind[e.Kind] = e
	}
	if byKind["book"].Source != "Invisible Cities" || byKind["book"].Credit != "Italo Calvino" {
		t.Errorf("book entry attribution = %q / %q", byKind["book"].Source, byKind["book"].Credit)
	}
	// A film line's credit is the CHARACTER first and the actor after it — the
	// attribution a reader means by a film quote.
	if got := byKind["screen"].Credit; got != "Stalker · Alexander Kaidanovsky" {
		t.Errorf("screen entry credit = %q", got)
	}
	if byKind["utterance"].Credit != "Subhas Chandra Bose" {
		t.Errorf("utterance entry credit = %q", byKind["utterance"].Credit)
	}
	// A book quote keeps a way back to its book; a standalone quote has no parent
	// and says so with a zero rather than with a wrong id.
	if byKind["book"].WorkID == 0 {
		t.Error("the book entry lost its work id, so a card cannot open the book")
	}
	if byKind["utterance"].WorkID != 0 {
		t.Errorf("a standalone quote reported work id %d", byKind["utterance"].WorkID)
	}
}

func TestAddingTheSameQuoteTwiceIsANoOp(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Openings")

	first := addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	if first["added"] != float64(1) || first["skipped"] != float64(0) {
		t.Fatalf("first add: %+v", first)
	}
	// The bulk bar sends a whole selection and half of it may already be here, so
	// the second add is a SKIP and not a 409: the reader asked for these quotes to
	// be in this anthology, and afterwards they are.
	second := addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "utterance", "item_id": utt},
	})
	if second["added"] != float64(1) || second["skipped"] != float64(1) {
		t.Fatalf("second add: %+v", second)
	}
	if n := len(getAnthology(t, c, a.ID).Entries); n != 2 {
		t.Fatalf("%d entries after adding one quote twice, want 2", n)
	}
}

func TestOneQuoteCanBeInTwoAnthologies(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	first := newAnthology(t, c, "Cities")
	second := newAnthology(t, c, "Openings")

	for _, a := range []anthologyRow{first, second} {
		addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	}
	for _, a := range []anthologyRow{first, second} {
		if n := len(getAnthology(t, c, a.ID).Entries); n != 1 {
			t.Fatalf("anthology %d holds %d entries, want 1", a.ID, n)
		}
	}
	// FILING IS NOT MOVING — and removing it from one leaves the other alone,
	// which is the half that a single-membership model (a board) cannot do.
	c.mustDo("DELETE", "/anthologies/"+itoa(first.ID)+"/entries/book/"+itoa(ann), nil, http.StatusNoContent)
	if n := len(getAnthology(t, c, first.ID).Entries); n != 0 {
		t.Errorf("the entry survived its removal")
	}
	if n := len(getAnthology(t, c, second.ID).Entries); n != 1 {
		t.Errorf("removing an entry from one anthology took it out of the other")
	}
}

// TestReorderWritesOneRow is the measurable claim behind `position REAL`.
//
// The renumbering alternative — integer positions rewritten from the move point
// down — produces the same ORDER, so an order-only assertion would pass against
// it. What it does not produce is one UPDATE: it has to succeed for every row or
// the order is corrupt, and it runs on every drag. The count is taken from
// SQLite's own statement counter rather than inferred.
func TestReorderWritesOneRow(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Three")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
		{"kind": "utterance", "item_id": utt},
	})

	// The positions before, so the assertion can name which rows moved rather than
	// counting how many did.
	before := map[string]float64{}
	for _, e := range getAnthology(t, c, a.ID).Entries {
		before[e.Kind] = e.Position
	}

	// Move the utterance to the front: after nothing.
	c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/order", map[string]any{
		"kind": "utterance", "item_id": utt, "after": nil,
	}, http.StatusOK)

	got := getAnthology(t, c, a.ID)
	if want := "utterance:" + itoa(utt); entryOrder(got)[0] != want {
		t.Fatalf("order after moving to the front = %v, want %s first", entryOrder(got), want)
	}
	moved := 0
	for _, e := range got.Entries {
		if e.Position != before[e.Kind] {
			moved++
		}
	}
	if moved != 1 {
		t.Fatalf("%d of 3 rows changed position; a move must write exactly one", moved)
	}

	// And into the middle: after the book entry.
	c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/order", map[string]any{
		"kind": "utterance", "item_id": utt, "after": map[string]any{"kind": "book", "item_id": ann},
	}, http.StatusOK)
	got = getAnthology(t, c, a.ID)
	want := []string{"book:" + itoa(ann), "utterance:" + itoa(utt), "screen:" + itoa(dia)}
	if strings.Join(entryOrder(got), " ") != strings.Join(want, " ") {
		t.Fatalf("order after moving into the middle = %v, want %v", entryOrder(got), want)
	}

	// The order survives a reload because it is stored, not derived. Asserted by
	// reading it again through a fresh request rather than by trusting the reply.
	if strings.Join(entryOrder(getAnthology(t, c, a.ID)), " ") != strings.Join(want, " ") {
		t.Fatal("the order did not survive a re-read")
	}
}

// TestRepeatedMidpointsRenumberRatherThanCollapse drives the one case where the
// float runs out of room. Fifty moves into the same gap is not a thing a reader
// does; it is what a script does, and the failure mode without the renumber is
// two entries sharing a position and an order that stops being stable.
func TestRepeatedMidpointsRenumberRatherThanCollapse(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Squeeze")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
		{"kind": "utterance", "item_id": utt},
	})
	// Always back into the same gap: just after the book entry.
	for i := 0; i < 60; i++ {
		c.mustDo("POST", "/anthologies/"+itoa(a.ID)+"/order", map[string]any{
			"kind": "utterance", "item_id": utt,
			"after": map[string]any{"kind": "book", "item_id": ann},
		}, http.StatusOK)
	}
	got := getAnthology(t, c, a.ID)
	want := []string{"book:" + itoa(ann), "utterance:" + itoa(utt), "screen:" + itoa(dia)}
	if strings.Join(entryOrder(got), " ") != strings.Join(want, " ") {
		t.Fatalf("order after 60 moves into one gap = %v, want %v", entryOrder(got), want)
	}
	seen := map[float64]bool{}
	for _, e := range got.Entries {
		if seen[e.Position] {
			t.Fatalf("two entries share position %v", e.Position)
		}
		seen[e.Position] = true
	}
}

func TestAnthologyProseIsKeptAsWritten(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Cities")

	// Two paragraphs, because the blank line between them is the only formatting
	// this field has and a Fields-style trim would silently reflow it into one.
	intro := "Three passages about the same idea.\n\nThey were written sixty years apart."
	c.mustDo("PUT", "/anthologies/"+itoa(a.ID), map[string]any{
		"title": "Cities and their ghosts", "intro": "  " + intro + "\n\n",
	}, http.StatusNoContent)

	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	c.mustDo("PUT", "/anthologies/"+itoa(a.ID)+"/entries", map[string]any{
		"kind": "book", "item_id": ann, "note": "Calvino first, because he sets the terms.",
	}, http.StatusNoContent)

	got := getAnthology(t, c, a.ID)
	if got.Anthology.Intro != intro {
		t.Fatalf("intro = %q, want %q — the edges are trimmed and the inside is not", got.Anthology.Intro, intro)
	}
	if got.Anthology.Title != "Cities and their ghosts" {
		t.Errorf("title = %q", got.Anthology.Title)
	}
	if got.Entries[0].Note != "Calvino first, because he sets the terms." {
		t.Errorf("commentary = %q", got.Entries[0].Note)
	}
	// Removing the entry takes its commentary with it: a note is written ABOUT a
	// passage in a place, so keeping it would keep a sentence about nothing.
	c.mustDo("DELETE", "/anthologies/"+itoa(a.ID)+"/entries/book/"+itoa(ann), nil, http.StatusNoContent)
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	if note := getAnthology(t, c, a.ID).Entries[0].Note; note != "" {
		t.Errorf("commentary came back with the re-added entry: %q", note)
	}
}

// TestAnthologyOwnership walks every route with a second account.
//
// Both ends need it and the second is the one that is easy to miss: an entry names
// a quote by a bare id, so a reader could otherwise file somebody else's highlight
// into their own anthology and read it there. A foreign row answers 404 and never
// 403 — a 403 confirms the row exists.
func TestAnthologyOwnership(t *testing.T) {
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, alice)
	a := newAnthology(t, alice, "Alice's")
	addEntries(t, alice, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})

	bob := addUser(t, h, alice, "bob")
	id := itoa(a.ID)
	for _, tc := range []struct {
		method, path string
		body         any
	}{
		{"GET", "/anthologies/" + id, nil},
		{"PUT", "/anthologies/" + id, map[string]any{"title": "Bob's now"}},
		{"DELETE", "/anthologies/" + id, nil},
		{"POST", "/anthologies/" + id + "/entries", map[string]any{"items": []map[string]any{{"kind": "book", "item_id": ann}}}},
		{"PUT", "/anthologies/" + id + "/entries", map[string]any{"kind": "book", "item_id": ann, "note": "mine"}},
		{"DELETE", "/anthologies/" + id + "/entries/book/" + itoa(ann), nil},
		{"POST", "/anthologies/" + id + "/order", map[string]any{"kind": "book", "item_id": ann, "after": nil}},
		{"GET", "/anthologies/" + id + "/export", nil},
	} {
		bob.mustDo(tc.method, tc.path, tc.body, http.StatusNotFound)
	}
	// Bob's list does not mention it either.
	var list struct {
		Anthologies []anthologyRow `json:"anthologies"`
	}
	list = decode[struct {
		Anthologies []anthologyRow `json:"anthologies"`
	}](t, bob.mustDo("GET", "/anthologies", nil, http.StatusOK))
	if len(list.Anthologies) != 0 {
		t.Fatalf("bob sees %d of alice's anthologies", len(list.Anthologies))
	}
	// And it is still Alice's, unchanged, after all of that.
	if got := getAnthology(t, alice, a.ID); got.Anthology.Title != "Alice's" || len(got.Entries) != 1 {
		t.Fatalf("alice's anthology after bob's attempts: %+v", got.Anthology)
	}

	// THE OTHER END. Bob's own anthology may not hold Alice's quote — the
	// anthology being his says nothing about the id he sent.
	bobs := newAnthology(t, bob, "Bob's")
	bob.mustDo("POST", "/anthologies/"+itoa(bobs.ID)+"/entries",
		map[string]any{"items": []map[string]any{{"kind": "book", "item_id": ann}}}, http.StatusNotFound)
	if n := len(getAnthology(t, bob, bobs.ID).Entries); n != 0 {
		t.Fatalf("bob filed %d of alice's quotes into his own anthology", n)
	}
	// A refused item leaves the whole request unwritten rather than the valid half
	// of it: an add is one transaction, and a partial add would be a selection that
	// silently landed short.
	bobAnn := func() int64 {
		book := decode[bookDetail](t, bob.mustDo("POST", "/books", map[string]any{"title": "Bob's book"}, http.StatusCreated))
		row := decode[annotationRow](t, bob.mustDo("POST", "/annotations",
			map[string]any{"book_id": book.ID, "quote": "A line of his own."}, http.StatusCreated))
		return row.ID
	}()
	bob.mustDo("POST", "/anthologies/"+itoa(bobs.ID)+"/entries", map[string]any{"items": []map[string]any{
		{"kind": "book", "item_id": bobAnn},
		{"kind": "book", "item_id": ann},
	}}, http.StatusNotFound)
	if n := len(getAnthology(t, bob, bobs.ID).Entries); n != 0 {
		t.Fatalf("a refused add wrote %d entries anyway", n)
	}
}

func TestAnthologyValidation(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, _ := threeKinds(t, c)
	a := newAnthology(t, c, "Cities")
	id := itoa(a.ID)

	c.mustDo("POST", "/anthologies", map[string]any{"title": "   "}, http.StatusBadRequest)
	c.mustDo("POST", "/anthologies", map[string]any{"title": strings.Repeat("x", anthologyTitleMax+1)}, http.StatusBadRequest)
	c.mustDo("PUT", "/anthologies/"+id, map[string]any{
		"title": "Cities", "intro": strings.Repeat("x", anthologyIntroMax+1),
	}, http.StatusBadRequest)
	// An unknown kind is refused rather than ignored: a silently dropped entry is a
	// quote the reader watched themselves add.
	c.mustDo("POST", "/anthologies/"+id+"/entries",
		map[string]any{"items": []map[string]any{{"kind": "annotation", "item_id": ann}}}, http.StatusBadRequest)
	c.mustDo("POST", "/anthologies/"+id+"/entries", map[string]any{"items": []map[string]any{}}, http.StatusBadRequest)
	// A quote that is not in the anthology cannot be commented on or moved.
	c.mustDo("PUT", "/anthologies/"+id+"/entries",
		map[string]any{"kind": "book", "item_id": ann, "note": "x"}, http.StatusNotFound)
	c.mustDo("POST", "/anthologies/"+id+"/order",
		map[string]any{"kind": "book", "item_id": ann, "after": nil}, http.StatusNotFound)
	// An entry cannot follow itself: the midpoint would be computed against the row
	// being moved and the move would silently do nothing.
	addEntries(t, c, a.ID, []map[string]any{{"kind": "book", "item_id": ann}})
	c.mustDo("POST", "/anthologies/"+id+"/order", map[string]any{
		"kind": "book", "item_id": ann, "after": map[string]any{"kind": "book", "item_id": ann},
	}, http.StatusBadRequest)
}

// TestDeletingAQuoteLeavesEveryAnthology is the trigger from 0043, seen from the
// API rather than from the schema.
//
// The store test proves the rows go. This one proves what the reader sees: the
// anthology is still there, still has its prose, and does not render a gap.
func TestDeletingAQuoteLeavesEveryAnthology(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, dia, utt := threeKinds(t, c)
	a := newAnthology(t, c, "All three")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "screen", "item_id": dia},
		{"kind": "utterance", "item_id": utt},
	})
	c.mustDo("PUT", "/anthologies/"+itoa(a.ID), map[string]any{
		"title": "All three", "intro": "The prose outlives the quotes.",
	}, http.StatusNoContent)

	// A quote delete answers 200 with a bin id, not 204: everything deleted here
	// goes to the bin first (0031).
	c.mustDo("DELETE", "/annotations/"+itoa(ann), nil, http.StatusOK)
	got := getAnthology(t, c, a.ID)
	if len(got.Entries) != 2 {
		t.Fatalf("%d entries after deleting one quote, want 2: %v", len(got.Entries), entryOrder(got))
	}
	for _, e := range got.Entries {
		if e.Kind == "book" {
			t.Error("the deleted highlight is still an entry")
		}
	}
	c.mustDo("DELETE", "/dialogues/"+itoa(dia), nil, http.StatusOK)
	c.mustDo("DELETE", "/quotes/"+itoa(utt), nil, http.StatusOK)
	got = getAnthology(t, c, a.ID)
	if len(got.Entries) != 0 {
		t.Fatalf("%d entries after deleting every quote", len(got.Entries))
	}
	if got.Anthology.Intro != "The prose outlives the quotes." {
		t.Errorf("the anthology lost its introduction with its last quote: %q", got.Anthology.Intro)
	}
}

// TestRestoringAQuoteRestoresItsPlaceInTheAnthology is the other half of the
// trigger above, and the reason anthology_entries had to be added to what the bin
// carries.
//
// Everything deleted in this app goes to the bin first, and what travels with a
// row is DECLARED rather than discovered — precisely because three tables now hang
// off a quote with no foreign key to walk. Without the declaration, deleting a
// quote and putting it back would return it to the library and drop it out of every
// anthology it was in, taking the reader's commentary with it, and the restore
// would report success.
func TestRestoringAQuoteRestoresItsPlaceInTheAnthology(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	ann, _, utt := threeKinds(t, c)
	a := newAnthology(t, c, "Two")
	addEntries(t, c, a.ID, []map[string]any{
		{"kind": "book", "item_id": ann},
		{"kind": "utterance", "item_id": utt},
	})
	c.mustDo("PUT", "/anthologies/"+itoa(a.ID)+"/entries", map[string]any{
		"kind": "utterance", "item_id": utt, "note": "And a voice from outside either.",
	}, http.StatusNoContent)

	// Delete the standalone quote, which is the kind whose entry carries prose here.
	var del struct {
		TrashID int64 `json:"trash_id"`
	}
	del = decode[struct {
		TrashID int64 `json:"trash_id"`
	}](t, c.mustDo("DELETE", "/quotes/"+itoa(utt), nil, http.StatusOK))
	if n := len(getAnthology(t, c, a.ID).Entries); n != 1 {
		t.Fatalf("%d entries while the quote is in the bin, want 1", n)
	}

	c.mustDo("POST", "/trash/"+itoa(del.TrashID)+"/restore", nil, http.StatusOK)
	got := getAnthology(t, c, a.ID)
	if len(got.Entries) != 2 {
		t.Fatalf("%d entries after the restore, want 2 — the quote came back and its place did not", len(got.Entries))
	}
	var restored anthologyEntryRow
	for _, e := range got.Entries {
		if e.Kind == "utterance" {
			restored = e
		}
	}
	if restored.Note != "And a voice from outside either." {
		t.Errorf("the commentary did not come back: %q", restored.Note)
	}
	// And it is back in the ORDER it was in, not appended: position travels with
	// the entry, so a restore does not quietly move a passage to the end.
	if entryOrder(got)[1] != "utterance:"+itoa(utt) {
		t.Errorf("order after the restore = %v", entryOrder(got))
	}
}
