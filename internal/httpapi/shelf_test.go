package httpapi

// Shelf status + read log (§3f). The lifecycle is where the interesting bugs
// would live — a status that disagrees with the log, a reread that overwrites the
// read it should follow, a re-import that un-marks what you are reading now — so
// these tests assert the bookkeeping rather than just the status field.

import (
	"net/http"
	"strings"
	"testing"
)

// setStatus is the one transition call, since every route funnels through it.
func setStatus(c *testClient, path string, body map[string]any, want int) *bookDetail {
	c.t.Helper()
	rec := c.mustDo("PUT", path+"/status", body, want)
	if want != http.StatusOK {
		return nil
	}
	b := decode[bookDetail](c.t, rec)
	return &b
}

func TestBookShelfLifecycle(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	rec := c.mustDo("POST", "/books", map[string]any{"title": "The Wide Margin"}, http.StatusCreated)
	book := decode[bookDetail](t, rec)
	if book.Status != "" || book.Progress != 0 || len(book.Reads) != 0 {
		t.Fatalf("a new book should be un-tracked: %+v", book)
	}
	path := "/books/" + itoa(book.ID)

	// Start reading: opens a read with the given start date, nothing finished yet.
	b := setStatus(c, path, map[string]any{"status": "reading", "started_at": "2026-07-02", "progress": 10}, http.StatusOK)
	if b.Status != "reading" || b.Progress != 10 {
		t.Fatalf("after starting: %+v", b)
	}
	if len(b.Reads) != 1 || b.Reads[0].StartedAt != "2026-07-02" || b.Reads[0].Outcome != "open" {
		t.Fatalf("starting should open one read: %+v", b.Reads)
	}

	// Pausing freezes progress and leaves the read open — coming back must not
	// start a second one.
	b = setStatus(c, path, map[string]any{"status": "paused", "progress": 40}, http.StatusOK)
	if b.Status != "paused" || b.Progress != 40 || len(b.Reads) != 1 || b.Reads[0].Outcome != "open" {
		t.Fatalf("pausing: %+v / %+v", b, b.Reads)
	}
	b = setStatus(c, path, map[string]any{"status": "reading", "progress": 40}, http.StatusOK)
	if len(b.Reads) != 1 {
		t.Fatalf("resuming a pause must continue the open read, got %d: %+v", len(b.Reads), b.Reads)
	}

	// Completing closes that read as finished and fills the bar, whatever
	// percentage the client last sent.
	b = setStatus(c, path, map[string]any{"status": "completed", "finished_at": "2026-08-01", "progress": 40}, http.StatusOK)
	if b.Status != "completed" || b.Progress != 100 {
		t.Fatalf("completing should fill to 100: %+v", b)
	}
	if len(b.Reads) != 1 || b.Reads[0].Outcome != "finished" || b.Reads[0].FinishedAt != "2026-08-01" {
		t.Fatalf("completing should close the read: %+v", b.Reads)
	}

	// From completed the only lifecycle move is starting again; pausing or
	// abandoning something already finished is refused.
	setStatus(c, path, map[string]any{"status": "paused"}, http.StatusConflict)
	setStatus(c, path, map[string]any{"status": "abandoned"}, http.StatusConflict)

	// A reread opens a SECOND read and starts progress over — the first read is
	// history and must survive untouched.
	b = setStatus(c, path, map[string]any{"status": "reading", "started_at": "2026-09", "progress": 80}, http.StatusOK)
	if b.Status != "reading" || b.Progress != 0 {
		t.Fatalf("a reread starts at 0: %+v", b)
	}
	if len(b.Reads) != 2 || b.Reads[0].FinishedAt != "2026-08-01" || b.Reads[1].StartedAt != "2026-09" {
		t.Fatalf("reread should append: %+v", b.Reads)
	}

	// Abandoning closes the open read as abandoned (not finished) and zeroes the
	// progress, so the count of reads stays honest.
	b = setStatus(c, path, map[string]any{"status": "abandoned", "finished_at": "2026-10-05"}, http.StatusOK)
	if b.Status != "abandoned" || b.Progress != 0 {
		t.Fatalf("abandoning zeroes progress: %+v", b)
	}
	if b.Reads[1].Outcome != "abandoned" || b.Reads[1].FinishedAt != "2026-10-05" {
		t.Fatalf("abandoning should close the open read as abandoned: %+v", b.Reads)
	}

	// The list's read_count counts finished reads only.
	items := decode[struct {
		Books []struct {
			Status    string `json:"status"`
			Progress  int    `json:"progress"`
			ReadCount int    `json:"read_count"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	if len(items.Books) != 1 || items.Books[0].ReadCount != 1 || items.Books[0].Status != "abandoned" {
		t.Fatalf("list row: %+v", items.Books)
	}

	// Clearing drops an OPEN read (nothing was tracked) but keeps closed ones.
	setStatus(c, path, map[string]any{"status": "reading", "started_at": "2026-11-01"}, http.StatusOK)
	b = setStatus(c, path, map[string]any{"status": ""}, http.StatusOK)
	if b.Status != "" || b.Progress != 0 {
		t.Fatalf("clearing: %+v", b)
	}
	if len(b.Reads) != 2 {
		t.Fatalf("clearing should drop only the open read, left %+v", b.Reads)
	}
}

// A completed work marked completed straight from un-tracked still gets a read
// row, so "read once" is countable even for a book finished before Tippani.
func TestShelfCompletedFromScratchLogsARead(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Read Long Ago"}, http.StatusCreated))
	b := setStatus(c, "/books/"+itoa(book.ID), map[string]any{"status": "completed", "finished_at": "2019"}, http.StatusOK)
	if len(b.Reads) != 1 || b.Reads[0].Outcome != "finished" || b.Reads[0].FinishedAt != "2019" {
		t.Fatalf("expected one finished read with a year-only date: %+v", b.Reads)
	}
	if b.Reads[0].StartedAt != "" {
		t.Fatalf("no start date was given, so none should be invented: %+v", b.Reads[0])
	}
}

func TestShelfValidation(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "V"}, http.StatusCreated))
	path := "/books/" + itoa(book.ID) + "/status"

	// A film's word for in-progress is not a book's, and vice versa.
	c.mustDo("PUT", path, map[string]any{"status": "watching"}, http.StatusBadRequest)
	// Nonsense statuses and half-dates are refused rather than stored.
	c.mustDo("PUT", path, map[string]any{"status": "finished"}, http.StatusBadRequest)
	c.mustDo("PUT", path, map[string]any{"status": "reading", "started_at": "2026-7-2"}, http.StatusBadRequest)
	c.mustDo("PUT", path, map[string]any{"status": "reading", "started_at": "2026-13"}, http.StatusBadRequest)
	c.mustDo("PUT", path, map[string]any{"status": "reading", "started_at": "26-07-02"}, http.StatusBadRequest)
	// Progress out of range is clamped, not rejected.
	b := setStatus(c, "/books/"+itoa(book.ID), map[string]any{"status": "reading", "progress": 420}, http.StatusOK)
	if b.Progress != 100 {
		t.Fatalf("progress should clamp to 100, got %d", b.Progress)
	}
	// The three partial shapes are all legal.
	for _, d := range []string{"2019", "2019-04", "2019-04-18"} {
		if b = setStatus(c, "/books/"+itoa(book.ID), map[string]any{"status": "completed", "finished_at": d}, http.StatusOK); b == nil {
			t.Fatalf("date %q should be accepted", d)
		}
		setStatus(c, "/books/"+itoa(book.ID), map[string]any{"status": ""}, http.StatusOK)
	}
}

func TestMovieShelfUsesWatching(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	m := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Northline", "media_type": "movie"}, http.StatusCreated))
	path := "/movies/" + itoa(m.ID) + "/status"
	c.mustDo("PUT", path, map[string]any{"status": "reading"}, http.StatusBadRequest)
	got := decode[movieDetail](t, c.mustDo("PUT", path, map[string]any{"status": "watching", "started_at": "2026-02-14"}, http.StatusOK))
	if got.Status != "watching" || len(got.Reads) != 1 || got.Reads[0].Outcome != "open" {
		t.Fatalf("movie shelf: %+v / %+v", got, got.Reads)
	}
	// Completed then rewatched: two rows, one finished.
	c.mustDo("PUT", path, map[string]any{"status": "completed", "finished_at": "2026-02-14"}, http.StatusOK)
	got = decode[movieDetail](t, c.mustDo("PUT", path, map[string]any{"status": "watching", "started_at": "2026-03-01"}, http.StatusOK))
	if len(got.Reads) != 2 {
		t.Fatalf("rewatch should append a read: %+v", got.Reads)
	}
	list := decode[struct {
		Movies []struct {
			ReadCount int `json:"read_count"`
		} `json:"movies"`
	}](t, c.mustDo("GET", "/movies", nil, http.StatusOK))
	if len(list.Movies) != 1 || list.Movies[0].ReadCount != 1 {
		t.Fatalf("watch count: %+v", list.Movies)
	}
}

// The shelf cap is a client-side nudge: the server must never refuse a sixth
// book, or a second device would be told "no" for a rule the user can wave
// through anyway.
func TestShelfCapIsNotEnforcedByTheServer(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	for i := 0; i < shelfCap("book", "")+3; i++ {
		b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Book " + itoa(int64(i))}, http.StatusCreated))
		setStatus(c, "/books/"+itoa(b.ID), map[string]any{"status": "reading", "started_at": "2026-07-02"}, http.StatusOK)
	}
	list := decode[struct {
		Books []struct {
			Status string `json:"status"`
		} `json:"books"`
	}](t, c.mustDo("GET", "/books", nil, http.StatusOK))
	reading := 0
	for _, b := range list.Books {
		if b.Status == "reading" {
			reading++
		}
	}
	if reading != shelfCap("book", "")+3 {
		t.Fatalf("server should have accepted every start, got %d reading", reading)
	}
}

// Ownership: one user's status endpoint must not reach another's work, and a
// deleted work takes its read log with it (the 0024 triggers).
func TestShelfIsolationAndCascade(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	b := decode[bookDetail](t, admin.mustDo("POST", "/books", map[string]any{"title": "Mine"}, http.StatusCreated))
	setStatus(admin, "/books/"+itoa(b.ID), map[string]any{"status": "reading", "started_at": "2026-07-02"}, http.StatusOK)
	bob.mustDo("PUT", "/books/"+itoa(b.ID)+"/status", map[string]any{"status": "completed"}, http.StatusNotFound)

	var reads int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM work_reads`).Scan(&reads); err != nil {
		t.Fatal(err)
	}
	if reads != 1 {
		t.Fatalf("expected one read row, got %d", reads)
	}
	admin.mustDo("DELETE", "/books/"+itoa(b.ID), nil, http.StatusOK)
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM work_reads`).Scan(&reads); err != nil {
		t.Fatal(err)
	}
	if reads != 0 {
		t.Fatalf("deleting the book should have dropped its read log, %d left", reads)
	}
}

// Export → re-import keeps the shelf and the whole read history, which is the
// promise the frontmatter keys exist for.
func TestShelfExportImportRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{
		"title": "The Wide Margin", "author": "A. Whitfield",
	}, http.StatusCreated))
	path := "/books/" + itoa(b.ID)
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b.ID, "quote": "A line worth keeping."}, http.StatusCreated)
	// Two finished reads (one year-only), then a third in progress at 35%.
	setStatus(c, path, map[string]any{"status": "reading", "started_at": "2019-03-04"}, http.StatusOK)
	setStatus(c, path, map[string]any{"status": "completed", "finished_at": "2019-04-01"}, http.StatusOK)
	setStatus(c, path, map[string]any{"status": "reading", "started_at": "2021"}, http.StatusOK)
	setStatus(c, path, map[string]any{"status": "completed", "finished_at": "2021-02"}, http.StatusOK)
	setStatus(c, path, map[string]any{"status": "reading", "started_at": "2026-07"}, http.StatusOK)
	// A reread starts at 0, so the 35% is a separate progress update afterwards —
	// which is exactly how the UI does it (the progress field, status unchanged).
	setStatus(c, path, map[string]any{"status": "reading", "progress": 35}, http.StatusOK)

	md := c.mustDo("GET", path+"/export", nil, http.StatusOK).Body.String()
	for _, want := range []string{"status: reading", "progress: 35%", "reads: 2019-03-04 — 2019-04-01; 2021 — 2021-02; 2026-07 —"} {
		if !strings.Contains(md, want) {
			t.Fatalf("export missing %q:\n%s", want, md)
		}
	}

	// Re-import into a second account: the shelf and all three reads land.
	bob := addUser(t, h, c, "carol")
	if rec := bob.importApprove("/import/markdown", "shelf.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body)
	}
	list := decode[struct {
		Books []struct {
			ID       int64  `json:"id"`
			Status   string `json:"status"`
			Progress int    `json:"progress"`
		} `json:"books"`
	}](t, bob.mustDo("GET", "/books", nil, http.StatusOK))
	if len(list.Books) != 1 || list.Books[0].Status != "reading" || list.Books[0].Progress != 35 {
		t.Fatalf("imported shelf: %+v", list.Books)
	}
	got := decode[bookDetail](t, bob.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if len(got.Reads) != 3 {
		t.Fatalf("expected three reads, got %+v", got.Reads)
	}
	if got.Reads[0].StartedAt != "2019-03-04" || got.Reads[0].Outcome != "finished" {
		t.Fatalf("first read: %+v", got.Reads[0])
	}
	if got.Reads[1].StartedAt != "2021" || got.Reads[1].FinishedAt != "2021-02" {
		t.Fatalf("year-only precision should survive: %+v", got.Reads[1])
	}
	if got.Reads[2].Outcome != "open" || got.Reads[2].FinishedAt != "" {
		t.Fatalf("the open read should still be open: %+v", got.Reads[2])
	}

	// Re-importing the same file must not duplicate the history, nor un-mark a
	// status the user has since changed by hand.
	setStatus(bob, "/books/"+itoa(list.Books[0].ID), map[string]any{"status": "paused"}, http.StatusOK)
	if rec := bob.importApprove("/import/markdown", "shelf.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("second import: %d %s", rec.Code, rec.Body)
	}
	again := decode[bookDetail](t, bob.mustDo("GET", "/books/"+itoa(list.Books[0].ID), nil, http.StatusOK))
	if len(again.Reads) != 3 {
		t.Fatalf("re-import duplicated the read log: %+v", again.Reads)
	}
	if again.Status != "paused" {
		t.Fatalf("re-import overwrote a hand-set status: %q", again.Status)
	}
}

// Counting in pages: the percentage is DERIVED, so a physical book's page number
// is the authoritative input and nothing can disagree about the bar.
func TestBookProgressByPage(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	book := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "A Physical Book"}, http.StatusCreated))
	path := "/books/" + itoa(book.ID)

	// A page with no total cannot become a percentage, so it is refused.
	c.mustDo("PUT", path+"/status", map[string]any{
		"status": "reading", "pos_unit": "page", "pos": 96,
	}, http.StatusBadRequest)
	// Past the end is refused too.
	c.mustDo("PUT", path+"/status", map[string]any{
		"status": "reading", "pos_unit": "page", "pos": 300, "pos_total": 214,
	}, http.StatusBadRequest)
	// Books have no episodes.
	c.mustDo("PUT", path+"/status", map[string]any{
		"status": "reading", "pos_unit": "episode", "pos": 1, "pos_total": 10,
	}, http.StatusBadRequest)

	// 96 of 214 is 45%, and the client's own percentage is ignored when a position
	// is given — one number, derived, never two that can drift.
	b := setStatus(c, path, map[string]any{
		"status": "reading", "started_at": "2026-07-02",
		"pos_unit": "page", "pos": 96, "pos_total": 214, "progress": 3,
	}, http.StatusOK)
	if b.Progress != 45 || b.Unit != "page" || b.Pos != 96 || b.PosTotal != 214 {
		t.Fatalf("page position: %+v", b)
	}
	// Finishing moves to the last page rather than leaving the count mid-book
	// beside a full bar.
	b = setStatus(c, path, map[string]any{
		"status": "completed", "finished_at": "2026-08-01",
		"pos_unit": "page", "pos": 96, "pos_total": 214,
	}, http.StatusOK)
	if b.Progress != 100 || b.Pos != 214 {
		t.Fatalf("completing should land on the last page: %+v", b)
	}
	// A reread returns to page 0 and keeps the page count.
	b = setStatus(c, path, map[string]any{
		"status": "reading", "started_at": "2026-09", "pos_unit": "page", "pos": 214, "pos_total": 214,
	}, http.StatusOK)
	if b.Progress != 0 || b.Pos != 0 || b.PosTotal != 214 {
		t.Fatalf("a reread starts at page 0 of the same book: %+v", b)
	}
	// Switching back to percent clears the counters rather than leaving stale ones.
	b = setStatus(c, path, map[string]any{"status": "reading", "progress": 30}, http.StatusOK)
	if b.Progress != 30 || b.Unit != "" || b.PosTotal != 0 {
		t.Fatalf("switching to percent should clear the position: %+v", b)
	}
}

// A show is positioned in two dimensions, so whole earlier seasons count in full
// and the bar advances monotonically through a run.
func TestShowProgressBySeasonAndEpisode(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	show := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Reel Seven", "media_type": "show",
	}, http.StatusCreated))
	film := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{
		"title": "Northline", "media_type": "movie",
	}, http.StatusCreated))

	// Season 2 of 3, episode 6 of 10 → ((2-1) + 0.6) / 3 = 53%.
	got := decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(show.ID)+"/status", map[string]any{
		"status": "watching", "started_at": "2026-07-28",
		"pos_unit": "episode", "pos": 6, "pos_total": 10, "season": 2, "season_total": 3,
	}, http.StatusOK))
	if got.Progress != 53 || got.Season != 2 || got.Pos != 6 {
		t.Fatalf("show position: %+v", got)
	}
	// Episode 10 of 10 in the last season is the end of the run.
	got = decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(show.ID)+"/status", map[string]any{
		"status": "watching", "pos_unit": "episode", "pos": 10, "pos_total": 10, "season": 3, "season_total": 3,
	}, http.StatusOK))
	if got.Progress != 100 {
		t.Fatalf("the last episode of the last season is 100%%, got %d", got.Progress)
	}
	// A season past the total, or a season with no total, is refused.
	c.mustDo("PUT", "/movies/"+itoa(show.ID)+"/status", map[string]any{
		"status": "watching", "pos_unit": "episode", "pos": 1, "pos_total": 10, "season": 9, "season_total": 3,
	}, http.StatusBadRequest)
	c.mustDo("PUT", "/movies/"+itoa(show.ID)+"/status", map[string]any{
		"status": "watching", "pos_unit": "episode", "pos": 1, "pos_total": 10, "season": 2,
	}, http.StatusBadRequest)
	// A FILM has neither pages nor episodes: percent only.
	c.mustDo("PUT", "/movies/"+itoa(film.ID)+"/status", map[string]any{
		"status": "watching", "pos_unit": "episode", "pos": 1, "pos_total": 10,
	}, http.StatusBadRequest)
	gotFilm := decode[movieDetail](t, c.mustDo("PUT", "/movies/"+itoa(film.ID)+"/status", map[string]any{
		"status": "watching", "progress": 40,
	}, http.StatusOK))
	if gotFilm.Progress != 40 {
		t.Fatalf("a film tracks in percent: %+v", gotFilm)
	}
}

// The page/season/episode position survives an export → re-import too.
func TestPositionRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)

	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Paged"}, http.StatusCreated))
	c.mustDo("POST", "/annotations", map[string]any{"book_id": b.ID, "quote": "A line."}, http.StatusCreated)
	setStatus(c, "/books/"+itoa(b.ID), map[string]any{
		"status": "reading", "started_at": "2026-07-02", "pos_unit": "page", "pos": 96, "pos_total": 214,
	}, http.StatusOK)
	md := c.mustDo("GET", "/books/"+itoa(b.ID)+"/export", nil, http.StatusOK).Body.String()
	if !strings.Contains(md, "page: 96/214") {
		t.Fatalf("book export missing the page position:\n%s", md)
	}

	show := decode[movieDetail](t, c.mustDo("POST", "/movies", map[string]any{"title": "Reeled", "media_type": "show"}, http.StatusCreated))
	c.mustDo("POST", "/dialogues", map[string]any{"movie_id": show.ID, "quote": "A said thing."}, http.StatusCreated)
	c.mustDo("PUT", "/movies/"+itoa(show.ID)+"/status", map[string]any{
		"status": "watching", "started_at": "2026-07-28",
		"pos_unit": "episode", "pos": 6, "pos_total": 10, "season": 2, "season_total": 3,
	}, http.StatusOK)
	showMD := c.mustDo("GET", "/movies/"+itoa(show.ID)+"/export", nil, http.StatusOK).Body.String()
	for _, want := range []string{"season: 2/3", "episode: 6/10"} {
		if !strings.Contains(showMD, want) {
			t.Fatalf("show export missing %q:\n%s", want, showMD)
		}
	}

	// Re-import both into a fresh account and check the positions came back.
	bob := addUser(t, h, c, "dave")
	if rec := bob.importApprove("/import/markdown", "paged.md", []byte(md)); rec.Code != http.StatusOK {
		t.Fatalf("book import: %d %s", rec.Code, rec.Body)
	}
	if rec := bob.importApprove("/import/markdown", "reeled.md", []byte(showMD)); rec.Code != http.StatusOK {
		t.Fatalf("show import: %d %s", rec.Code, rec.Body)
	}
	books := decode[struct {
		Books []struct {
			ID       int64 `json:"id"`
			Progress int   `json:"progress"`
		} `json:"books"`
	}](t, bob.mustDo("GET", "/books", nil, http.StatusOK))
	gotBook := decode[bookDetail](t, bob.mustDo("GET", "/books/"+itoa(books.Books[0].ID), nil, http.StatusOK))
	if gotBook.Unit != "page" || gotBook.Pos != 96 || gotBook.PosTotal != 214 || gotBook.Progress != 45 {
		t.Fatalf("imported page position: %+v", gotBook)
	}
	movies := decode[struct {
		Movies []struct {
			ID int64 `json:"id"`
		} `json:"movies"`
	}](t, bob.mustDo("GET", "/movies", nil, http.StatusOK))
	gotShow := decode[movieDetail](t, bob.mustDo("GET", "/movies/"+itoa(movies.Movies[0].ID), nil, http.StatusOK))
	if gotShow.Unit != "episode" || gotShow.Pos != 6 || gotShow.Season != 2 || gotShow.SeasonTotal != 3 || gotShow.Progress != 53 {
		t.Fatalf("imported episode position: %+v", gotShow)
	}
}

// An un-tracked work writes none of the shelf keys, so an ordinary export
// looks exactly as it did before the feature.
func TestExportOmitsShelfKeysWhenUntracked(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	b := decode[bookDetail](t, c.mustDo("POST", "/books", map[string]any{"title": "Plain"}, http.StatusCreated))
	md := c.mustDo("GET", "/books/"+itoa(b.ID)+"/export", nil, http.StatusOK).Body.String()
	for _, key := range []string{"status:", "progress:", "page:", "reads:"} {
		if strings.Contains(md, key) {
			t.Fatalf("un-tracked export should not mention %q:\n%s", key, md)
		}
	}
}
