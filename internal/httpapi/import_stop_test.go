package httpapi

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"tippani/internal/jobs"
)

// A STOP PRESSED ON AN IMPORT OR AN APPROVAL LANDS AT ONCE AND BREAKS NOTHING.
//
// The owner's two asks of 28 September, which every queued kind answers: "the
// job cancel button must also be the most responsive kill switch", and "Stop
// cancels instantly: but it still shall not break anything". Neither of these two
// kinds looks outward, so there is no call on the wire for a Stop to cut; what it
// lands between is the kind's own steps. Each case stops the job at one of them,
// and then reads, through the API as the screens read it, what a person would
// check: the job reads stopped well inside a second of the press; every work is
// either wholly done or wholly untouched — an import stages all of its file or
// none of it, an approval puts a work in the library with every quote or leaves
// it staged with every quote; the data directory holds no half-written file and
// the spool nothing but the upload a stopped import keeps; the job queued behind
// runs as soon as the stopped one lets go, and finishes; and the stopped job, run
// again, finishes the work.
//
// WHAT IT KNOWS, declared: what import_jobs_test.go's header declares (the queue,
// the test kind that holds it, the wire field names, the spool's place), and one
// thing more that no request can reach: importStopSeam, the hook at each place a
// Stop is heard. A job here takes milliseconds, so without the seam there is no
// moment a press can be made to land at a named step. The seam holds the job at
// that step until the job has been told to stop — the press is made from another
// goroutine while it is held, as a person's lands while the job runs — and
// records which steps the job reached after that, since "it stopped at the first
// place it could" is the difference between a check that works and one a later
// check covers for. Two of the steps sit inside a transaction, where the job
// holds SQLite's write lock: the press's own write waits for it, as a real one
// does, so the Stop's answer comes once the job has let go. Run under -race.

// stopAt holds a job at one step until the job is told to stop, and records each
// step the job reaches after that.
type stopAt struct {
	point   string
	n       int
	reached chan struct{}
	once    sync.Once

	mu    sync.Mutex
	after []string
	told  bool
}

// setImportSeam sets importStopSeam to fn for this test, and takes it away only
// once srv's queue has closed.
//
// THE ORDER IS THE POINT. Cleanups run last registered first, so a seam cleared
// by one registered here, after newTestServer's and queueing's, was cleared while
// the queue they close was still running. On a failing test that is while an
// import the seam held, let go by the test's cleanups, is still reading it
// (runImport's check at importStagedPoint, importHalted's at each step): a race
// the detector reports, and a call through a nil func when the clear fell
// between the check and the call. Closing the queue first waits for that import
// to end (a held one is let go by the close itself, which tells it to stop).
func setImportSeam(t *testing.T, srv *Server, fn func(ctx context.Context, point string, n int)) {
	t.Helper()
	importStopSeam = fn
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Jobs.Close(ctx)
		importStopSeam = nil
	})
}

// holdAt sets importStopSeam to hold the job at point, work n, for this test
// (setImportSeam).
func holdAt(t *testing.T, srv *Server, point string, n int) *stopAt {
	t.Helper()
	h := &stopAt{point: point, n: n, reached: make(chan struct{})}
	setImportSeam(t, srv, func(ctx context.Context, p string, i int) {
		h.mu.Lock()
		if h.told {
			h.after = append(h.after, fmt.Sprintf("%s %d", p, i))
		}
		h.mu.Unlock()
		if p != h.point || i != h.n {
			return
		}
		h.once.Do(func() {
			close(h.reached)
			j, _ := jobs.From(ctx).(*jobs.Job)
			deadline := time.Now().Add(20 * time.Second)
			for j != nil && !j.Stopping() && time.Now().Before(deadline) {
				time.Sleep(time.Millisecond)
			}
			h.mu.Lock()
			h.told = true
			h.mu.Unlock()
		})
	})
	return h
}

// wait blocks until the job is held.
func (h *stopAt) wait(t *testing.T) {
	t.Helper()
	select {
	case <-h.reached:
	case <-time.After(20 * time.Second):
		t.Fatalf("the job never reached %s %d", h.point, h.n)
	}
}

// reachedAfter is every step the job reached once it was told to stop.
func (h *stopAt) reachedAfter() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]string(nil), h.after...)
}

// stoppedWithin presses Stop on job id while it is held, and fails unless the
// press is answered 200 and the job reads stopped within 300 ms of it (three
// times that under the race detector, race_on_test.go).
func stoppedWithin(t *testing.T, c *testClient, id int64) wireJob {
	t.Helper()
	bound := 300 * time.Millisecond * underRace
	pressed := time.Now()
	answered := make(chan int, 1)
	go func() { answered <- c.do("POST", fmt.Sprintf("/jobs/%d/stop", id), nil).Code }()
	for {
		j := c.job(id)
		if j.State == "stopped" {
			if took := time.Since(pressed); took > bound {
				t.Fatalf("job %d read stopped %s after the press", id, took)
			}
			if code := <-answered; code != http.StatusOK {
				t.Fatalf("the Stop was answered %d", code)
			}
			return j
		}
		if j.State != "running" {
			t.Fatalf("job %d ended %s after the Stop: %+v", id, j.State, j)
		}
		if time.Since(pressed) > bound {
			t.Fatalf("job %d still reads %s %s after the press", id, j.State, bound)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

// leftovers is every file under the data directory a write that did not finish
// would leave: a temporary name, a partial archive, a restore's working copy.
func leftovers(t *testing.T, srv *Server) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir(srv.DataDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		n := strings.ToLower(d.Name())
		if strings.Contains(n, "tmp") || strings.Contains(n, "partial") || strings.HasSuffix(n, ".part") ||
			strings.HasPrefix(n, ".backup-") || strings.HasPrefix(n, ".restore-") {
			out = append(out, path)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// twoBookClippings is a Kindle file of two books with two highlights each, so an
// import of it stages two works and there is a moment between them.
var twoBookClippings = strings.Join([]string{
	"We Are Here (Michael Marshall)",
	"- Your Highlight on Page 11 | Chapter 2",
	"",
	"That meant a change was coming.",
	"==========",
	"We Are Here (Michael Marshall)",
	"- Your Highlight on Page 12 | Chapter 2",
	"",
	"Nobody was listening any more.",
	"==========",
	"Grimm's Fairy Tales (Jacob Grimm)",
	"- Your Highlight on Page 8 | THE ROBBER BRIDEGROOM",
	"",
	"Alas, poor child.",
	"==========",
	"Grimm's Fairy Tales (Jacob Grimm)",
	"- Your Highlight on Page 9 | THE ROBBER BRIDEGROOM",
	"",
	"Turn back, you bonny bride.",
	"==========",
	"",
}, "\n")

// The three stagers an import can reach, each with a file of its own: a book
// export's (stageBooks, two works), a film's (stageMovies) and a file of quotes
// (stageQuotesFile), each of those one work.
type stopFile struct {
	what, route, name, body string
	quotes, works           int
}

var (
	twoBooksFile = stopFile{"two books", "/import/kindle-clippings", "My Clippings.txt", twoBookClippings, 4, 2}
	aFilm        = stopFile{"a film", "/import/markdown", "goodbye.md", stagedFilmMD, 2, 1}
	someLines    = stopFile{"a file of quotes", "/import/markdown", "speeches.md",
		"---\ntype: quotes\n---\n\n## A kitchen\n\n> The river keeps its own counsel.\n- speaker: Mira\n\n" +
			"## A ferry\n\n> Nobody counts the stairs going down.\n- speaker: Mira\n", 2, 1}
)

// Mutations, each red here and nowhere else: runImport's check at its claim
// ignoring a Stop (import.start: the job goes on to stage.work 0); a stager's
// check between works ignoring it (stage.work: it goes on to the next work or to
// stage.commit); the check before the commit ignoring it (stage.commit: the file
// is staged, and its upload gone); runImport removing the upload after a Stop
// (the rerun has no file).
func TestAStoppedImportBreaksNothingWhereverTheStopLands(t *testing.T) {
	for _, at := range []struct {
		file  stopFile
		point string
		n     int
	}{
		{twoBooksFile, stopImportStart, 0},
		{twoBooksFile, stopStageWork, 0},
		{twoBooksFile, stopStageWork, 1},
		{twoBooksFile, stopStageCommit, 0},
		{aFilm, stopStageWork, 0},
		{aFilm, stopStageCommit, 0},
		{someLines, stopStageWork, 0},
		{someLines, stopStageCommit, 0},
	} {
		t.Run(fmt.Sprintf("%s at %s %d", at.file.what, at.point, at.n), func(t *testing.T) {
			srv := newTestServer(t)
			q := queueing(t, srv)
			c := signupAdmin(t, srv.Handler())

			// The import waits behind one job, and another waits behind it: the
			// queue has to carry on past the one about to be stopped.
			ahead := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
			c.waitJob(ahead.ID, "running")
			h := holdAt(t, srv, at.point, at.n)
			j := queuedJob(t, c.uploadOnly(at.file.route, at.file.name, []byte(at.file.body)))
			behind := c.mustStart("test.hold", map[string]any{"tag": "behind"})
			q.let()
			h.wait(t)

			stopped := stoppedWithin(t, c, j.ID)
			if !stopped.Rerunnable {
				t.Fatalf("the stopped import is not offered Run again: %+v", stopped)
			}
			if after := h.reachedAfter(); len(after) != 0 {
				t.Fatalf("the import went on to %v after the Stop at %s %d", after, at.point, at.n)
			}
			// Nothing of the file staged, not one of its works.
			if got := queue(t, c, ""); len(got.Batches) != 0 || len(got.Works) != 0 || len(got.Quotes) != 0 {
				t.Fatalf("a stopped import staged something: %+v", got)
			}
			// The upload is kept for the rerun, and nothing else is on the disk.
			if left := spooled(t, srv); len(left) != 1 {
				t.Fatalf("the spool after the Stop: %v, want the stopped import's upload alone", left)
			}
			if bad := leftovers(t, srv); len(bad) != 0 {
				t.Fatalf("a half-written file after the Stop: %v", bad)
			}
			saying(t, jobLines(c, j.ID), "stopped before anything was staged", "the upload is kept")

			// The queue goes on: the job behind starts at once, and finishes.
			c.waitJob(behind.ID, "running")
			q.let()
			c.waitJob(behind.ID, "succeeded")

			// And run again, the import stages the whole file.
			importStopSeam = nil
			again := c.followed(c.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", j.ID), nil, http.StatusAccepted))
			if again.Code != http.StatusOK {
				t.Fatalf("the stopped import run again: %d %s", again.Code, again.Body)
			}
			if got := decode[stageReply](t, again); got.Staged != at.file.quotes || len(got.Works) != at.file.works {
				t.Fatalf("the rerun staged %+v, want %d quotes over %d works", got, at.file.quotes, at.file.works)
			}
			if left := spooled(t, srv); len(left) != 0 {
				t.Fatalf("the spool after the rerun: %v", left)
			}
		})
	}
}

// A STOP ON A JOB WAITING BEHIND A RUNNING IMPORT IS ANSWERED AT ONCE. The import
// stages its whole file in one transaction, and while it does it holds SQLite's
// write lock; a waiting job's Stop is a write of that job's row, so it waited for
// the import, up to busy_timeout's five seconds, the owner's "most responsive kill
// switch" answering a press on a job that had not even started with a pause and,
// past five seconds, an error. Here the import is held just before its staging
// commits, inside that transaction, for as long as the test likes, and the job
// waiting behind it is stopped. The press has to be answered 200 within 300 ms
// (three times that under the race detector), and its answer, Current jobs and
// the summary have to read the job stopped while the import still holds the
// lock. Once the import lets go it finishes, and the stopped job reads stopped,
// never started, with no line of its run in its log.
//
// Mutations: the queue's Stop on a waiting job back to writing the row before it
// answers (internal/jobs Stop's old UPDATE ... WHERE state = 'queued'): red, the
// press answered 500 after busy_timeout. The API's reads without the queue's
// memory (settle and shownState dropped): red, the press's own answer reads the
// job queued.
func TestAStopOnAJobWaitingBehindARunningImportIsAnsweredAtOnce(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	c := signupAdmin(t, srv.Handler())

	// The import waits behind one job, which holds it back until the job behind
	// the import is queued too: queueing is a write, and has to be done before
	// the import takes the lock.
	ahead := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
	c.waitJob(ahead.ID, "running")
	reached, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	setImportSeam(t, srv, func(_ context.Context, point string, _ int) {
		if point == stopStageCommit {
			once.Do(func() { close(reached) })
			<-release
		}
	})
	imp := queuedJob(t, c.uploadOnly(twoBooksFile.route, twoBooksFile.name, []byte(twoBooksFile.body)))
	behind := c.mustStart("test.hold", map[string]any{"tag": "behind"})
	q.let()
	select {
	case <-reached:
	case <-time.After(20 * time.Second):
		t.Fatal("the import never reached the step before its staging commits")
	}
	let := sync.OnceFunc(func() { close(release) })
	t.Cleanup(let)

	pressed := time.Now()
	rec := c.do("POST", fmt.Sprintf("/jobs/%d/stop", behind.ID), nil)
	took := time.Since(pressed)
	if rec.Code != http.StatusOK {
		t.Fatalf("the Stop on the waiting job was answered %d %s after %s", rec.Code, rec.Body, took)
	}
	if bound := 300 * time.Millisecond * underRace; took > bound {
		t.Fatalf("the Stop on the waiting job was answered %s after the press, with the import's lock held", took)
	}
	if got := decode[struct {
		Job wireJob `json:"job"`
	}](t, rec).Job; got.State != "stopped" {
		t.Fatalf("the Stop's own answer reads the job %s", got.State)
	}
	// Every read of the queue says so while the import still holds the lock.
	current := c.jobs("view=current")
	if ids := jobIDs(current.Jobs); len(ids) != 1 || ids[0] != imp.ID || current.Waiting != 0 {
		t.Fatalf("Current jobs while the import holds the lock: %v, %d waiting; want the import alone", ids, current.Waiting)
	}
	summary := decode[struct {
		Waiting int `json:"waiting"`
	}](t, c.mustDo("GET", "/jobs/summary", nil, http.StatusOK))
	if summary.Waiting != 0 {
		t.Fatalf("the summary counts %d waiting after the Stop", summary.Waiting)
	}

	let()
	c.waitJob(imp.ID, "succeeded")
	stopped := c.waitJob(behind.ID, "stopped")
	if stopped.StartedAt != nil {
		t.Fatalf("the stopped job was started: %+v", stopped)
	}
	lines := jobLines(c, behind.ID)
	saying(t, lines, "stopped it before it started")
	for _, l := range lines {
		if l.Line == "holding" {
			t.Fatalf("the stopped job ran: %+v", lines)
		}
	}
}

// AND A READ OF THE JOB SAYS STOPPED WHEN ITS ROW IS WRITTEN UNDER THE READ. The
// row of a job its Stop held is written once the lock frees, and the queue lets
// go of the mark after that write. A read of one job that took the row first and
// the queue's memory after could land that write between them: the row still
// waiting, the mark already gone, and the job answered as waiting after its Stop
// had said stopped. Here a Stop on the job holds it while another writer has the
// lock, so its row still reads waiting, and a second Stop, on another waiting
// job, writes both rows in the one instant between the read's two halves.
//
// WHAT IT KNOWS, declared: afterJobRowRead, the seam at that instant. Nothing on
// the wire holds it open.
//
// Mutation: visibleJob reading the queue's memory after the row, as it did: red,
// "the job reads queued".
func TestAJobItsStopHeldReadsStoppedWhenItsRowIsWrittenMidRead(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	c := signupAdmin(t, srv.Handler())
	ahead := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
	c.waitJob(ahead.ID, "running")
	behind := c.mustStart("test.hold", map[string]any{"tag": "behind"})
	other := c.mustStart("test.hold", map[string]any{"tag": "other"})

	// Somebody else's write holds the lock, so the Stop can only hold the job.
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'somebody else')`, time.Now().UnixMilli()); err != nil {
		t.Fatal(err)
	}
	c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", behind.ID), nil, http.StatusOK)
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	var row string
	if err := srv.Store.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, behind.ID).Scan(&row); err != nil || row != "queued" {
		t.Fatalf("the held job's row reads %q (%v) before the read; the test needs it still owed", row, err)
	}

	var once sync.Once
	fired := make(chan struct{})
	afterJobRowRead = func() {
		select {
		case <-fired:
			return // the second Stop's own answer reads its job too
		default:
		}
		once.Do(func() {
			close(fired)
			c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", other.ID), nil, http.StatusOK)
		})
	}
	t.Cleanup(func() { afterJobRowRead = nil })
	got := c.job(behind.ID)
	select {
	case <-fired:
	default:
		t.Fatal("the read never reached the seam")
	}
	if got.State != "stopped" {
		t.Fatalf("its row written between the read's two halves, the job reads %s", got.State)
	}
	if err := srv.Store.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, behind.ID).Scan(&row); err != nil || row != "stopped" {
		t.Fatalf("the second Stop did not write the held row (it reads %q, %v)", row, err)
	}
}

// Mutations, each red here: approveStaged's check before a work ignoring a Stop
// (approve.work 0 writes the first book, approve.work 1 the second — and each goes
// on to that work's approve.commit); approveWork's check before its commit
// ignoring it (approve.commit n writes work n, and the job reads succeeded when n
// is the last); approveWork committing the work it was stopped in (the book
// lands with the queue saying it is still staged).
func TestAStoppedApprovalBreaksNothingWhereverTheStopLands(t *testing.T) {
	for _, at := range []struct {
		point string
		n     int
		done  int // the works wholly in the library once it has stopped
	}{
		{stopApproveWork, 0, 0},
		{stopApproveCommit, 0, 0},
		{stopApproveWork, 1, 1},
		{stopApproveCommit, 1, 1},
	} {
		t.Run(fmt.Sprintf("%s %d", at.point, at.n), func(t *testing.T) {
			srv := newTestServer(t)
			q := queueing(t, srv)
			c := signupAdmin(t, srv.Handler())

			stage(t, c, "/import/markdown", "sandworm.md", []byte(stagedBookMD))
			second := strings.Replace(strings.Replace(stagedBookMD, "Sandworm Studies", "Arrakis Notes", 1),
				"Liet Kynes", "Stilgar", 1)
			stage(t, c, "/import/markdown", "arrakis.md", []byte(second))

			ahead := c.mustStart("test.hold", map[string]any{"tag": "ahead"})
			c.waitJob(ahead.ID, "running")
			h := holdAt(t, srv, at.point, at.n)
			j := queuedJob(t, c.do("POST", "/import/staged/approve", map[string]any{"all": true}))
			behind := c.mustStart("test.hold", map[string]any{"tag": "behind"})
			q.let()
			h.wait(t)

			stopped := stoppedWithin(t, c, j.ID)
			if !stopped.Rerunnable || stopped.Done != at.done {
				t.Fatalf("the stopped approval: %+v, want Run again offered and %d done", stopped, at.done)
			}
			if after := h.reachedAfter(); len(after) != 0 {
				t.Fatalf("the approval went on to %v after the Stop at %s %d", after, at.point, at.n)
			}
			wholeOrUntouched(t, c, at.done)
			if bad := leftovers(t, srv); len(bad) != 0 {
				t.Fatalf("a half-written file after the Stop: %v", bad)
			}
			// What it says it did is what it did.
			ap := decode[approveReply](t, c.answerOf(j.ID))
			if ap.Added != 2*at.done || len(ap.BookIDs) != at.done {
				t.Fatalf("the stopped approval says %+v, want %d books added", ap, at.done)
			}
			saying(t, jobLines(c, j.ID), "stay in the import queue")

			c.waitJob(behind.ID, "running")
			q.let()
			c.waitJob(behind.ID, "succeeded")

			importStopSeam = nil
			rest := decode[approveReply](t, c.followed(c.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", j.ID), nil, http.StatusAccepted)))
			if rest.Added != 2*(2-at.done) || rest.Pending != 0 {
				t.Fatalf("the approval run again: %+v", rest)
			}
			wholeOrUntouched(t, c, 2)
		})
	}
}

// wholeOrUntouched fails unless exactly done of the two staged books are in the
// library, each with both of its quotes, and every other one is still in the
// import queue, with both of its quotes.
func wholeOrUntouched(t *testing.T, c *testClient, done int) {
	t.Helper()
	if n := bookCount(t, c); n != done {
		t.Fatalf("%d books in the library, want %d", n, done)
	}
	anns := decode[annList](t, c.mustDo("GET", "/annotations", nil, http.StatusOK)).Annotations
	if len(anns) != 2*done {
		t.Fatalf("%d quotes in the library, want %d: a work went in part-way", len(anns), 2*done)
	}
	left := queue(t, c, "")
	if len(left.Works) != 2-done || len(left.Quotes) != 2*(2-done) {
		t.Fatalf("the import queue holds %d works and %d quotes, want %d and %d: a work was left part-way",
			len(left.Works), len(left.Quotes), 2-done, 2*(2-done))
	}
}
