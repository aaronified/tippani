package httpapi

import (
	"net/http"
	"testing"
)

// Editing the read log.
//
// work_reads could only ever be written as a side effect of a status change,
// which records what is happening now and cannot record what happened before. A
// book read three times over fifteen years had one row at best, and there was no
// way to say "I finished this in 2019" about something already on the shelf —
// the log could only be as old as the account.
//
// 1.7.2 then sorted the Library by that log. A sort you cannot correct is worse
// than no sort, which is what makes this a fix rather than an addition.

func readsOf(t *testing.T, c *testClient, path string, id int64) []readRow {
	t.Helper()
	if path == "books" {
		return decode[bookDetail](t, c.mustDo("GET", "/books/"+itoa(id), nil, 200)).Reads
	}
	return decode[movieDetail](t, c.mustDo("GET", "/movies/"+itoa(id), nil, 200)).Reads
}

func TestAPastReadCanBeRecordedEditedAndRemoved(t *testing.T) {
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "Read Long Ago",
	}, http.StatusCreated))

	// Record a read that predates the account entirely.
	got := decode[readRow](t, c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
		"started_at": "2009", "finished_at": "2009-06", "outcome": "finished",
	}, http.StatusCreated))
	if got.StartedAt != "2009" || got.FinishedAt != "2009-06" || got.Outcome != "finished" {
		t.Fatalf("created read = %+v", got)
	}
	if rs := readsOf(t, c, "books", book.ID); len(rs) != 1 || rs[0].ID != got.ID {
		t.Fatalf("reads = %+v", rs)
	}

	// Correct it. Partial dates are kept partial — "I read it in 2009" is a real
	// answer and padding it to a January morning would invent a precision that
	// was never there.
	c.mustDo("PUT", "/reads/"+itoa(got.ID), map[string]any{
		"started_at": "2009-03", "finished_at": "2009-06-14", "outcome": "abandoned",
	}, http.StatusOK)
	rs := readsOf(t, c, "books", book.ID)
	if len(rs) != 1 || rs[0].StartedAt != "2009-03" || rs[0].Outcome != "abandoned" {
		t.Fatalf("after edit: %+v", rs)
	}

	c.mustDo("DELETE", "/reads/"+itoa(got.ID), nil, http.StatusNoContent)
	if rs := readsOf(t, c, "books", book.ID); len(rs) != 0 {
		t.Fatalf("after delete: %+v", rs)
	}
}

func TestTheOpenReadIsTheShelfsToOwn(t *testing.T) {
	// The design of the whole feature. shelf.go keeps the status and the log
	// consistent through one path, and the open row IS that consistency — it
	// exists exactly while the work is in progress. Deleting it would leave a
	// book reading with nothing being read; closing it by hand would leave one
	// finished and still on the in-progress shelf.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "In Progress",
	}, http.StatusCreated))
	c.mustDo("PUT", "/books/"+itoa(book.ID)+"/status", map[string]any{
		"status": "reading", "started_at": "2026-01-02",
	}, http.StatusOK)

	rs := readsOf(t, c, "books", book.ID)
	if len(rs) != 1 || rs[0].Outcome != "open" {
		t.Fatalf("expected one open read, got %+v", rs)
	}
	open := rs[0].ID

	c.mustDo("PUT", "/reads/"+itoa(open), map[string]any{
		"started_at": "2020", "outcome": "finished",
	}, http.StatusConflict)
	c.mustDo("DELETE", "/reads/"+itoa(open), nil, http.StatusConflict)

	// Untouched, and the status control still works on it.
	if rs := readsOf(t, c, "books", book.ID); len(rs) != 1 || rs[0].Outcome != "open" || rs[0].StartedAt != "2026-01-02" {
		t.Fatalf("the open read was changed: %+v", rs)
	}
}

func TestAnOpenReadCannotBeCreatedByHandEither(t *testing.T) {
	// The same rule from the other direction: two open reads on one book would
	// be a state the status machine can neither produce nor resolve.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "B"}, http.StatusCreated))
	for _, outcome := range []any{"open", ""} {
		c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
			"started_at": "2020", "outcome": outcome,
		}, http.StatusBadRequest)
	}
}

func TestAReadThatEndedBeforeItBeganIsRefused(t *testing.T) {
	// Nothing downstream would ever complain about this; it would simply sort
	// oddly forever. Partial dates compare lexically, which is what makes the
	// check valid across all three shapes.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "B"}, http.StatusCreated))
	c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
		"started_at": "2020-06", "finished_at": "2019", "outcome": "finished",
	}, http.StatusBadRequest)
	// And the boundary is inclusive — same day is fine, and so is same year.
	c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
		"started_at": "2020", "finished_at": "2020", "outcome": "finished",
	}, http.StatusCreated)
}

func TestReadHistoryIsPerUser(t *testing.T) {
	// work_reads carries its own user_id and has NO foreign key to books or
	// movies — 0024 says SQLite could not express it across the two tables — so
	// nothing but this check stops a read being hung on somebody else's shelf.
	h := newTestServer(t).Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	hers := decode[bookDetail](t, alice.mustDo("POST", "/books", map[string]any{"title": "Hers"}, http.StatusCreated))
	// Bob cannot attach a read to Alice's book, and must not learn it exists.
	bob.mustDo("POST", "/books/"+itoa(hers.ID)+"/reads", map[string]any{
		"started_at": "2020", "outcome": "finished",
	}, http.StatusNotFound)

	mine := decode[readRow](t, alice.mustDo("POST", "/books/"+itoa(hers.ID)+"/reads", map[string]any{
		"started_at": "2020", "outcome": "finished",
	}, http.StatusCreated))
	// And cannot touch the row once it exists. 404, never 403: a 403 would
	// confirm the id is real.
	bob.mustDo("PUT", "/reads/"+itoa(mine.ID), map[string]any{
		"started_at": "1999", "outcome": "finished",
	}, http.StatusNotFound)
	bob.mustDo("DELETE", "/reads/"+itoa(mine.ID), nil, http.StatusNotFound)

	if rs := readsOf(t, alice, "books", hers.ID); len(rs) != 1 || rs[0].StartedAt != "2020" {
		t.Fatalf("alice's read was changed: %+v", rs)
	}
}

func TestEditingHistoryMovesTheLastReadSort(t *testing.T) {
	// The reason this is a fix. 1.7.2 made the Library sortable by last read;
	// correcting the log has to move the shelf, or the sort is a claim about
	// data you cannot reach.
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "B"}, http.StatusCreated))

	r := decode[readRow](t, c.mustDo("POST", "/books/"+itoa(book.ID)+"/reads", map[string]any{
		"started_at": "2009", "finished_at": "2009-06", "outcome": "finished",
	}, http.StatusCreated))
	if got := bookNamed(t, c, "B").LastReadAt; got != "2009-06" {
		t.Fatalf("last_read_at = %q, want 2009-06", got)
	}
	c.mustDo("PUT", "/reads/"+itoa(r.ID), map[string]any{
		"started_at": "2024", "finished_at": "2024-11", "outcome": "finished",
	}, http.StatusOK)
	if got := bookNamed(t, c, "B").LastReadAt; got != "2024-11" {
		t.Fatalf("last_read_at = %q after the correction, want 2024-11", got)
	}
	c.mustDo("DELETE", "/reads/"+itoa(r.ID), nil, http.StatusNoContent)
	if got := bookNamed(t, c, "B").LastReadAt; got != "" {
		t.Fatalf("last_read_at = %q after deleting the only read, want empty", got)
	}
}

func TestAWatchHistoryWorksTheSameWay(t *testing.T) {
	// A show is a movie row, as everywhere; the only difference is the noun.
	h := newTestServer(t).Handler()
	c := signupAdmin(t, h)
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "F"}, http.StatusCreated))
	got := decode[readRow](t, c.mustDo("POST", "/movies/"+itoa(film.ID)+"/reads", map[string]any{
		"started_at": "2015-08-01", "finished_at": "2015-08-01", "outcome": "finished",
	}, http.StatusCreated))
	if rs := readsOf(t, c, "movies", film.ID); len(rs) != 1 || rs[0].ID != got.ID {
		t.Fatalf("watch history = %+v", rs)
	}
}
