package httpapi

import (
	"net/http"
	"testing"
)

// The fifth bulk endpoint, and colour on all three quote kinds.
//
// `POST /quotes/bulk` looks like a cheap mirror of the other two and is not. The
// existing helper takes a kind and swaps a triple of names, which READS as
// parameterised — but both kinds it served are CHILD rows reached through a parent,
// and its ownership filter is `WHERE parent_col IN (SELECT id FROM parent WHERE
// user_id = ?)`. A standalone quote has no parent: `utterances.user_id` is on the
// row itself, which is a different query.
//
// So both directions get a test, because both failures are silent in opposite
// ways. An ownership filter that matches nothing is a bulk action that reports
// success and changes nothing. One that matches everything is somebody else's
// library.

type bulkResp struct {
	Updated int `json:"updated"`
}

func TestBulkTagQuotes(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	a := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "the first line", "speaker": "A"}, 201).Body.Bytes())
	b := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "the second line", "speaker": "B"}, 201).Body.Bytes())

	got := decode[bulkResp](t, c.mustDo("POST", "/quotes/bulk", map[string]any{
		"ids": []int64{a, b}, "add_tags": []string{"grief", "craft"}, "favorite": true, "color": "blue",
	}, 200))
	if got.Updated != 2 {
		t.Fatalf("updated = %d, want 2", got.Updated)
	}

	rows := decode[struct {
		Quotes []utteranceRow `json:"utterances"`
	}](t, c.mustDo("GET", "/quotes", nil, 200)).Quotes
	if len(rows) != 2 {
		t.Fatalf("quotes: %+v", rows)
	}
	for _, q := range rows {
		if !q.Favorite || q.Color != "blue" {
			t.Errorf("quote %d: favorite=%v color=%q", q.ID, q.Favorite, q.Color)
		}
		if len(q.Tags) != 2 {
			t.Errorf("quote %d tags = %+v", q.ID, q.Tags)
		}
	}
}

func TestBulkColourOnEveryQuoteKind(t *testing.T) {
	// Colour became a six-slot user-named category in 1.7.1 and the bulk endpoints
	// could not set it — which made the most plausible reason to select forty
	// quotes the one thing a selection could not do.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Dispossessed")
	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, 201).Body.Bytes())
	annID := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "a highlight"}, 201).Body.Bytes())
	dlgID := idOf(t, c.mustDo("POST", "/dialogues",
		map[string]any{"movie_id": movieID, "quote": "a film line"}, 201).Body.Bytes())
	quoteID := idOf(t, c.mustDo("POST", "/quotes",
		map[string]any{"quote": "a standalone quote", "speaker": "Anon"}, 201).Body.Bytes())

	for _, tc := range []struct {
		path string
		id   int64
	}{
		{"/annotations/bulk", annID},
		{"/dialogues/bulk", dlgID},
		{"/quotes/bulk", quoteID},
	} {
		c.mustDo("POST", tc.path, map[string]any{"ids": []int64{tc.id}, "color": "purple"}, 200)
	}

	var colours []string
	for _, q := range []struct {
		table string
		id    int64
	}{
		{"annotations", annID}, {"dialogues", dlgID}, {"utterances", quoteID},
	} {
		var col string
		if err := srv.Store.DB.QueryRow(`SELECT color FROM `+q.table+` WHERE id = ?`, q.id).Scan(&col); err != nil {
			t.Fatal(err)
		}
		colours = append(colours, col)
	}
	for i, col := range colours {
		if col != "purple" {
			t.Errorf("kind %d came out %q, want purple", i, col)
		}
	}
}

func TestBulkRefusesAColourTheSchemaWouldRefuse(t *testing.T) {
	// The API's allowlist and the CHECK constraint have to agree, or a "valid"
	// request becomes a 500 from the database. Validated before the transaction, so
	// nothing is half-applied either.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	id := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "a line", "speaker": "A"}, 201).Body.Bytes())

	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": []int64{id}, "color": "chartreuse"}, http.StatusBadRequest)

	var col string
	if err := srv.Store.DB.QueryRow(`SELECT color FROM utterances WHERE id = ?`, id).Scan(&col); err != nil {
		t.Fatal(err)
	}
	if col != "yellow" {
		t.Fatalf("a refused colour changed the row to %q", col)
	}
}

func TestBulkOnSomebodyElsesQuotesChangesNothing(t *testing.T) {
	// The direction that would leak: an ownership filter matching everything.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	mine := idOf(t, admin.mustDo("POST", "/quotes",
		map[string]any{"quote": "not yours", "speaker": "A"}, 201).Body.Bytes())

	// Bob names the admin's quote. No matching items — not a 200 over somebody
	// else's row, and not a 403 that confirms it exists.
	bob.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": []int64{mine}, "color": "pink"}, http.StatusNotFound)

	var col string
	if err := srv.Store.DB.QueryRow(`SELECT color FROM utterances WHERE id = ?`, mine).Scan(&col); err != nil {
		t.Fatal(err)
	}
	if col != "yellow" {
		t.Fatalf("bob recoloured the admin's quote to %q", col)
	}
}

func TestBulkOnMyOwnQuotesActsOnAllOfThem(t *testing.T) {
	// The other direction, which is the one that fails SILENTLY: a filter that
	// matches nothing reports success and does nothing at all. Asserted as a value
	// on every row rather than as a count in the response.
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	var ids []int64
	for _, q := range []string{"one", "two", "three"} {
		ids = append(ids, idOf(t, bob.mustDo("POST", "/quotes",
			map[string]any{"quote": q, "speaker": "B"}, 201).Body.Bytes()))
	}
	got := decode[bulkResp](t, bob.mustDo("POST", "/quotes/bulk",
		map[string]any{"ids": ids, "color": "green", "favorite": true}, 200))
	if got.Updated != 3 {
		t.Fatalf("updated = %d, want 3", got.Updated)
	}
	for _, id := range ids {
		var col string
		var fav bool
		if err := srv.Store.DB.QueryRow(
			`SELECT color, favorite FROM utterances WHERE id = ?`, id).Scan(&col, &fav); err != nil {
			t.Fatal(err)
		}
		if col != "green" || !fav {
			t.Errorf("quote %d: color=%q favorite=%v", id, col, fav)
		}
	}
}

func TestBulkQuotesGuards(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	_ = srv

	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": []int64{}}, http.StatusBadRequest)
	many := make([]int64, 5001)
	for i := range many {
		many[i] = int64(i + 1)
	}
	c.mustDo("POST", "/quotes/bulk", map[string]any{"ids": many, "color": "blue"}, http.StatusBadRequest)
}

// Two more fields on the same three endpoints (1.11.1): the seal, and whether the
// quiz draws on the quote at all.
//
// The sticker is the one with a trap in it. `0` means "take the seal off", and at
// a bare int `0` and "not sent" are the same JSON — so a selection recoloured in
// one call would silently lose every sticker on it. Hence a pointer, and hence a
// test that recolouring alone leaves the seals alone.

func TestBulkStickerOnASelection(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	seal := makeSticker(t, srv, 1, "heart")

	bookID := createBook(t, c, "Ficciones")
	var ids []int64
	for _, q := range []string{"the garden of forking paths", "a labyrinth of symbols"} {
		ids = append(ids, idOf(t, c.mustDo("POST", "/annotations",
			map[string]any{"book_id": bookID, "quote": q}, http.StatusCreated).Body.Bytes()))
	}

	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ids, "sticker_id": seal}, 200)
	read := func() []annotationRow {
		return decode[struct {
			Annotations []annotationRow `json:"annotations"`
		}](t, c.mustDo("GET", "/annotations?book_id="+itoa(bookID), nil, 200)).Annotations
	}
	for _, a := range read() {
		if a.StickerID == nil || *a.StickerID != seal {
			t.Errorf("annotation %d: sticker_id = %v, want %d", a.ID, a.StickerID, seal)
		}
	}

	// A colour change must not be a sticker change. This is the pointer earning
	// its keep: at a bare int this call would clear every seal.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ids, "color": "blue"}, 200)
	for _, a := range read() {
		if a.StickerID == nil {
			t.Errorf("annotation %d lost its seal to a colour change", a.ID)
		}
	}

	// 0 is the clear, and it has to land as a real NULL rather than a 0 pointing
	// at a sticker that can never exist.
	c.mustDo("POST", "/annotations/bulk", map[string]any{"ids": ids, "sticker_id": 0}, 200)
	for _, a := range read() {
		if a.StickerID != nil {
			t.Errorf("annotation %d: sticker_id = %v, want nil after a clear", a.ID, *a.StickerID)
		}
	}
}

func TestBulkStickerRefusesSomebodyElsesSeal(t *testing.T) {
	// sticker_id is ON DELETE SET NULL and the FK alone is not user-scoped, so
	// without the check a guessed integer attaches another account's sticker —
	// which is a private image served on your own card.
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	_ = alice
	aliceSeal := makeSticker(t, srv, 1, "alice's heart") // user 1 is the admin

	bookID := createBook(t, bob, "Bob's book")
	id := idOf(t, bob.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "bob's highlight"}, http.StatusCreated).Body.Bytes())

	bob.mustDo("POST", "/annotations/bulk",
		map[string]any{"ids": []int64{id}, "sticker_id": aliceSeal}, http.StatusNotFound)
}

// makeSticker inserts one sticker row for a user. The upload path needs a real
// image and a writable cover directory; the ownership rule under test needs
// neither, so the fixture goes in at the table.
func makeSticker(t *testing.T, srv *Server, userID int64, name string) int64 {
	t.Helper()
	res, err := srv.Store.DB.Exec(`INSERT INTO stickers (user_id, name, path) VALUES (?, ?, ?)`,
		userID, name, name+".svg")
	if err != nil {
		t.Fatalf("insert sticker: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("sticker id: %v", err)
	}
	return id
}
