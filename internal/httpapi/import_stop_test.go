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

// holdAt sets importStopSeam to hold the job at point, work n, for this test.
func holdAt(t *testing.T, point string, n int) *stopAt {
	t.Helper()
	h := &stopAt{point: point, n: n, reached: make(chan struct{})}
	importStopSeam = func(ctx context.Context, p string, i int) {
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
	}
	t.Cleanup(func() { importStopSeam = nil })
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
	twoBooks  = stopFile{"two books", "/import/kindle-clippings", "My Clippings.txt", twoBookClippings, 4, 2}
	aFilm     = stopFile{"a film", "/import/markdown", "goodbye.md", stagedFilmMD, 2, 1}
	someLines = stopFile{"a file of quotes", "/import/markdown", "speeches.md",
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
		{twoBooks, stopImportStart, 0},
		{twoBooks, stopStageWork, 0},
		{twoBooks, stopStageWork, 1},
		{twoBooks, stopStageCommit, 0},
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
			h := holdAt(t, at.point, at.n)
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
			h := holdAt(t, at.point, at.n)
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
