package httpapi

import (
	"net/http"
	"testing"
)

// last_read_at — the date the Library's "Last read" and the Catalogue's "Last
// watched" sort on.
//
// It is not readCounts with a different aggregate. That one asks how many times
// you got to the end and is right to count only finished reads; this asks when
// you last had the thing in your hands, and an abandoned attempt in November is
// an answer to it. Two questions, two queries, and conflating them produces a
// sort that silently ignores the book you gave up on last week.

type lastReadItem struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	ReadCount  int    `json:"read_count"`
	LastReadAt string `json:"last_read_at"`
}

func listBooksRaw(t *testing.T, c *testClient) []lastReadItem {
	t.Helper()
	return decode[struct {
		Books []lastReadItem `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, 200)).Books
}

func bookNamed(t *testing.T, c *testClient, title string) lastReadItem {
	t.Helper()
	for _, b := range listBooksRaw(t, c) {
		if b.Title == title {
			return b
		}
	}
	t.Fatalf("no book titled %q", title)
	return lastReadItem{}
}

// addRead writes one row of read history straight to the table. The API for
// this is a status change with a date, which would tie the test to the shelf
// state machine — and the thing under test is an aggregate over rows, so rows
// are what it should be given.
func addRead(t *testing.T, srv *Server, uid, bookID int64, started, finished, outcome string) {
	t.Helper()
	if _, err := srv.Store.DB.Exec(
		`INSERT INTO work_reads (user_id, kind, work_id, started_at, finished_at, outcome)
		 VALUES (?, 'book', ?, ?, ?, ?)`, uid, bookID, started, finished, outcome); err != nil {
		t.Fatal(err)
	}
}

func TestLastReadAtIsTheMostRecentTimeYouHadIt(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	uid := int64(1)

	mk := func(title string) int64 {
		return decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": title}, http.StatusCreated)).ID
	}

	// Read twice; the later finish wins, not the first one and not the row order.
	twice := mk("Read Twice")
	addRead(t, srv, uid, twice, "2024-01-01", "2024-02-01", "finished")
	addRead(t, srv, uid, twice, "2019-01-01", "2019-03-01", "finished")

	// Still open: no finish date, and it is the one most recently in your hands.
	// Sorting on finished_at alone files the book you are reading under "never".
	open := mk("Currently Open")
	addRead(t, srv, uid, open, "2025-05-01", "", "open")

	// Abandoned counts. You had it; you put it down; that is a date.
	quit := mk("Given Up On")
	addRead(t, srv, uid, quit, "2023-06-01", "2023-07-15", "abandoned")

	// Never read at all — the majority case in a library that exists to hold
	// quotes rather than to track reading.
	mk("Never Read")

	// A read with no dates on it whatsoever. Undated is not a date, and an empty
	// string that reached the client would sort as one.
	undated := mk("Undated Read")
	addRead(t, srv, uid, undated, "", "", "finished")

	// The schema stores 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' and relies on them
	// sorting lexically against each other. MAX() over the mixed shapes is only
	// meaningful because of that, so the last two books say so.
	mixed := mk("Mixed precision")
	addRead(t, srv, uid, mixed, "", "2019", "finished")
	addRead(t, srv, uid, mixed, "", "2019-05", "finished")

	// A longer string is not a later date: 2020 beats 2019-12-31.
	later := mk("Mixed with a later year")
	addRead(t, srv, uid, later, "", "2019", "finished")
	addRead(t, srv, uid, later, "", "2019-05", "finished")
	addRead(t, srv, uid, later, "", "2020", "finished")

	for _, want := range []struct{ title, at string }{
		{"Read Twice", "2024-02-01"},
		{"Currently Open", "2025-05-01"},
		{"Given Up On", "2023-07-15"},
		{"Never Read", ""},
		{"Undated Read", ""},
		{"Mixed precision", "2019-05"},
		{"Mixed with a later year", "2020"},
	} {
		t.Run(want.title, func(t *testing.T) {
			sub := &testClient{t: t, h: h, cookie: c.cookie}
			if got := bookNamed(t, sub, want.title).LastReadAt; got != want.at {
				t.Errorf("%s: last_read_at = %q, want %q", want.title, got, want.at)
			}
		})
	}

	// And the counter it sits beside still answers its own question: only
	// finished reads count towards "read twice", so the abandoned one is 0 and
	// the open one is 0 even though both have dates.
	if n := bookNamed(t, c, "Read Twice").ReadCount; n != 2 {
		t.Errorf("read_count for the twice-read book = %d, want 2", n)
	}
	if n := bookNamed(t, c, "Given Up On").ReadCount; n != 0 {
		t.Errorf("an abandoned read counted as finished: %d", n)
	}
}

// The map's own contract, tested directly rather than through the response.
//
// Written because a mutation survived: loosening the "" filter changed nothing
// visible, since a map miss and a stored "" both serialise to the same empty
// JSON field. The filter is still worth having — the map says "works with a
// date", and a caller that ranges over it should not have to re-check — but a
// guard nothing can observe is a guard nobody will keep. This observes it.
func TestLastReadAtHoldsOnlyWorksWithADate(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())
	uid := int64(1)
	mk := func(title string) int64 {
		return decode[bookDetail](t, c.mustDo("POST", "/books",
			map[string]any{"title": title}, http.StatusCreated)).ID
	}
	dated, undated, never := mk("Dated"), mk("Undated"), mk("Never")
	addRead(t, srv, uid, dated, "2024-01-01", "2024-02-01", "finished")
	addRead(t, srv, uid, undated, "", "", "finished") // a read happened; no date was kept

	m, err := srv.lastReadAt(uid, "book")
	if err != nil {
		t.Fatal(err)
	}
	if m[dated] != "2024-02-01" {
		t.Errorf("dated work: %q", m[dated])
	}
	if _, ok := m[undated]; ok {
		t.Errorf("a read with no dates put an entry in the map: %q", m[undated])
	}
	if _, ok := m[never]; ok {
		t.Error("a work that was never read put an entry in the map")
	}
}

func TestLastReadAtIsPerUser(t *testing.T) {
	// work_reads carries its own user_id and the aggregate is grouped by work,
	// so a missing owner filter would let one account's history date another
	// account's shelf — the sort would be wrong, and it would be wrong with
	// somebody else's data.
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	mine := decode[bookDetail](t, alice.mustDo("POST", "/books",
		map[string]any{"title": "Hers"}, http.StatusCreated)).ID
	addRead(t, srv, 1, mine, "2024-01-01", "2024-02-01", "finished")

	his := decode[bookDetail](t, bob.mustDo("POST", "/books",
		map[string]any{"title": "His"}, http.StatusCreated)).ID
	// Alice's history against Bob's book id: nothing about it may reach Bob.
	addRead(t, srv, 1, his, "2030-01-01", "2030-01-01", "finished")

	for _, b := range listBooksRaw(t, bob) {
		if b.LastReadAt != "" {
			t.Fatalf("bob's %q picked up alice's read history: %q", b.Title, b.LastReadAt)
		}
	}
	if got := bookNamed(t, alice, "Hers").LastReadAt; got != "2024-02-01" {
		t.Fatalf("alice lost her own history: %q", got)
	}
}
