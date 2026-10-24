package httpapi

// The library scan as a job, through the API only.
//
// What this knows: PUT /admin/mounts, POST /sources/scan, GET /sources/found, the jobs
// routes (stop, job state), and the shapes they answer. It builds the library folder on disk
// itself. To count reads it swaps an EPUB's bytes for garbage without changing its size or
// modification time: a scan that reads the file again then loses the finding. One test uses
// itemSeam to hold the job at a known file, because nothing a person does can stop a scan
// that finishes in milliseconds at an exact point.

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/jobs"
)

// bigLibrary mounts a folder of n tiny subtitle files, each for a different film in the
// reader's library (matched by the {tmdb-N} in the folder name).
func bigLibrary(t *testing.T, n int) (srv *Server, c *testClient, root string) {
	t.Helper()
	srv = newTestServer(t)
	c = signupAdmin(t, srv.Handler())
	root = t.TempDir()
	var uid int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users LIMIT 1`).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= n; i++ {
		res, err := tx.Exec(`INSERT INTO movies (user_id, title, media_type, tmdb_id, release_year) VALUES (?, ?, 'movie', ?, 2001)`,
			uid, fmt.Sprintf("Film %04d", i), i)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		if _, err := tx.Exec(`INSERT INTO dialogues (movie_id, quote, dedupe_hash) VALUES (?, 'A line.', ?)`, id, fmt.Sprintf("h%d", i)); err != nil {
			t.Fatal(err)
		}
		dir := filepath.Join(root, "movies", fmt.Sprintf("Film %04d (2001) {tmdb-%d}", i, i))
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("Film %04d (2001).en.srt", i)), []byte("1\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)
	return srv, c, root
}

func TestOnePressScansMoreFilesThanTheOldCapAndStoresEveryFinding(t *testing.T) {
	_, c, _ := bigLibrary(t, 1000)
	got := c.scan()
	if len(got.Candidates) != 1000 || got.Scan.Scanned != 1000 || got.Scan.State != "done" {
		t.Fatalf("one press should scan all 1000 files: %d findings, %+v", len(got.Candidates), got.Scan)
	}
	for _, cand := range got.Candidates {
		if cand.Token == "" || cand.Bucket != "exact" {
			t.Fatalf("every finding carries a token and an exact match: %+v", cand)
		}
	}
}

func TestFindingsCanBeReviewedWhileTheScanRunsAndAStopKeepsThem(t *testing.T) {
	srv, c, _ := bigLibrary(t, 1000)
	reached := make(chan struct{})
	var once sync.Once
	var armed atomic.Bool
	armed.Store(true)
	var calls atomic.Int64
	srv.itemSeam = func(j *jobs.Job, i int) {
		calls.Add(1)
		if i == 300 && armed.Load() {
			once.Do(func() { close(reached) })
			for deadline := time.Now().Add(20 * time.Second); !j.Stopping() && time.Now().Before(deadline); {
				time.Sleep(time.Millisecond)
			}
		}
	}
	id := c.startScan()
	<-reached
	during := c.found()
	if during.Scan.State != "running" || len(during.Candidates) == 0 || len(during.Candidates) >= 1000 {
		t.Fatalf("findings should be readable mid-scan: %d findings, %+v", len(during.Candidates), during.Scan)
	}
	c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", id), nil, http.StatusOK)
	c.waitJob(id, "stopped")
	stopped := c.found()
	if stopped.Scan.State != "partial" || len(stopped.Candidates) < 300 || len(stopped.Candidates) >= 1000 {
		t.Fatalf("a stopped scan keeps what it found: %d findings, %+v", len(stopped.Candidates), stopped.Scan)
	}

	// Pressing Scan again resumes after the last file done, and does not repeat findings.
	armed.Store(false)
	calls.Store(0)
	c.waitJob(c.startScan(), "succeeded")
	done := c.found()
	if len(done.Candidates) != 1000 || done.Scan.State != "done" || done.Scan.Scanned != 1000 {
		t.Fatalf("the resumed scan should finish with every finding once: %d findings, %+v", len(done.Candidates), done.Scan)
	}
	seen := map[string]bool{}
	for _, cand := range done.Candidates {
		if seen[cand.Rel] {
			t.Fatalf("%s is listed twice", cand.Rel)
		}
		seen[cand.Rel] = true
	}
	if n := calls.Load(); n > 710 {
		t.Fatalf("the resumed scan went through %d files; it should continue after file 300", n)
	}
}

// swapEPUB replaces the file's bytes with garbage of the same length and restores its
// modification time, so only a scan that opens the file can notice.
func swapEPUB(t *testing.T, p string) {
	t.Helper()
	st, err := os.Stat(p)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(strings.Repeat("x", int(st.Size()))), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(p, st.ModTime(), st.ModTime()); err != nil {
		t.Fatal(err)
	}
}

func hasBook(l foundList) bool {
	for _, c := range l.Candidates {
		if c.Subject == "book" {
			return true
		}
	}
	return false
}

func TestALaterScanReadsOnlyFilesThatChanged(t *testing.T) {
	_, c, root, _, _, _ := mountFixture(t)
	epub := filepath.Join(root, "books", "Dust of Dreams.epub")
	original, err := os.ReadFile(epub)
	if err != nil {
		t.Fatal(err)
	}
	st, _ := os.Stat(epub)
	if !hasBook(c.scan()) {
		t.Fatal("setup: the first scan should find the book")
	}

	// Same size and time: the file is not opened, so the finding stays.
	swapEPUB(t, epub)
	if !hasBook(c.scan()) {
		t.Fatal("an unchanged file was read again")
	}

	// A new modification time: the file is read, and it is no longer an EPUB.
	later := st.ModTime().Add(time.Hour)
	if err := os.Chtimes(epub, later, later); err != nil {
		t.Fatal(err)
	}
	if hasBook(c.scan()) {
		t.Fatal("a changed file was not read again")
	}

	// A good file again is read and found again.
	if err := os.WriteFile(epub, original, 0o644); err != nil {
		t.Fatal(err)
	}
	if !hasBook(c.scan()) {
		t.Fatal("the restored file was not found")
	}
}

func TestAnotherReaderSeesNoneOfMyFindings(t *testing.T) {
	srv, admin, _, _, _, _ := mountFixture(t)
	admin.scan()
	cara := addUser(t, srv.Handler(), admin, "cara")
	got := decode[foundList](t, cara.mustDo("GET", "/sources/found?mount_id=library", nil, 200))
	if len(got.Candidates) != 0 || got.Scan.State != "none" {
		t.Fatalf("a reader sees only their own findings: %+v", got)
	}
}

func TestAnAcceptedFindingLeavesTheListAtOnce(t *testing.T) {
	_, c, _, film, _, _ := mountFixture(t)
	var tok string
	for _, cand := range c.scan().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			tok = cand.Token
		}
	}
	c.mustDo("POST", "/sources/attach-found", map[string]any{"bucket": "exact", "tokens": []string{tok}}, 200)
	for _, cand := range c.found().Candidates {
		if cand.WorkID == film && cand.Subject == "screen" {
			t.Fatalf("an accepted finding is still listed: %+v", cand)
		}
	}
}

func TestRemovingAFolderForgetsItsScan(t *testing.T) {
	_, c, root, _, _, _ := mountFixture(t)
	c.scan()
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{}}, 200)
	// The id comes back for a folder with no files attached from it: nothing carries over.
	c.mustDo("PUT", "/admin/mounts", map[string]any{"mounts": []mountCfg{{ID: "library", Label: "Library", Path: root}}}, 200)
	if got := c.found(); len(got.Candidates) != 0 || got.Scan.State != "none" {
		t.Fatalf("a removed folder's scan should be forgotten: %+v", got.Scan)
	}
}

// waitScanDone polls the findings route, as the screen does, until the scan reads done.
func waitScanDone(t *testing.T, c *testClient) foundList {
	t.Helper()
	deadline := time.Now().Add(60 * time.Second)
	for {
		got := c.found()
		if got.Scan.State == "done" {
			return got
		}
		if time.Now().After(deadline) {
			t.Fatalf("the scan never finished: %+v", got.Scan)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func scanJobCount(t *testing.T, srv *Server, states string) int {
	t.Helper()
	var n int
	if err := srv.Store.DB.QueryRow(`SELECT count(*) FROM jobs WHERE kind = 'library.scan' AND state IN (` + states + `)`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestAJobQueuedDuringAScanRunsBeforeTheScansNextSlice(t *testing.T) {
	srv, c, _ := bigLibrary(t, 120)
	srv.scanSlice = time.Nanosecond
	reached := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	srv.itemSeam = func(j *jobs.Job, i int) {
		if i == 10 {
			once.Do(func() { close(reached) })
			<-release
		}
	}
	c.startScan()
	<-reached
	other := decode[struct {
		Job wireJob `json:"job"`
	}](t, c.mustDo("POST", "/jobs", map[string]any{"kind": "people", "params": map[string]any{"missing": true}}, http.StatusAccepted)).Job
	close(release)
	waitScanDone(t, c)
	c.waitJob(other.ID, "succeeded")
	var otherStart, nextStart int64
	if err := srv.Store.DB.QueryRow(`SELECT started_at FROM jobs WHERE id = ?`, other.ID).Scan(&otherStart); err != nil {
		t.Fatal(err)
	}
	if err := srv.Store.DB.QueryRow(`SELECT started_at FROM jobs WHERE kind = 'library.scan' ORDER BY id LIMIT 1 OFFSET 1`).Scan(&nextStart); err != nil {
		t.Fatal(err)
	}
	if otherStart > nextStart {
		t.Fatalf("the other job started at %d, after the scan's second slice at %d", otherStart, nextStart)
	}
}

func TestStopEndsTheWholeChainAndScanResumes(t *testing.T) {
	srv, c, _ := bigLibrary(t, 260)
	srv.scanSlice = time.Nanosecond
	reached := make(chan struct{})
	var once sync.Once
	var armed atomic.Bool
	armed.Store(true)
	srv.itemSeam = func(j *jobs.Job, i int) {
		if i == 110 && armed.Load() {
			once.Do(func() { close(reached) })
			for deadline := time.Now().Add(20 * time.Second); !j.Stopping() && time.Now().Before(deadline); {
				time.Sleep(time.Millisecond)
			}
		}
	}
	c.startScan()
	<-reached
	id := c.found().Scan.JobID
	c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", id), nil, http.StatusOK)
	c.waitJob(id, "stopped")
	time.Sleep(200 * time.Millisecond) // a wrongly queued next slice would have appeared by now
	if n := scanJobCount(t, srv, `'queued', 'running'`); n != 0 {
		t.Fatalf("Stop should end the chain, but %d slices are still queued or running", n)
	}
	if got := c.found(); got.Scan.State != "partial" {
		t.Fatalf("a stopped scan should read partial: %+v", got.Scan)
	}
	armed.Store(false)
	c.startScan()
	if got := waitScanDone(t, c); len(got.Candidates) != 260 {
		t.Fatalf("pressing Scan should resume and finish: %d findings", len(got.Candidates))
	}
}

func TestAContinuationIsNotRefusedByTheJobLimit(t *testing.T) {
	srv, c, _ := bigLibrary(t, 120)
	srv.scanSlice = time.Nanosecond
	var uid int64
	var name string
	if err := srv.Store.DB.QueryRow(`SELECT id, username FROM users LIMIT 1`).Scan(&uid, &name); err != nil {
		t.Fatal(err)
	}
	// Four other jobs on the reader's account, so the scan's slice is the fifth.
	for i := 0; i < 4; i++ {
		if _, err := srv.Store.DB.Exec(`INSERT INTO jobs (user_id, username, kind, queued, subject, state, params, total, created_at)
			VALUES (?, ?, 'fill', 1, '', 'running', ?, 0, ?)`, uid, name, fmt.Sprintf(`{"book_ids":[%d],"movie_ids":[]}`, i+1), time.Now().UnixMilli()); err != nil {
			t.Fatal(err)
		}
	}
	c.startScan()
	if got := waitScanDone(t, c); len(got.Candidates) != 120 {
		t.Fatalf("every slice should have been queued: %d findings", len(got.Candidates))
	}
}
