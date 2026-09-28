package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"tippani/internal/metadata"
)

// THE COMMON JOBS: the rows of Settings › Jobs' Common jobs card, read as the
// card reads them (GET /jobs/common), and the two jobs only that card starts —
// "Fill gaps in every work" (a fill of {all: true}) and "Fetch missing people" (a
// people fetch of {missing: true}) — started as its Run starts them, watched as
// Settings › Jobs watches them, and the library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it, with the test's kinds
//     (queueing, jobs_api_test.go): a job the test holds running until it lets go
//     (test.hold), so the job under test waits behind it and can be pressed while
//     it waits, and one that logs a few lines and ends (test.lines), queued behind
//     it, to show the queue carries on after a Stop;
//   - the book supplier and Open Library's author resolution are the server's
//     seams (srv.searchBooks, srv.resolveAuthor) and the portrait download is
//     srv.fetchImage (downloads), because a test may not reach the real ones; a
//     gate on them holds one question mid-answer, as a slow supplier would, or
//     presses Stop from inside it and then answers, so that Stop lands with an
//     item's lookup on the wire or after it and before the item's write;
//   - a covers pass's suppliers are covers_pass_test.go's (coversLibrary: TMDB
//     pointed at a stub, and srv.fetchImage), with one poster held mid-download,
//     so that one pass of the row runs while the row's other waits behind it;
//   - the data directory is listed after a Stop, for a file nothing names: a
//     portrait left behind by an abandoned fetch is on no screen, so nothing a
//     person can see could say it is there;
//   - the wire fields, which are the contract the card is built to.
//
// What each one guards, in a sentence a person would say: an admin's card lists
// four common jobs and a reader's the two they may run, each with the last time it
// ended and the one running or waiting now — the running one, when another of
// the row's waits behind it — the reader's own, but the backup the server's,
// whoever made it; a fill of every work fills the library as it is when
// the fill runs, a work added while it waited included, and nobody else's; a fetch
// of missing people fetches exactly the records the People console says are
// missing links or a photo, as they are when it runs; and either one, stopped
// while it waits, inside an item's lookup, or after the lookup and before the
// write, leaves every item whole or untouched and no file behind, lets the job
// behind it run, and runs again to the end.

// commonRow is one row of the card, as GET /jobs/common answers it.
type commonRow struct {
	ID        string         `json:"id"`
	Kind      string         `json:"kind"`
	Params    map[string]any `json:"params"`
	AdminOnly bool           `json:"admin_only"`
	Last      *wireJob       `json:"last"`
	Current   *wireJob       `json:"current"`
}

// commonRows is the card's rows for c, each checked to carry exactly the wire
// contract's fields.
func commonRows(t *testing.T, c *testClient) []commonRow {
	t.Helper()
	rec := c.mustDo("GET", "/jobs/common", nil, http.StatusOK)
	raw := decode[struct {
		Jobs []json.RawMessage `json:"jobs"`
	}](t, rec)
	for i, r := range raw.Jobs {
		shaped(t, fmt.Sprintf("common job %d", i), r, "id", "kind", "params", "admin_only", "last", "current")
	}
	return decode[struct {
		Jobs []commonRow `json:"jobs"`
	}](t, rec).Jobs
}

// commonRowOf is c's row named id; it fails the test when c's card has none.
func commonRowOf(t *testing.T, c *testClient, id string) commonRow {
	t.Helper()
	for _, r := range commonRows(t, c) {
		if r.ID == id {
			return r
		}
	}
	t.Fatalf("the card has no %s row", id)
	return commonRow{}
}

func lastID(r commonRow) int64 {
	if r.Last == nil {
		return 0
	}
	return r.Last.ID
}

func currentID(r commonRow) int64 {
	if r.Current == nil {
		return 0
	}
	return r.Current.ID
}

func TestTheCommonJobsAreTheRowsAReaderMayRunEachWithItsLastRunAndTheOneNow(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")
	alice.mustDo("PATCH", "/admin/users/"+itoa(accountID(t, alice, "carol")), map[string]bool{"is_admin": true}, http.StatusOK)

	// An admin's four, in the card's order, each with the params its Run sends; a
	// reader's the two they may run. Nothing has run, so nothing is last or now.
	want := []struct {
		id, kind string
		admin    bool
		params   string
	}{
		{"fill-all", "fill", false, `map[all:true]`},
		{"people-missing", "people", false, `map[missing:true]`},
		{"covers", "covers", true, `map[missing_only:false]`},
		{"backup", "backup", true, `map[]`},
	}
	rows := commonRows(t, alice)
	if len(rows) != len(want) {
		t.Fatalf("an admin's card has %d rows, want %d: %+v", len(rows), len(want), rows)
	}
	for i, w := range want {
		r := rows[i]
		if r.ID != w.id || r.Kind != w.kind || r.AdminOnly != w.admin || fmt.Sprint(r.Params) != w.params ||
			r.Last != nil || r.Current != nil {
			t.Fatalf("an admin's row %d is %+v, want %+v and nothing run", i, r, w)
		}
	}
	var readers []string
	for _, r := range commonRows(t, bob) {
		readers = append(readers, r.ID)
	}
	if !slices.Equal(readers, []string{"fill-all", "people-missing"}) {
		t.Fatalf("a reader's card has %v, want the two a reader may run", readers)
	}

	// Bob's fill of every work waits behind a job of alice's: it is his row's
	// job now, saying where it stands, and nothing on alice's card.
	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")
	all := bob.mustStart("fill", map[string]any{"all": true})
	row := commonRowOf(t, bob, "fill-all")
	if currentID(row) != all.ID || row.Current.State != "queued" || row.Current.Ahead != 1 || !row.Current.Own || row.Last != nil {
		t.Fatalf("bob's row while his fill waits: %+v", row)
	}
	if r := commonRowOf(t, alice, "fill-all"); r.Current != nil || r.Last != nil {
		t.Fatalf("alice's row shows bob's fill: %+v", r)
	}
	// A fill of a selection is a fill, and not this row's.
	book := createdID(t, bob, "/books", map[string]any{"title": "Bob's book", "author": "Someone"})
	sel := bob.mustStart("fill", map[string]any{"book_ids": []int64{book}})
	bob.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", all.ID), nil, http.StatusOK)
	bob.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", sel.ID), nil, http.StatusOK)
	row = commonRowOf(t, bob, "fill-all")
	if row.Current != nil || lastID(row) != all.ID || row.Last.State != "stopped" {
		t.Fatalf("bob's row after his fill of every work and then a selection's were stopped: %+v", row)
	}
	q.let()
	again := bob.waitJob(bob.mustStart("fill", map[string]any{"all": true}).ID, "succeeded")
	if lastID(commonRowOf(t, bob, "fill-all")) != again.ID {
		t.Fatalf("bob's row after his fill ran again: %+v", commonRowOf(t, bob, "fill-all"))
	}

	// The same for a fetch of every record missing something, and not for a
	// fetch of named records.
	named := bob.waitJob(bob.mustStart("people", map[string]any{"ids": []int64{1}}).ID, "succeeded")
	if r := commonRowOf(t, bob, "people-missing"); r.Last != nil {
		t.Fatalf("a people fetch of named records (#%d) is the row's: %+v", named.ID, r)
	}
	missing := bob.waitJob(bob.mustStart("people", map[string]any{"missing": true}).ID, "succeeded")
	if lastID(commonRowOf(t, bob, "people-missing")) != missing.ID {
		t.Fatalf("bob's people row: %+v", commonRowOf(t, bob, "people-missing"))
	}

	// A covers pass is the admin's own library's, so another admin's is not on
	// this admin's row; a Missing only pass is the row's as much as a full one.
	carols := carol.waitJob(carol.mustStart("covers", map[string]any{"missing_only": false}).ID, "succeeded")
	if r := commonRowOf(t, alice, "covers"); r.Last != nil {
		t.Fatalf("carol's covers pass (#%d) is on alice's row: %+v", carols.ID, r)
	}
	alices := alice.waitJob(alice.mustStart("covers", map[string]any{"missing_only": true}).ID, "succeeded")
	if lastID(commonRowOf(t, alice, "covers")) != alices.ID {
		t.Fatalf("alice's covers row after her Missing only pass: %+v", commonRowOf(t, alice, "covers"))
	}

	// The backup is the server's: the one archive, whoever sealed it, so carol's
	// backup is alice's row's last run too, under carol's name.
	backup := carol.waitJob(carol.mustStart("backup", map[string]any{"password": testPw}).ID, "succeeded")
	r := commonRowOf(t, alice, "backup")
	if lastID(r) != backup.ID || r.Last.Username != "carol" || r.Last.Own {
		t.Fatalf("alice's backup row after carol's backup: %+v", r)
	}
	if lastID(commonRowOf(t, carol, "backup")) != backup.ID {
		t.Fatalf("carol's backup row: %+v", commonRowOf(t, carol, "backup"))
	}
}

// THE ONE RUNNING NOW, NOT THE ONE WAITING BEHIND IT. The covers row is the only
// one that can have two jobs live at once, because it offers two runs (the whole
// pass and Missing only) and the queue takes each as its own job. The row's job
// now is the one its Stop should end: the pass in hand.
func TestACommonRowsJobNowIsTheOneRunningNotTheOneWaitingBehindIt(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	coversLibrary(t, srv, admin, nil, []int{603})
	download := srv.fetchImage
	asked, release := make(chan struct{}, 1), make(chan struct{})
	srv.fetchImage = func(ctx context.Context, rawURL, dir string) (string, error) {
		select {
		case asked <- struct{}{}:
			<-release // the first poster is slow to arrive
		default:
		}
		return download(ctx, rawURL, dir)
	}

	whole := admin.mustStart("covers", map[string]any{"missing_only": false})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the covers pass never asked for a poster")
	}
	quick := admin.mustStart("covers", map[string]any{"missing_only": true})
	row := commonRowOf(t, admin, "covers")
	if currentID(row) != whole.ID || row.Current.State != "running" {
		t.Fatalf("the covers row while its whole pass runs (#%d) and its Missing only waits (#%d): %+v", whole.ID, quick.ID, row.Current)
	}

	close(release)
	admin.waitJob(whole.ID, "succeeded")
	admin.waitJob(quick.ID, "succeeded")
	if row = commonRowOf(t, admin, "covers"); row.Current != nil || lastID(row) != quick.ID {
		t.Fatalf("the covers row once both passes ended: %+v", row)
	}
}

func TestAFillOfEveryWorkFillsTheLibraryAsItIsWhenTheFillRuns(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	duneSupplier(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	bobs := createdID(t, bob, "/books", map[string]any{"title": "Bob's Dune", "author": "Frank Herbert", "isbn": messiahISBN})

	if rec := alice.startJob("fill", map[string]any{"all": true, "book_ids": []int64{first}}); rec.Code != http.StatusBadRequest ||
		!strings.Contains(rec.Body.String(), "not both") {
		t.Fatalf("a fill of every work and of named works: %d %s", rec.Code, rec.Body)
	}
	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")
	job := alice.mustStart("fill", map[string]any{"all": true})
	if job.Total != 1 || fmt.Sprint(job.Params) != "map[all:true]" {
		t.Fatalf("the fill of every work, waiting: total %d, params %v", job.Total, job.Params)
	}
	if rec := alice.startJob("fill", map[string]any{"all": true}); rec.Code != http.StatusConflict ||
		!strings.Contains(rec.Body.String(), fmt.Sprintf(`"job_id":%d`, job.ID)) {
		t.Fatalf("the fill of every work pressed twice: %d %s", rec.Code, rec.Body)
	}
	// Added while the fill waits: a book with an ISBN to ask about, and a film
	// with no supplier pinned, which is a work too.
	added := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert", "isbn": messiahISBN})
	createdID(t, alice, "/movies", map[string]any{"title": "Arrival", "media_type": "movie"})
	q.let()

	done := alice.waitJob(job.ID, "succeeded")
	if done.Done != 3 || done.Total != 3 {
		t.Fatalf("the fill walked %d of %d works, want the three alice has when it ran", done.Done, done.Total)
	}
	countsAre(t, done, map[string]any{"fields": float64(4), "failed": float64(0), "unpinned": float64(1)})
	for _, id := range []int64{first, added} {
		if y, p := bookYearPages(t, alice, id); y != 1965 || p != 412 {
			t.Fatalf("book #%d after the fill of every work: year %d, pages %d", id, y, p)
		}
	}
	if y, p := bookYearPages(t, bob, bobs); y != 0 || p != 0 {
		t.Fatalf("bob's book was filled by alice's fill of every work: year %d, pages %d", y, p)
	}
	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info every work in the library as the fill starts: 2 books and 1 film, show or game",
		"info «Dune Messiah» — filled year, pages",
		"info «Arrival» — unpinned",
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the fill's log has no %q:\n%s", want, log)
		}
	}
	if strings.Contains(log, "Bob's Dune") {
		t.Errorf("alice's fill of every work names bob's book:\n%s", log)
	}
}

// bookYearPages is a book's year and pages as its page reads them.
func bookYearPages(t *testing.T, c *testClient, id int64) (year, pages int) {
	t.Helper()
	b := decode[struct {
		Year  int `json:"published_year"`
		Pages int `json:"pages"`
	}](t, c.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, http.StatusOK))
	return b.Year, b.Pages
}

// consoleRecord is a person record as the People console lists it.
type consoleRecord struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Bio       string `json:"bio"`
	ImagePath string `json:"image_path"`
	Links     string `json:"links"`
	Source    string `json:"source"`
	NoLinks   bool   `json:"no_links"`
	NoPhoto   bool   `json:"no_photo"`
}

func consoleRecords(t *testing.T, c *testClient) map[string]consoleRecord {
	t.Helper()
	out := map[string]consoleRecord{}
	for _, p := range decode[struct {
		People []consoleRecord `json:"people"`
	}](t, c.mustDo("GET", "/people/records", nil, http.StatusOK)).People {
		out[p.Name] = p
	}
	return out
}

// everyAuthorResolves makes Open Library know every author asked about, with a
// portrait and its page, and notes who was asked.
func everyAuthorResolves(srv *Server, g *supplierGate) (asked func() []string) {
	var mu sync.Mutex
	var names []string
	srv.resolveAuthor = func(ctx context.Context, name string, _ []string) (metadata.AuthorResolution, error) {
		mu.Lock()
		names = append(names, name)
		mu.Unlock()
		if g != nil {
			if err := g.wait(ctx, name); err != nil {
				return metadata.AuthorResolution{}, err
			}
		}
		key := "OL" + strings.ReplaceAll(name, " ", "") + "A"
		return metadata.AuthorResolution{
			Key: key, Name: name, Bio: name + " wrote books.",
			ImageURL: "https://covers.openlibrary.org/a/id/" + key + "-L.jpg",
			Links:    map[string]string{"openlibrary": "https://openlibrary.org/authors/" + key},
		}, nil
	}
	return func() []string {
		mu.Lock()
		defer mu.Unlock()
		out := slices.Clone(names)
		names = nil
		return out
	}
}

func TestAFetchOfMissingPeopleFetchesWhatTheConsoleSaysIsMissingAsItIsWhenItRuns(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	asked := everyAuthorResolves(srv, nil)
	downloads(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	names := []string{"Complete", "Named link only", "Provider link only", "Nothing yet", "Finished while it waits"}
	for _, name := range names {
		alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
	}
	bob.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Bob's author"}, http.StatusOK)
	id := func(name string) int64 { return recordID(t, alice, name) }
	alice.mustDo("POST", fmt.Sprintf("/people/id/%d/fetch", id("Complete")), nil, http.StatusOK)
	// A page of the reader's own is a link, and not a provider's: a fetch can
	// still find this record's.
	alice.mustDo("PUT", fmt.Sprintf("/people/id/%d", id("Named link only")),
		map[string]any{"links": "https://example.org/essays | Their essays"}, http.StatusOK)
	uploadPictureTo(t, alice, fmt.Sprintf("/people/id/%d/portrait", id("Named link only")), pngMagic, http.StatusOK)
	alice.mustDo("PUT", fmt.Sprintf("/people/id/%d", id("Provider link only")),
		map[string]any{"links": "https://www.imdb.com/name/nm0000123/"}, http.StatusOK)

	// What the console says each is missing — the pills it draws and what its
	// Fetch missing reaches.
	lacks := map[string][2]bool{
		"Complete": {false, false}, "Named link only": {true, false}, "Provider link only": {false, true},
		"Nothing yet": {true, true}, "Finished while it waits": {true, true},
	}
	records := consoleRecords(t, alice)
	for name, w := range lacks {
		if r := records[name]; r.NoLinks != w[0] || r.NoPhoto != w[1] {
			t.Fatalf("the console says %q lacks links %t and a photo %t, want %t and %t", name, r.NoLinks, r.NoPhoto, w[0], w[1])
		}
	}

	if rec := alice.startJob("people", map[string]any{"missing": true, "ids": []int64{id("Nothing yet")}}); rec.Code != http.StatusBadRequest ||
		!strings.Contains(rec.Body.String(), "not both") {
		t.Fatalf("a fetch of missing people and of named ones: %d %s", rec.Code, rec.Body)
	}
	ahead := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(ahead.ID, "running")
	job := alice.mustStart("people", map[string]any{"missing": true})
	if job.Total != 4 || fmt.Sprint(job.Params) != "map[missing:true]" {
		t.Fatalf("the fetch of missing people, waiting: total %d, params %v", job.Total, job.Params)
	}
	// The row's own Fetch completes one while the job waits; the job, when it
	// runs, has nothing to ask about it.
	alice.mustDo("POST", fmt.Sprintf("/people/id/%d/fetch", id("Finished while it waits")), nil, http.StatusOK)
	asked()
	q.let()

	done := alice.waitJob(job.ID, "succeeded")
	if done.Done != 3 || done.Total != 3 {
		t.Fatalf("the fetch walked %d of %d records, want the three missing something when it ran", done.Done, done.Total)
	}
	countsAre(t, done, map[string]any{"ok": float64(3), "failed": float64(0), "first_error": ""})
	got := asked()
	slices.Sort(got)
	if want := []string{"Named link only", "Nothing yet", "Provider link only"}; !slices.Equal(got, want) {
		t.Fatalf("Open Library was asked about %v, want %v", got, want)
	}
	after := consoleRecords(t, alice)
	for _, name := range names {
		if r := after[name]; r.NoLinks || r.NoPhoto {
			t.Errorf("%q still lacks something after the fetch: %+v", name, r)
		}
	}
	if !strings.Contains(after["Named link only"].Links, "https://example.org/essays | Their essays") {
		t.Errorf("the fetch lost the name the reader gave a link: %q", after["Named link only"].Links)
	}
	if b := consoleRecords(t, bob)["Bob's author"]; b.Source != "" || b.ImagePath != "" {
		t.Fatalf("bob's record was fetched by alice's job: %+v", b)
	}
}

// ---- a Stop, at every point it can land ---------------------------------------

// supplierGate holds one question a supplier is asked, as a slow supplier would:
// until the job's context ends or the test lets it answer. Or, with a press, it
// presses Stop from inside the question and then answers at once, so the Stop
// lands after the item's lookup and before its write.
type supplierGate struct {
	mu      sync.Mutex
	hold    string // the question held; "" holds none
	press   func()
	once    sync.Once
	asked   chan struct{} // closed when the held question is asked
	release chan struct{} // closed by the test to let it answer
}

func newSupplierGate() *supplierGate {
	return &supplierGate{asked: make(chan struct{}), release: make(chan struct{})}
}

func (g *supplierGate) set(hold string, press func()) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.hold, g.press = hold, press
}

// wait is the supplier's side of the gate, for question.
func (g *supplierGate) wait(ctx context.Context, question string) error {
	g.mu.Lock()
	hold, press := g.hold, g.press
	g.mu.Unlock()
	if hold == "" || question != hold {
		return nil
	}
	first := false
	g.once.Do(func() { first = true })
	if !first {
		return nil
	}
	if press != nil {
		press()
		return nil
	}
	close(g.asked)
	select {
	case <-g.release:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// stopPoint is where a Stop lands in a job of three items.
type stopPoint struct {
	name    string
	waiting bool // pressed while the job waits its turn
	at      int  // else: during this item's lookup (1-based), never the last item's
	press   bool // pressed from inside that lookup, which then answers
}

var stopPoints = []stopPoint{
	{name: "while it waits its turn", waiting: true},
	{name: "inside the first item's lookup", at: 1},
	{name: "inside the second item's lookup, the first done", at: 2},
	{name: "after the first item's lookup answered, before its write", at: 1, press: true},
	{name: "after the second item's lookup answered, before its write", at: 2, press: true},
}

// stoppedAt starts kind with params behind a held job, with another job queued
// behind it, stops it at p — questions are what the supplier is asked about each
// of its three items, in order — and returns it stopped, once the job behind it
// has run and succeeded.
func stoppedAt(t *testing.T, c *testClient, q *testQueue, g *supplierGate, kind string, params map[string]any, p stopPoint, questions []string) wireJob {
	t.Helper()
	ahead := c.mustStart("test.hold", map[string]any{"tag": p.name})
	c.waitJob(ahead.ID, "running")
	job := c.mustStart(kind, params)
	next := c.mustStart("test.lines", map[string]any{"tag": p.name})
	stopPath := fmt.Sprintf("/jobs/%d/stop", job.ID)
	pressed := make(chan int, 1)
	switch {
	case p.waiting:
		c.mustDo("POST", stopPath, nil, http.StatusOK)
	case p.press:
		// From the job's own goroutine, so not through mustDo: its answer is
		// checked here, by the test's.
		g.set(questions[p.at-1], func() { pressed <- c.do("POST", stopPath, nil).Code })
	default:
		g.set(questions[p.at-1], nil)
	}
	q.let()
	switch {
	case p.press:
		select {
		case code := <-pressed:
			if code != http.StatusOK {
				t.Fatalf("Stop pressed during the lookup: %d", code)
			}
		case <-time.After(20 * time.Second):
			t.Fatal("the job never asked about the item Stop was to land on")
		}
	case !p.waiting:
		select {
		case <-g.asked:
		case <-time.After(20 * time.Second):
			t.Fatal("the job never asked about the item Stop was to land on")
		}
		c.mustDo("POST", stopPath, nil, http.StatusOK)
		close(g.release)
	}
	stopped := c.waitJob(job.ID, "stopped")
	g.set("", nil)
	// The queue carries on.
	c.waitJob(next.ID, "succeeded")
	return stopped
}

// strayFiles is every file in the data directory that is neither the database's
// nor a picture some record names (named: the picture paths the app shows).
func strayFiles(t *testing.T, srv *Server, named []string) []string {
	t.Helper()
	var stray []string
	err := filepath.WalkDir(srv.DataDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(srv.DataDir, path)
		switch {
		case strings.HasPrefix(rel, "test.db"):
		case filepath.Dir(rel) == "MediaCover" && slices.Contains(named, d.Name()):
		default:
			stray = append(stray, rel)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return stray
}

func TestAFillOfEveryWorkStoppedAnywhereLeavesEachWorkWholeOrUntouched(t *testing.T) {
	isbns := []string{duneISBN, messiahISBN, "9780141018812"}
	for _, p := range stopPoints {
		t.Run(p.name, func(t *testing.T) {
			srv := newTestServer(t)
			q := queueing(t, srv)
			duneSupplier(srv)
			answer := srv.searchBooks
			g := newSupplierGate()
			srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
				if err := g.wait(ctx, isbn); err != nil {
					return nil, err
				}
				return answer(ctx, isbn, title, author, key)
			}
			h := srv.Handler()
			alice := signupAdmin(t, h)
			var ids []int64
			for i, isbn := range isbns {
				ids = append(ids, createdID(t, alice, "/books", map[string]any{"title": fmt.Sprintf("Book %d", i+1), "author": "Someone", "isbn": isbn}))
			}

			stopped := stoppedAt(t, alice, q, g, "fill", map[string]any{"all": true}, p, isbns)
			whole := 0
			for i, id := range ids {
				switch y, pg := bookYearPages(t, alice, id); {
				case y == 1965 && pg == 412:
					whole++
					if i+1 > p.at {
						t.Errorf("book %d, after the one Stop landed on, was filled", i+1)
					}
				case y == 0 && pg == 0:
					if i+1 < p.at {
						t.Errorf("book %d, before the one Stop landed on, was not filled", i+1)
					}
				default:
					t.Errorf("book %d is half filled: year %d, pages %d", i+1, y, pg)
				}
			}
			// What it counts is what it did.
			if stopped.Done != whole {
				t.Errorf("the stopped fill says it did %d works; %d are filled", stopped.Done, whole)
			}
			if whole > 0 || !p.waiting {
				countsAre(t, stopped, map[string]any{"fields": float64(2 * whole), "failed": float64(0), "unpinned": float64(0)})
			}
			if stray := strayFiles(t, srv, nil); len(stray) > 0 {
				t.Errorf("the stopped fill left files nothing names: %v", stray)
			}

			// Run again, it finishes: what is still missing, and nothing twice.
			again := decode[struct {
				Job wireJob `json:"job"`
			}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", stopped.ID), nil, http.StatusAccepted)).Job
			done := alice.waitJob(again.ID, "succeeded")
			countsAre(t, done, map[string]any{"fields": float64(2 * (len(ids) - whole)), "failed": float64(0), "unpinned": float64(0)})
			for i, id := range ids {
				if y, pg := bookYearPages(t, alice, id); y != 1965 || pg != 412 {
					t.Errorf("book %d after the fill ran again: year %d, pages %d", i+1, y, pg)
				}
			}
		})
	}
}

func TestAFetchOfMissingPeopleStoppedAnywhereLeavesEachRecordWholeOrUntouched(t *testing.T) {
	names := []string{"First Author", "Second Author", "Third Author"}
	for _, p := range stopPoints {
		t.Run(p.name, func(t *testing.T) {
			srv := newTestServer(t)
			q := queueing(t, srv)
			g := newSupplierGate()
			everyAuthorResolves(srv, g)
			downloads(t, srv)
			h := srv.Handler()
			alice := signupAdmin(t, h)
			for _, name := range names {
				alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": name}, http.StatusOK)
			}

			stopped := stoppedAt(t, alice, q, g, "people", map[string]any{"missing": true}, p, names)
			records := consoleRecords(t, alice)
			whole := 0
			var pictures []string
			for i, name := range names {
				r := records[name]
				switch {
				case r.Bio != "" && r.ImagePath != "" && strings.Contains(r.Links, "openlibrary.org/authors/"):
					whole++
					pictures = append(pictures, r.ImagePath)
					if i+1 > p.at {
						t.Errorf("%s, after the one Stop landed on, was fetched", name)
					}
					alice.mustDo("GET", "/covers/"+r.ImagePath, nil, http.StatusOK)
				case r.Bio == "" && r.ImagePath == "" && r.Links == "" && r.Source == "":
					if i+1 < p.at {
						t.Errorf("%s, before the one Stop landed on, was not fetched", name)
					}
				default:
					t.Errorf("%s is half fetched: %+v", name, r)
				}
			}
			if stopped.Done != whole {
				t.Errorf("the stopped fetch says it did %d records; %d are fetched", stopped.Done, whole)
			}
			if whole > 0 || !p.waiting {
				countsAre(t, stopped, map[string]any{"ok": float64(whole), "failed": float64(0), "first_error": ""})
			}
			if stray := strayFiles(t, srv, pictures); len(stray) > 0 {
				t.Errorf("the stopped fetch left files nothing names: %v", stray)
			}

			// Run again, it fetches the records still missing something, as they
			// are when it runs, and then none is.
			again := decode[struct {
				Job wireJob `json:"job"`
			}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", stopped.ID), nil, http.StatusAccepted)).Job
			done := alice.waitJob(again.ID, "succeeded")
			if done.Done != len(names)-whole {
				t.Errorf("the fetch run again walked %d records, want the %d still missing something", done.Done, len(names)-whole)
			}
			for name, r := range consoleRecords(t, alice) {
				if r.NoLinks || r.NoPhoto {
					t.Errorf("%s still lacks something after the fetch ran again: %+v", name, r)
				}
			}
		})
	}
}
