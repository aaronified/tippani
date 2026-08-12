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
