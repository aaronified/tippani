package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"tippani/internal/importer"
	"tippani/internal/jobs"
)

// AN IMPORT, AND ITS APPROVAL, ARE QUEUED JOBS.
//
// Driven through the API as the Import screen and the import queue drive it — a
// file posted to the drop target (POST /import/auto) or to a source's own route,
// staged quotes approved (POST /import/staged/approve) — and read back as
// Settings › Jobs reads them: the job the route answers with, Past jobs, the
// job's log, and Run again.
//
// WHAT IT KNOWS, declared: what jobs_api_test.go's header declares (the queue and
// its logbook given to the server as serve() gives them, the test's kind that
// holds the queue until it is let go, and the wire field names), and the
// importer's own sample files (internal/importer/testdata, as import_auto_test.go
// reads them). Beyond those, four things no request can reach:
//   - the spool's place in the data directory (spoolDirName), because what is
//     promised about an upload waiting for its job is where its bytes are and are
//     not — never in an archive, gone once nothing can use them — and no answer
//     of the API shows a file on the disk;
//   - a server restarting, which no request does: the queue is closed as shutdown
//     closes it and a new one started on the same database as serve() starts one
//     (restarted), Boot and SweepSpool included;
//   - a stray file left in the spool by a run that died writing it, put there by
//     hand, since nothing a person does leaves one;
//   - the moment after an import's staging has committed and before its job has
//     recorded that (importStopSeam at importStagedPoint), which is where a crash
//     would have to land to stage one file twice, and which no request reaches.
//
// Where a Stop lands inside an import or an approval, and what it leaves, is
// import_stop_test.go's, with the seam it needs declared there.
//
// What each one guards, in a sentence a person would say: a file I dropped is a
// job in Past jobs under its name, saying what it was read as and what it staged,
// under the batch the import queue shows; a file of quotes says so too; a file
// that is something else is kept as a failed import that says what it is; a file
// its route cannot read is kept as a failed import that says why; what a Kindle
// file counted beside its quotes is in the log; a file I drop while another job
// runs waits its turn, says how many are ahead, and stages nothing until it runs;
// an import stopped before it ran keeps my file, so I can run it again, however
// many other files I upload meanwhile, and once it has run it cannot be run a
// second time; an import a restart cut off can be run again from what I
// uploaded, while whatever else was left in the spool is gone; the server's
// backup never carries a file waiting to be imported; nobody can start an import
// by naming a file through the jobs API; and an approval waits its turn behind
// another job and writes nothing until it runs, and is kept in Past jobs under
// its file with what it added; an approval takes what there was when I pressed
// it and never a file staged after, and Discard all keeps such a file too; and a
// factory reset or a restore takes the uploads it left nobody to run.

type wireLine struct {
	ID    int64  `json:"id"`
	Level string `json:"level"`
	Line  string `json:"line"`
}

// importJob waits for the import of file to be in c's past jobs, as the list is
// read again until it shows, and returns it with its log.
func importJob(c *testClient, file string) (wireJob, []wireLine) {
	c.t.Helper()
	return pastJobAbout(c, "import", file)
}

// pastJobAbout waits for a job of kind about subject to be in c's past jobs, and
// returns it with its log.
func pastJobAbout(c *testClient, kind, subject string) (wireJob, []wireLine) {
	c.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		for _, j := range c.jobs("view=past&kind=" + kind).Jobs {
			if j.Subject == subject {
				return j, jobLines(c, j.ID)
			}
		}
		if time.Now().After(deadline) {
			c.t.Fatalf("no %s of %q in past jobs", kind, subject)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// jobLines is a job's log, as its pane reads it.
func jobLines(c *testClient, id int64) []wireLine {
	c.t.Helper()
	return decode[struct {
		Lines []wireLine `json:"lines"`
	}](c.t, c.mustDo("GET", fmt.Sprintf("/jobs/%d?log_after=0", id), nil, http.StatusOK)).Lines
}

// saying fails unless one of lines holds every part of want, and returns it.
func saying(t *testing.T, lines []wireLine, want ...string) wireLine {
	t.Helper()
	for _, l := range lines {
		all := true
		for _, w := range want {
			all = all && strings.Contains(l.Line, w)
		}
		if all {
			return l
		}
	}
	t.Fatalf("no line says %q in %+v", want, lines)
	return wireLine{}
}

// uploadOnly posts a file to an import route as the Import screen does, without
// following the job it queues: the route's own answer.
func (c *testClient) uploadOnly(path, name string, content []byte) *httptest.ResponseRecorder {
	c.t.Helper()
	var rec *httptest.ResponseRecorder
	c.withoutFollowing(func() { rec = c.importFile(path, name, content) })
	return rec
}

// withoutFollowing runs fn with importFile handing back the route's own answer:
// the job it queued, not the job's answer.
func (c *testClient) withoutFollowing(fn func()) {
	c.noFollow = true
	defer func() { c.noFollow = false }()
	fn()
}

// queuedJob is the job a 202 names.
func queuedJob(t *testing.T, rec *httptest.ResponseRecorder) wireJob {
	t.Helper()
	if rec.Code != http.StatusAccepted {
		t.Fatalf("the route did not queue a job: %d %s", rec.Code, rec.Body)
	}
	return decode[struct {
		Job wireJob `json:"job"`
	}](t, rec).Job
}

// spooled is what the spool holds now, by name.
func spooled(t *testing.T, srv *Server) []string {
	t.Helper()
	entries, err := os.ReadDir(filepath.Join(srv.DataDir, spoolDirName))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

// restarted gives srv a new queue on the same database, as the next start of the
// server gives it one: the old queue closed as shutdown closes it, then Boot, the
// kinds and the spool's sweep, in serve()'s order.
func restarted(t *testing.T, srv *Server) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Jobs.Close(ctx); err != nil {
		t.Fatalf("closing the queue: %v", err)
	}
	r := jobs.NewRunner(srv.Store, srv.Logbook, jobs.Options{})
	if err := r.Boot(); err != nil {
		t.Fatalf("boot: %v", err)
	}
	srv.Jobs = r
	srv.RegisterJobKinds()
	srv.SweepSpool()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		r.Close(ctx)
	})
}

func TestAnImportIsAQueuedJobThatSaysWhatItReadAndStaged(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	rec := c.importAs("notes", fixture(t, "goodreads_synth.htm"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("the import: %d %s", rec.Code, rec.Body)
	}
	staged := decode[autoReply](t, rec)
	if staged.Staged < 2 {
		t.Fatalf("the sample staged %d quotes; this test wants a plural", staged.Staged)
	}
	j, lines := importJob(c, "notes")
	if !j.Queued || !j.Own || j.State != "succeeded" || j.Error != "" || j.Rerunnable {
		t.Fatalf("the import in past jobs: %+v", j)
	}
	if n, _ := j.Counts["staged"].(float64); int(n) != staged.Staged {
		t.Fatalf("past jobs counts %v, want %d staged", j.Counts, staged.Staged)
	}
	saying(t, lines, "read as "+importer.SourceGoodreadsHTML, "the file says")
	// The batch it names is the one the import queue shows.
	saying(t, lines, fmt.Sprintf("staged %d quotes from 1 work as batch %d", staged.Staged, staged.BatchID))
	if q := queue(t, c, ""); len(q.Batches) != 1 || q.Batches[0].ID != staged.BatchID {
		t.Fatalf("the import queue's batches: %+v, want %d", q.Batches, staged.BatchID)
	}

	// A file of quotes, through the markdown route: the route names the format,
	// and the quotes are staged into one group.
	md := "---\ntype: quotes\n---\n\n## Burma Radio broadcast\n\n> Give me blood\n- speaker: Bose\n\n" +
		"## Singapore rally\n\n> Give me blood\n- speaker: Bose\n"
	quotes := stageQuotesMD(t, c, "speeches.md", md)
	_, lines = importJob(c, "speeches.md")
	saying(t, lines, "read as "+importer.SourceMarkdown, "route")
	saying(t, lines, fmt.Sprintf("staged 2 quotes as batch %d", quotes.BatchID))

	// Nothing of either upload is kept once its job has read it.
	if left := spooled(t, srv); len(left) != 0 {
		t.Fatalf("the spool still holds %v after both imports ran", left)
	}
}

func TestAnImportThatStagesNothingIsKeptAsAFailedOneSayingWhy(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	// Something else entirely: the app's own export, a zip.
	rec := c.importAs("library.zip", []byte("PK\x03\x04\x14\x00\x00\x00\x08\x00"), "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a zip: %d %s", rec.Code, rec.Body)
	}
	zip := decode[autoReply](t, rec)
	if zip.NearMiss != "zip" {
		t.Fatalf("the zip's answer names no near miss: %+v", zip)
	}
	j, lines := importJob(c, "library.zip")
	if j.State != "failed" || j.Error != zip.Error || j.Rerunnable {
		t.Fatalf("the zip's import: %+v, want failed with %q", j, zip.Error)
	}
	if l := saying(t, lines, "not imported", "a zip archive"); l.Level != "warn" {
		t.Fatalf("the near miss's line: %+v", l)
	}

	// A file its route cannot read, and the parser's own reason.
	rec = c.importFile("/import/goodreads-html", "saved.htm", []byte("<html><body>nothing here</body></html>"))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a page that is not Goodreads: %d %s", rec.Code, rec.Body)
	}
	why := decode[struct {
		Error string `json:"error"`
	}](t, rec).Error
	j, lines = importJob(c, "saved.htm")
	if j.State != "failed" || j.Error != why {
		t.Fatalf("the page's import: %+v", j)
	}
	saying(t, lines, "read as "+importer.SourceGoodreadsHTML)
	saying(t, lines, "not imported: "+why)

	// An override naming no format is refused before anything queues.
	var bad *httptest.ResponseRecorder
	c.withoutFollowing(func() { bad = c.importAs("notes.txt", []byte("plain"), "no_such_format") })
	if bad.Code != http.StatusBadRequest || !strings.Contains(bad.Body.String(), "unknown import source") {
		t.Fatalf("an unknown override: %d %s", bad.Code, bad.Body)
	}
	for _, pj := range c.jobs("view=past&kind=import").Jobs {
		if pj.Subject == "notes.txt" {
			t.Fatalf("an override refused before it queued left a job: %+v", pj)
		}
	}

	// Nothing above may have staged a batch.
	if q := queue(t, c, ""); len(q.Batches) != 0 {
		t.Fatalf("a refused import staged something: %+v", q.Batches)
	}
}

func TestAKindleImportSaysWhatItCountedBesideTheQuotes(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	clips := strings.Join([]string{
		"A Borrowed Light (Ashworth, N.)",
		"- Your Highlight on page 12 | Location 100-101 | Added on Monday, 5 January 2026 10:00:00",
		"",
		"The first thing worth keeping.",
		"==========",
		"A Borrowed Light (Ashworth, N.)",
		"- Your Bookmark on page 15 | Added on Monday, 5 January 2026 10:02:00",
		"",
		"",
		"==========",
		"A Borrowed Light (Ashworth, N.)",
		"- Your Highlight on page 20 | Location 200-201 | Added on Monday, 5 January 2026 10:05:00",
		"",
		"The second thing worth keeping.",
		"==========",
		"",
	}, "\n")
	rec := c.importAs("My Clippings.txt", []byte(clips), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("the clippings: %d %s", rec.Code, rec.Body)
	}
	_, lines := importJob(c, "My Clippings.txt")
	saying(t, lines, "read as "+importer.SourceKindleClippings)
	saying(t, lines, "staged 2 quotes from 1 work")
	saying(t, lines, "bookmarks skipped 1")
}

// Mutation: queueImport staging the file in its request (runImport called there
// instead of the Enqueue) puts the batch in the queue while the held job still
// runs, and the 202 this test reads never comes.
func TestAFileDroppedWhileAnotherJobRunsWaitsItsTurn(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
	c.waitJob(held.ID, "running")
	rec := c.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD))
	j := queuedJob(t, rec)
	if j.Kind != "import" || j.State != "queued" || j.Subject != "sandworm.md" || j.Ahead != 1 || !j.Queued {
		t.Fatalf("the upload's job while another runs: %+v", j)
	}
	if got := queue(t, c, ""); len(got.Batches) != 0 {
		t.Fatalf("the file was staged while it waited: %+v", got.Batches)
	}
	q.let()
	ans := decode[stageReply](t, c.followed(rec))
	if ans.Staged != 2 {
		t.Fatalf("the import once its turn came: %+v", ans)
	}
	if got := queue(t, c, ""); len(got.Batches) != 1 || got.Batches[0].ID != ans.BatchID {
		t.Fatalf("the import queue after it ran: %+v", got.Batches)
	}
}

// Mutations: sweepSpool keeping only waiting, running and interrupted imports'
// files takes the stopped one's upload at the next file's upload, and it is no
// longer offered Run again; runImport removing the file after a Stop at its
// claim (the old "a stopped import keeps nothing") fails the same line.
func TestAnImportStoppedBeforeItRanKeepsItsUploadToRunAgain(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
	c.waitJob(held.ID, "running")
	j := queuedJob(t, c.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
	if len(spooled(t, srv)) != 1 {
		t.Fatalf("a waiting import's upload is not in the spool: %v", spooled(t, srv))
	}
	c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", j.ID), nil, http.StatusOK)
	if got := c.job(j.ID); got.State != "stopped" || !got.Rerunnable {
		t.Fatalf("the stopped import: %+v, want stopped and offered Run again", got)
	}
	q.let()

	// Another file, uploaded and run meanwhile, sweeps the spool as every upload
	// does; the stopped import's file is one the sweep keeps.
	other := strings.Replace(strings.Replace(stagedBookMD, "Sandworm Studies", "Arrakis Notes", 1), "Liet Kynes", "Stilgar", 1)
	if got := stage(t, c, "/import/markdown", "arrakis.md", []byte(other)); got.Staged != 2 {
		t.Fatalf("the other file: %+v", got)
	}
	if got := c.job(j.ID); got.State != "stopped" || !got.Rerunnable {
		t.Fatalf("the stopped import after another upload: %+v, want still offered Run again", got)
	}
	if got := queue(t, c, ""); len(got.Batches) != 1 {
		t.Fatalf("the stopped import staged something: %+v", got.Batches)
	}

	again := c.followed(c.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", j.ID), nil, http.StatusAccepted))
	if again.Code != http.StatusOK || decode[stageReply](t, again).Staged != 2 {
		t.Fatalf("the stopped import run again: %d %s", again.Code, again.Body)
	}
	if got := queue(t, c, ""); len(got.Batches) != 2 {
		t.Fatalf("the import queue after the rerun: %+v", got.Batches)
	}
	if got := c.job(j.ID); got.Rerunnable {
		t.Fatalf("the stopped import is still offered Run again once its upload has been staged: %+v", got)
	}
	if left := spooled(t, srv); len(left) != 0 {
		t.Fatalf("the spool after the rerun: %v", left)
	}
}

// Mutations: the sweep keeping only waiting and running imports' files (not an
// interrupted one's) takes the upload the rerun needs, and the job is no longer
// offered Run again; SweepSpool not sweeping at start leaves the stray file.
func TestAnImportARestartCutOffRunsAgainFromTheUpload(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
	c.waitJob(held.ID, "running")
	j := queuedJob(t, c.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
	stray := strings.Repeat("ab", 16) + ".upload"
	if err := os.WriteFile(filepath.Join(srv.DataDir, spoolDirName, stray), []byte("half an upload"), 0o600); err != nil {
		t.Fatal(err)
	}

	restarted(t, srv)
	cut := c.job(j.ID)
	if cut.State != "interrupted" || !cut.Rerunnable {
		t.Fatalf("the import the restart cut off: %+v", cut)
	}
	left := spooled(t, srv)
	if len(left) != 1 || left[0] == stray {
		t.Fatalf("after the restart the spool holds %v: want the interrupted import's upload and not %s", left, stray)
	}

	again := c.followed(c.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", j.ID), nil, http.StatusAccepted))
	if again.Code != http.StatusOK || decode[stageReply](t, again).Staged != 2 {
		t.Fatalf("the rerun: %d %s", again.Code, again.Body)
	}
	if q := queue(t, c, ""); len(q.Batches) != 1 {
		t.Fatalf("the import queue after the rerun: %+v", q.Batches)
	}
	if got := c.job(j.ID); got.Rerunnable {
		t.Fatalf("the interrupted import is still offered Run again once its upload has been read: %+v", got)
	}
	if left := spooled(t, srv); len(left) != 0 {
		t.Fatalf("the spool after the rerun: %v", left)
	}
}

// Mutation: stageBooks without its releaseSpool before the commit leaves the
// upload behind a staging that committed, and the import the restart cut off is
// offered Run again, which would stage the same file a second time.
func TestAnImportCutOffAfterItsStagingCommittedIsNeverStagedTwice(t *testing.T) {
	srv := newTestServer(t)
	c := signupAdmin(t, srv.Handler())

	reached, crashed := make(chan struct{}), make(chan struct{})
	var once sync.Once
	importStopSeam = func(_ context.Context, point string, _ int) {
		if point == importStagedPoint {
			once.Do(func() { close(reached); <-crashed })
		}
	}
	t.Cleanup(func() { importStopSeam = nil })

	j := queuedJob(t, c.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
	select {
	case <-reached:
	case <-time.After(20 * time.Second):
		t.Fatal("the import never staged")
	}
	// The server goes down now, before the job has recorded its end: shutdown's
	// wait runs out and the job is marked interrupted, as a crash leaves it once
	// the next start's Boot has run.
	old := srv.Jobs
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	_ = old.Close(ctx)
	cancel()
	r := jobs.NewRunner(srv.Store, srv.Logbook, jobs.Options{})
	if err := r.Boot(); err != nil {
		t.Fatal(err)
	}
	srv.Jobs = r
	srv.RegisterJobKinds()
	srv.SweepSpool()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		r.Close(ctx)
	})

	cut := c.job(j.ID)
	if cut.State != "interrupted" || cut.Rerunnable {
		t.Fatalf("the import cut off after its staging committed: %+v, want interrupted and not offered Run again", cut)
	}
	if q := queue(t, c, ""); len(q.Batches) != 1 {
		t.Fatalf("the import queue: %+v, want the one batch that committed", q.Batches)
	}
	if left := spooled(t, srv); len(left) != 0 {
		t.Fatalf("the spool after the crash: %v", left)
	}

	// The old job's goroutine is let go, and waited for, before the store closes.
	close(crashed)
	wait, done := context.WithTimeout(context.Background(), 10*time.Second)
	defer done()
	if err := old.WaitOwnerIdle(wait, 1); err != nil {
		t.Fatalf("the cut-off job never let go: %v", err)
	}
}

// Mutation: controlEntry without the spool's prefix archives the waiting upload.
func TestTheServersBackupNeverCarriesAFileWaitingToBeImported(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	admin := signupAdmin(t, srv.Handler())

	held := admin.mustStart("test.hold", map[string]any{"tag": "ahead"})
	admin.waitJob(held.ID, "running")
	// The backup is a job too, queued ahead of the import, so it runs while the
	// upload waits its turn in the spool.
	backup := decode[struct {
		Job wireJob `json:"job"`
	}](t, admin.mustDo("POST", "/admin/backup", map[string]any{"password": testPw}, http.StatusAccepted)).Job
	rec := admin.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD))
	queuedJob(t, rec)
	if len(spooled(t, srv)) != 1 {
		t.Fatalf("no upload waiting in the spool: %v", spooled(t, srv))
	}
	q.let()
	if end := admin.jobEnded(backup.ID); end.State != "succeeded" {
		t.Fatalf("the backup ahead of the import: %+v", end)
	}
	name, _ := srv.newestBackup()
	enc, err := os.ReadFile(filepath.Join(srv.backupsDir(), name))
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range tarNames(t, plaintextOf(t, enc, testPw)) {
		if strings.Contains(n, spoolDirName) {
			t.Fatalf("the archive carries %s", n)
		}
	}
	if ans := admin.followed(rec); ans.Code != http.StatusOK {
		t.Fatalf("the import after the backup: %d %s", ans.Code, ans.Body)
	}
}

// Mutation: handleStartJob without its no-validate refusal hands the params to a
// validate that is not there.
func TestNobodyStartsAnImportByNamingAFileThroughTheJobsAPI(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	held := alice.mustStart("test.hold", map[string]any{"tag": "ahead"})
	alice.waitJob(held.ID, "running")
	upload := alice.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD))
	j := queuedJob(t, upload)
	var p struct {
		Spool string `json:"spool"`
	}
	raw, _ := json.Marshal(j.Params)
	_ = json.Unmarshal(raw, &p)
	for _, kind := range []string{"import", "import.approve"} {
		rec := bob.startJob(kind, map[string]any{"source": importer.SourceMarkdown, "filename": "x.md", "spool": p.Spool, "all": true})
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("bob starting %s through POST /jobs: %d %s", kind, rec.Code, rec.Body)
		}
	}
	q.let()
	if ans := alice.followed(upload); ans.Code != http.StatusOK {
		t.Fatalf("alice's own import: %d %s", ans.Code, ans.Body)
	}
	if got := queue(t, bob, ""); len(got.Batches) != 0 {
		t.Fatalf("bob's queue holds alice's file: %+v", got.Batches)
	}
}

// Mutation: handleApproveStaged writing the selection in its request puts the book
// in the library while the held job runs.
func TestAnApprovalWaitsItsTurnAndIsKeptUnderItsFile(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	res := stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
	held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
	c.waitJob(held.ID, "running")
	rec := c.do("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID})
	j := queuedJob(t, rec)
	if n := bookCount(t, c); n != 0 {
		t.Fatalf("%d books in the library before the approval ran", n)
	}
	if j.Kind != "import.approve" || j.State != "queued" || j.Subject != "sandworm.md" || j.Ahead != 1 || j.Total != 1 {
		t.Fatalf("the approval while another job runs: %+v", j)
	}
	// The same press again is the same job, and the screen is told which.
	again := c.do("POST", "/import/staged/approve", map[string]any{"batch_id": res.BatchID})
	if again.Code != http.StatusConflict || !strings.Contains(again.Body.String(), fmt.Sprintf(`"job_id":%d`, j.ID)) {
		t.Fatalf("approving the same batch twice: %d %s", again.Code, again.Body)
	}
	q.let()
	ap := decode[approveReply](t, c.followed(rec))
	if ap.Added != 2 || ap.Pending != 0 || len(ap.BookIDs) != 1 {
		t.Fatalf("the approval once its turn came: %+v", ap)
	}
	done, lines := pastJobAbout(c, "import.approve", "sandworm.md")
	if done.State != "succeeded" || done.Rerunnable {
		t.Fatalf("the approval in past jobs: %+v", done)
	}
	if n, _ := done.Counts["added"].(float64); n != 2 {
		t.Fatalf("the approval's counts: %v", done.Counts)
	}
	saying(t, lines, "«Sandworm Studies»", "2 added")
}

// bookMD is stagedBookMD under another title and author, so each file is a work
// of its own in the queue and in the library.
func bookMD(title, author string) []byte {
	return []byte(strings.Replace(strings.Replace(stagedBookMD, "Sandworm Studies", title, 1), "Liet Kynes", author, 1))
}

// stillStaged is the file names the import queue holds now, in the queue's order.
func stillStaged(t *testing.T, c *testClient) []string {
	t.Helper()
	var names []string
	for _, b := range queue(t, c, "").Batches {
		names = append(names, b.Filename)
	}
	return names
}

// AN APPROVAL TAKES WHAT THERE WAS WHEN IT WAS PRESSED, AND NOTHING STAGED SINCE.
//
// An approval is a queued job, so it can run long after its press — behind a
// fill, or as a Run again days later — and from 3.1.0 a file can be staged in the
// background meanwhile, by an import that was waiting its own turn. "Approve all
// 2" must put those two quotes in the library and not a third file's that nobody
// has looked at, which is the whole point of the import queue (CLAUDE.md's
// invariant: an import is approved out of it, never written straight in). The
// four ways a later file could slip in, each a case here: an import queued ahead
// of the approval stages while it waits; a file staged after Pending import was
// read, while the reader was reading it (the screen sends the newest batch it
// showed); a Run again of an approval stopped before it ran; and a batch approved
// ahead of it that handed its id to the next file staged, which the approval's
// bound would then have covered.
//
// Mutations, each red here: stagedSelectionOf ignoring `through` (every case: the
// later file is approved); handleApproveStaged keeping a `through` newer than the
// newest batch (the bound past it); insertImportBatch taking SQLite's rowid
// instead of the floor (the last case: the next file reuses the approved batch's
// id, inside the bound).
func TestAnApprovalTakesWhatThereWasWhenItWasPressed(t *testing.T) {
	approveAll := func(t *testing.T, c *testClient, body map[string]any) wireJob {
		t.Helper()
		return queuedJob(t, c.do("POST", "/import/staged/approve", body))
	}
	want := func(t *testing.T, c *testClient, books int, staged ...string) {
		t.Helper()
		if n := bookCount(t, c); n != books {
			t.Fatalf("%d books in the library, want %d", n, books)
		}
		if got := stillStaged(t, c); strings.Join(got, ",") != strings.Join(staged, ",") {
			t.Fatalf("the import queue holds %v, want %v", got, staged)
		}
	}

	t.Run("an import queued ahead of it stages while it waits", func(t *testing.T) {
		srv := newTestServer(t)
		q := queueing(t, srv)
		c := signupAdmin(t, srv.Handler())
		stage(t, c, "/import/markdown", "seen.md", bookMD("Seen Book", "A Reader"))

		held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
		c.waitJob(held.ID, "running")
		later := c.uploadOnly("/import/markdown", "later.md", bookMD("Later Book", "Nobody Yet"))
		queuedJob(t, later)
		ap := approveAll(t, c, map[string]any{"all": true})
		q.let()
		if got := decode[approveReply](t, c.answerOf(ap.ID)); got.Added != 2 || got.Pending != 2 {
			t.Fatalf("the approval: %+v, want the seen file's 2 added and the later file's 2 still pending", got)
		}
		want(t, c, 1, "later.md")
	})

	t.Run("a file staged after the screen was read", func(t *testing.T) {
		srv := newTestServer(t)
		queueing(t, srv)
		c := signupAdmin(t, srv.Handler())
		seen := stage(t, c, "/import/markdown", "seen.md", bookMD("Seen Book", "A Reader"))
		// The screen read the queue here: its newest batch is the seen file's.
		stage(t, c, "/import/markdown", "later.md", bookMD("Later Book", "Nobody Yet"))
		ap := approveAll(t, c, map[string]any{"all": true, "through": seen.BatchID})
		if got := decode[approveReply](t, c.answerOf(ap.ID)); got.Added != 2 {
			t.Fatalf("the approval: %+v", got)
		}
		want(t, c, 1, "later.md")

	})

	t.Run("a bound past the newest batch there is", func(t *testing.T) {
		srv := newTestServer(t)
		q := queueing(t, srv)
		c := signupAdmin(t, srv.Handler())
		stage(t, c, "/import/markdown", "seen.md", bookMD("Seen Book", "A Reader"))

		held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
		c.waitJob(held.ID, "running")
		queuedJob(t, c.uploadOnly("/import/markdown", "later.md", bookMD("Later Book", "Nobody Yet")))
		// A screen that says it showed more than there is names nothing more than
		// there is: the next file staged is still not its to approve.
		ap := approveAll(t, c, map[string]any{"all": true, "through": 1 << 40})
		q.let()
		if got := decode[approveReply](t, c.answerOf(ap.ID)); got.Added != 2 {
			t.Fatalf("the approval: %+v", got)
		}
		want(t, c, 1, "later.md")
	})

	t.Run("a Run again of an approval stopped before it ran", func(t *testing.T) {
		srv := newTestServer(t)
		q := queueing(t, srv)
		c := signupAdmin(t, srv.Handler())
		stage(t, c, "/import/markdown", "seen.md", bookMD("Seen Book", "A Reader"))

		held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
		c.waitJob(held.ID, "running")
		ap := approveAll(t, c, map[string]any{"all": true})
		c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", ap.ID), nil, http.StatusOK)
		q.let()
		stage(t, c, "/import/markdown", "later.md", bookMD("Later Book", "Nobody Yet"))

		again := c.followed(c.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", ap.ID), nil, http.StatusAccepted))
		if got := decode[approveReply](t, again); got.Added != 2 || got.Pending != 2 {
			t.Fatalf("the approval run again: %+v", got)
		}
		want(t, c, 1, "later.md")
	})

	t.Run("a batch approved ahead of it frees its id", func(t *testing.T) {
		srv := newTestServer(t)
		q := queueing(t, srv)
		c := signupAdmin(t, srv.Handler())
		stage(t, c, "/import/markdown", "first.md", bookMD("First Book", "A Reader"))
		newest := stage(t, c, "/import/markdown", "newest.md", bookMD("Newest Book", "A Reader"))

		held := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
		c.waitJob(held.ID, "running")
		// The newest batch approved first, then a file uploaded, then everything
		// the queue shows approved: they run in that order.
		one := approveAll(t, c, map[string]any{"batch_id": newest.BatchID})
		queuedJob(t, c.uploadOnly("/import/markdown", "later.md", bookMD("Later Book", "Nobody Yet")))
		all := approveAll(t, c, map[string]any{"all": true})
		q.let()
		c.answerOf(one.ID)
		if got := decode[approveReply](t, c.answerOf(all.ID)); got.Added != 2 {
			t.Fatalf("approving everything the queue showed: %+v, want the first file's 2", got)
		}
		want(t, c, 2, "later.md")
	})
}

// "Discard all" throws away what the screen showed and nothing staged after it:
// a file staged in the background while the reader was reading Pending import
// is still there, and the quotes in it with it. The screen sends the newest batch
// it showed (through), as an approval does.
//
// Mutation: stagedSelectionOf ignoring `through` discards the later file too.
func TestDiscardAllKeepsAFileStagedAfterTheScreenWasRead(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())
	seen := stage(t, c, "/import/markdown", "seen.md", bookMD("Seen Book", "A Reader"))
	stage(t, c, "/import/markdown", "later.md", bookMD("Later Book", "Nobody Yet"))
	c.mustDo("DELETE", "/import/staged", map[string]any{"all": true, "through": seen.BatchID}, http.StatusOK)
	if got := stillStaged(t, c); strings.Join(got, ",") != "later.md" {
		t.Fatalf("after Discard all the queue holds %v, want the later file", got)
	}
	if n := len(queue(t, c, "").Quotes); n != 2 {
		t.Fatalf("the later file keeps %d quotes, want 2", n)
	}
}

// A FACTORY RESET OR A RESTORE TAKES THE UPLOADS IT LEFT NOBODY TO RUN.
//
// A stopped import keeps its upload so its owner can run it again, and the spool
// is a control entry, so neither a reset nor a restore moves it. But "Reset all
// data" deletes every job and every account, and a restore keeps a job's owner
// only where the restored accounts hold them — after either, a kept upload is
// somebody's highlights that nobody can run or see, and it sat on the disk until
// the next upload or restart happened to sweep it.
//
// Mutations: resetDatabase without its sweep (the reset case red, the upload
// still there); restoreArchive without its sweep (the restore case red).
func TestAResetOrARestoreTakesTheUploadsNobodyCanRunAgain(t *testing.T) {
	stoppedUpload := func(t *testing.T, srv *Server, q *testQueue, holder, owner *testClient) {
		t.Helper()
		held := holder.mustStart("test.hold", map[string]any{"tag": "ahead"})
		holder.waitJob(held.ID, "running")
		j := queuedJob(t, owner.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
		owner.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", j.ID), nil, http.StatusOK)
		q.let()
		holder.waitJob(held.ID, "succeeded")
		if left := spooled(t, srv); len(left) != 1 {
			t.Fatalf("the stopped import's upload is not kept: %v", left)
		}
	}

	t.Run("a factory reset", func(t *testing.T) {
		srv := newTestServer(t)
		q := queueing(t, srv)
		admin := signupAdmin(t, srv.Handler())
		stoppedUpload(t, srv, q, admin, admin)
		safetyBackup(t, admin)
		admin.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
		if left := spooled(t, srv); len(left) != 0 {
			t.Fatalf("after a factory reset the spool still holds %v", left)
		}
	})

	t.Run("a restore that takes the account away", func(t *testing.T) {
		srv := newTestServer(t)
		q := queueing(t, srv)
		h := srv.Handler()
		admin := signupAdmin(t, h)
		backupNow(admin) // the archive holds the admin alone
		bob := addUser(t, h, admin, "bob")
		stoppedUpload(t, srv, q, admin, bob)
		safetyBackup(t, admin)
		admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
		if left := spooled(t, srv); len(left) != 0 {
			t.Fatalf("after a restore without bob the spool still holds his upload: %v", left)
		}
	})
}
