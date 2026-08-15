package httpapi

// ?id= on the three quote lists — one row, by id.
//
// It exists for the review card's in-card edit, which has to PUT full state and
// therefore has to read full state first. The three things worth pinning are the
// three ways a filter like this goes wrong quietly: it narrows on ALL three
// kinds (a filter that works on annotations and is ignored on dialogues returns
// the whole list, which an edit form would then fill from the wrong row), a
// stranger's id is empty rather than readable, and a filter that matches nothing
// says so instead of falling back to everything.

import (
	"net/http"
	"testing"
)

// Each list names its rows after its own kind rather than "items", so the tests
// read whichever key came back. Decoding a fixed key would pass trivially on a
// list it cannot see — zero rows read as zero rows matched.
type quoteListRow struct {
	ID    int64  `json:"id"`
	Quote string `json:"quote"`
}

func quoteListRows(t *testing.T, c *testClient, path string) []quoteListRow {
	t.Helper()
	body := decode[map[string][]quoteListRow](t, c.mustDo("GET", path, nil, http.StatusOK))
	if len(body) != 1 {
		t.Fatalf("GET %s returned %d top-level keys, want 1: %v", path, len(body), body)
	}
	for _, rows := range body {
		return rows
	}
	return nil
}

func TestQuoteListsNarrowToOneRowByID(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	book := createBook(t, c, "Persuasion")
	a1 := idOf(t, c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "one"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "two"}, http.StatusCreated)

	movie := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, http.StatusCreated).Body.Bytes())
	d1 := idOf(t, c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie, "quote": "here's looking at you"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": movie, "quote": "round up the usual suspects"}, http.StatusCreated)

	u1 := idOf(t, c.mustDo("POST", "/quotes", map[string]any{"quote": "the unexamined life", "speaker": "Socrates"}, http.StatusCreated).Body.Bytes())
	c.mustDo("POST", "/quotes", map[string]any{"quote": "I know that I know nothing", "speaker": "Socrates"}, http.StatusCreated)

	for _, tc := range []struct {
		path string
		id   int64
		want string
	}{
		{"/annotations", a1, "one"},
		{"/dialogues", d1, "here's looking at you"},
		{"/quotes", u1, "the unexamined life"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			// Two rows exist on every kind, so a filter that is ignored returns two.
			if all := quoteListRows(t, c, tc.path); len(all) != 2 {
				t.Fatalf("%s holds %d rows, the test needs 2", tc.path, len(all))
			}
			rows := quoteListRows(t, c, tc.path+"?id="+itoa(tc.id))
			if len(rows) != 1 {
				t.Fatalf("%s?id=%d returned %d rows, want 1 — the filter was ignored", tc.path, tc.id, len(rows))
			}
			if rows[0].ID != tc.id || rows[0].Quote != tc.want {
				t.Fatalf("%s?id=%d returned id=%d %q, want id=%d %q",
					tc.path, tc.id, rows[0].ID, rows[0].Quote, tc.id, tc.want)
			}
		})
	}
}

// Somebody else's id is an empty list, not their row and not a 403. The
// ownership clause is already in every one of these queries; what this pins is
// that ?id= is an AND on top of it rather than a way round it.
func TestQuoteListByIDCannotReachAnotherAccount(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	owner := signupAdmin(t, h)
	book := createBook(t, owner, "Private")
	mine := idOf(t, owner.mustDo("POST", "/annotations",
		map[string]any{"book_id": book, "quote": "not for you"}, http.StatusCreated).Body.Bytes())

	stranger := addUser(t, h, owner, "stranger")
	if rows := quoteListRows(t, stranger, "/annotations?id="+itoa(mine)); len(rows) != 0 {
		t.Fatalf("a stranger read %d of somebody else's rows by id: %+v", len(rows), rows)
	}
}

// AN ID THAT MATCHES NOTHING IS EMPTY, not everything. This is the failure the
// filter would have if it were written as an optional clause that got skipped on
// a parse slip — the list comes back whole, and an edit form fills from row one.
func TestQuoteListByUnknownIDIsEmptyRatherThanEverything(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := createBook(t, c, "Persuasion")
	c.mustDo("POST", "/annotations", map[string]any{"book_id": book, "quote": "one"}, http.StatusCreated)

	if rows := quoteListRows(t, c, "/annotations?id=999999"); len(rows) != 0 {
		t.Fatalf("an unknown id returned %d rows", len(rows))
	}
	// And a non-numeric id is refused rather than ignored — an ignored one is
	// the same whole list with no way to tell.
	c.mustDo("GET", "/annotations?id=abc", nil, http.StatusBadRequest)
	c.mustDo("GET", "/dialogues?id=abc", nil, http.StatusBadRequest)
	c.mustDo("GET", "/quotes?id=abc", nil, http.StatusBadRequest)
}
