package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
)

// The id floor: an id is never handed out twice, on any path into the library.
//
// THIS IS THE TEST THAT KEEPS THE BIN HONEST, and it is worth being blunt about
// why, because nothing here fails loudly if the floor is bypassed.
//
// `id INTEGER PRIMARY KEY` is a rowid alias, so SQLite hands out max(rowid) + 1.
// Delete the newest quote and the next one you add takes its id — silently,
// correctly by SQLite's rules, and catastrophically for a bin that is holding a
// snapshot of the row that used to own it. The restore then either collides or
// has to renumber a whole subtree on the one path whose job is to put things back
// exactly as they were.
//
// So every create path allocates from `id_floor`. There are nine of them across
// five tables, and the failure mode of missing one is not an error: it is a
// restore that collides months later, on somebody's data, in the feature they
// went looking for because something had already gone wrong.
//
// The assertions are therefore behavioural — create, delete, create, compare ids
// — rather than a check that the code calls a function. A grep-style test would
// pass for a call that passes the wrong table name.

// idOf reads the `id` out of a create response.
func idOf(t *testing.T, body []byte) int64 {
	t.Helper()
	var v struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(body, &v); err != nil {
		t.Fatalf("decode id from %s: %v", body, err)
	}
	if v.ID == 0 {
		t.Fatalf("no id in %s", body)
	}
	return v.ID
}

// quoteText makes each create in the loop below distinct, so a dedupe conflict
// can never be mistaken for a reused id.
func quoteText(n int) string { return "line number " + itoa(int64(n)) }

func TestIDsAreNeverReused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "The Dispossessed")
	movieID := idOf(t, c.mustDo("POST", "/movies", map[string]any{"title": "Casablanca"}, 201).Body.Bytes())

	// Each case: create it, delete it, create another, and insist the second one
	// is a NEW id. Deleting the newest row is the case SQLite reuses, so every one
	// of these fails without the floor.
	cases := []struct {
		name   string
		path   string
		body   func(n int) map[string]any
		delete string
	}{
		{
			name: "annotation",
			path: "/annotations",
			body: func(n int) map[string]any {
				return map[string]any{"book_id": bookID, "quote": quoteText(n)}
			},
			delete: "/annotations/",
		},
		{
			name: "dialogue",
			path: "/dialogues",
			body: func(n int) map[string]any {
				return map[string]any{"movie_id": movieID, "quote": quoteText(n)}
			},
			delete: "/dialogues/",
		},
		{
			name: "quote",
			path: "/quotes",
			body: func(n int) map[string]any {
				return map[string]any{"quote": quoteText(n), "speaker": "Anon"}
			},
			delete: "/quotes/",
		},
		{
			name: "book",
			path: "/books",
			body: func(n int) map[string]any {
				return map[string]any{"title": quoteText(n)}
			},
			delete: "/books/",
		},
		{
			name: "movie",
			path: "/movies",
			body: func(n int) map[string]any {
				return map[string]any{"title": quoteText(n)}
			},
			delete: "/movies/",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			first := idOf(t, c.mustDo("POST", tc.path, tc.body(1), 201).Body.Bytes())
			c.mustDo("DELETE", tc.delete+itoa(first), nil, http.StatusOK)
			second := idOf(t, c.mustDo("POST", tc.path, tc.body(2), 201).Body.Bytes())
			if second <= first {
				t.Fatalf("%s id was reused: created %d, deleted it, next was %d", tc.name, first, second)
			}
			// And again, without a delete in between, so the floor is not merely
			// skipping one id per deletion — it is monotonic.
			third := idOf(t, c.mustDo("POST", tc.path, tc.body(3), 201).Body.Bytes())
			if third <= second {
				t.Fatalf("%s ids not increasing: %d then %d", tc.name, second, third)
			}
		})
	}
}

func TestImportedIDsAreNeverReused(t *testing.T) {
	// The import paths allocate a BLOCK per batch rather than an id per row, which
	// is a second implementation of the same rule and therefore a second place to
	// get it wrong. A file whose quotes land on ids a bin entry still holds is the
	// exact failure the floor exists to prevent, and an import is the most likely
	// way to create a hundred rows at once.
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	bookID := createBook(t, c, "A Wizard of Earthsea")
	first := idOf(t, c.mustDo("POST", "/annotations",
		map[string]any{"book_id": bookID, "quote": "Only in silence the word"}, 201).Body.Bytes())
	c.mustDo("DELETE", "/annotations/"+itoa(first), nil, http.StatusOK)

	// One quote through the importer, against the same book, all the way to
	// approval — the staged tables are not the library, so nothing is allocated
	// until a batch is approved.
	md := "---\ntitle: A Wizard of Earthsea\nauthor: Ursula K. Le Guin\n---\n\n" +
		"> To light a candle is to cast a shadow.\n"
	res := stage(t, c, "/import/markdown", "earthsea.md", []byte(md))
	c.mustDo("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID}, http.StatusOK)

	// Every annotation the account has, rather than this book's: the importer
	// resolves its own target (author included in the identity), so which book the
	// quote lands against is not what this test is about.
	rows := decode[annList](t, c.mustDo("GET", "/annotations", nil, 200)).Annotations
	if len(rows) != 1 {
		t.Fatalf("expected the imported quote, got %d rows", len(rows))
	}
	if rows[0].ID <= first {
		t.Fatalf("an import reused a binned id: deleted %d, import wrote %d", first, rows[0].ID)
	}
}
