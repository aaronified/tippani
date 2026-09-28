package jobs_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/olog"
	"tippani/internal/outbound"
	"tippani/internal/store"
)

// THE QUEUE, THROUGH WHAT A PERSON WOULD SAY ABOUT IT.
//
// WHAT IT KNOWS, declared: the package's exported API, and the jobs and job_logs
// tables, which it reads back (the endpoints that would show them are a later
// stage of 3.1.0) and, for Boot, a deleted account and a job left waiting with
// no worker, writes as a crashed server, `tippani user del` or a claim that
// failed on a locked database would leave them. Where the database itself has
// to misbehave, it does so from outside: SQLite's write lock held from the
// library pool, as a long import holds it, and a trigger that refuses a job's
// finishing write, as a full disk would. And it reads what the server printed
// (olog's capture), where that line is the promise. The kinds are the test's own:
// "steps", whose every item waits until the test lets it finish, is how a test
// holds a job mid-item without a clock. One file here uses the journey tier's
// seam, TIPPANI_JOBS_HOLD (HoldEnv), and says so at the test that does.
//
// What each one guards, in a sentence a person would say: one job runs at a time
// across the server and the rest wait their turn in the order started; Stop stops
// at once, the item in hand abandoned and the row stopped within a moment of the
// press, and the job keeps its log, and one that lands once the last item is
// written leaves the job finished, not stopped; a reader's Stop all stops their
// own jobs and an admin's stops everyone's, as fast, and an account being deleted
// has its running job stopped as fast and starts nothing until its delete has
// ended; a Stop or a Stop all from before
// a restore swapped the database stops nothing; jobs a restart caught are
// interrupted and nothing resumes by itself; shutdown interrupts what it cannot
// finish and refuses anything new, and does not wait out a lock held elsewhere to
// say so; a restore waits for a running job and holds
// the queue while it runs; only the owner can run a job again; a job started
// twice, or a sixth, is refused with the reason; no job is left waiting with
// nothing to run it, and a Stop never loses a race with the job starting;
// progress is written every half second and always at the end; a job that
// crashes fails and the next one starts; a write lock held past its wait delays
// a job's start and end and loses neither; pressing a job that is already
// waiting starts the queue; a job whose end could not be recorded reads running
// until Stop settles it, and the server does not claim it ended otherwise; a job
// whose account went is not run for anybody else; the server's line for a job
// that ended names it in English, as its export does. (That a finished job's last
// lines are there when it says it finished is in seams_test.go: only a parked
// drainer shows it every time.)

type rig struct {
	t     *testing.T
	st    *store.Store
	lb    *jobs.Logbook
	r     *jobs.Runner
	steps *steps
}

func newRig(t *testing.T, opts jobs.Options) *rig {
	t.Helper()
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'aro', 'x', 1), (2, 'mitra', 'x', 0)`)
	lb := attached(t, st)
	r := jobs.NewRunner(st, lb, opts)
	g := &rig{t: t, st: st, lb: lb, r: r, steps: newSteps(t)}
	t.Cleanup(func() {
		g.steps.releaseAll()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		r.Close(ctx)
	})
	r.Register(g.steps.kind("steps", false))
	r.Register(jobs.Kind{Name: "quick", Rerunnable: true, Run: func(context.Context, *jobs.Job) error { return nil }})
	return g
}

func (g *rig) aro() jobs.Owner {
	return jobs.Owner{UserID: 1, Username: "aro", IsAdmin: true, Gen: g.st.Generation()}
}
func (g *rig) mitra() jobs.Owner {
	return jobs.Owner{UserID: 2, Username: "mitra", Gen: g.st.Generation()}
}

// enqueue queues a job and fails the test if it is refused.
func (g *rig) enqueue(o jobs.Owner, kind string, params any) int64 {
	g.t.Helper()
	id, err := g.r.Enqueue(o, kind, "", params, 0, nil)
	if err != nil {
		g.t.Fatalf("enqueue %s for %s: %v", kind, o.Username, err)
	}
	return id
}

// state is a job's state as the queue has it, which is what every screen reads:
// its row's, or stopped for a waiting job a Stop has stopped whose row has not
// been written yet (Held), since the Stop answers before it waits for the lock.
func (g *rig) state(id int64) string {
	g.t.Helper()
	s := g.row(id)
	if _, held := g.r.Held()[id]; held && s == "queued" {
		return "stopped"
	}
	return s
}

// row is what the job's row itself says its state is.
func (g *rig) row(id int64) string {
	g.t.Helper()
	var s string
	if err := g.st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&s); err != nil {
		g.t.Fatalf("job %d: %v", id, err)
	}
	return s
}

func (g *rig) waitState(id int64, want string) {
	g.t.Helper()
	eventually(g.t, fmt.Sprintf("job %d %s (it is %s)", id, want, g.state(id)), func() bool { return g.state(id) == want })
}

// lines is a job's log, in order. The logbook is flushed first.
func (g *rig) lines(id int64) []string {
	g.t.Helper()
	flush(g.t, g.lb)
	return strings1(g.t, g.st.DB, `SELECT line FROM job_logs WHERE job_id = ? ORDER BY id`, id)
}

type item struct {
	job int64
	i   int
}

// steps is a kind whose items wait for the test: each announces itself and does
// not finish until released, and Stopping is checked before each one, as every
// real kind's loop does. An item whose context ends while it waits is abandoned,
// as a real kind abandons the item a Stop lands in: it logs nothing, counts
// nothing, and asks Stopping on its way out.
type steps struct {
	t       *testing.T
	entered chan item
	release chan struct{}
	done    chan struct{}
	once    sync.Once
}

func newSteps(t *testing.T) *steps {
	return &steps{t: t, entered: make(chan item), release: make(chan struct{}), done: make(chan struct{})}
}

func (s *steps) kind(name string, adminOnly bool) jobs.Kind {
	return jobs.Kind{Name: name, AdminOnly: adminOnly, Rerunnable: true, Run: func(ctx context.Context, j *jobs.Job) error {
		var p struct {
			N int `json:"n"`
		}
		if err := j.Params(&p); err != nil {
			return err
		}
		for i := range p.N {
			if j.Stopping() {
				return nil
			}
			select {
			case s.entered <- item{j.ID(), i}:
			case <-ctx.Done():
				j.Stopping()
				return nil
			case <-s.done:
				return nil
			}
			select {
			case <-s.release:
			case <-ctx.Done():
				j.Stopping()
				return nil
			case <-s.done:
				return nil
			}
			j.Log(jobs.LevelInfo, "item %d done", i)
			j.Progress(i+1, p.N)
		}
		return nil
	}}
}

// stopWithin is how soon after the press a Stop must have landed: 300 ms, the
// product's bound, and three times that under the race detector (UnderRace,
// race_on_test.go says why).
const stopWithin = 300 * time.Millisecond * jobs.UnderRace

// stoppedWithin fails unless job id reads stopped within bound of from, the
// moment the Stop was pressed: its row, polled until it does.
func (g *rig) stoppedWithin(id int64, from time.Time, bound time.Duration) {
	g.t.Helper()
	for g.state(id) != "stopped" {
		if time.Since(from) > 20*time.Second {
			g.t.Fatalf("job %d never read stopped (it reads %s)", id, g.state(id))
		}
		time.Sleep(2 * time.Millisecond)
	}
	if took := time.Since(from); took > bound {
		g.t.Fatalf("job %d read stopped %s after the press, want within %s", id, took, bound)
	}
}

// next is the next item to start, anybody's.
func (s *steps) next() item {
	s.t.Helper()
	select {
	case it := <-s.entered:
		return it
	case <-time.After(20 * time.Second):
		s.t.Fatal("no item started")
		return item{}
	}
}

func (s *steps) let() {
	s.t.Helper()
	select {
	case s.release <- struct{}{}:
	case <-time.After(20 * time.Second):
		s.t.Fatal("no item was waiting to finish")
	}
}

// quiet asserts that no item starts for a while.
func (s *steps) quiet(d time.Duration) {
	s.t.Helper()
	select {
	case it := <-s.entered:
		s.t.Fatalf("job %d started item %d", it.job, it.i)
	case <-time.After(d):
	}
}

func (s *steps) releaseAll() { s.once.Do(func() { close(s.done) }) }

func n(k int) map[string]any { return map[string]any{"n": k} }

func TestOneJobRunsAtATimeInTheOrderStarted(t *testing.T) {
	g := newRig(t, jobs.Options{})
	a := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "tag": "a"})
	b := g.enqueue(g.aro(), "steps", map[string]any{"n": 1, "tag": "b"})
	c := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "tag": "c"})

	for _, want := range []int64{a, b, c} {
		it := g.steps.next()
		if it.job != want {
			t.Fatalf("job %d started, want %d: jobs run in the order started", it.job, want)
		}
		if n := count(t, g.st.DB, `SELECT count(*) FROM jobs WHERE state = 'running'`); n != 1 {
			t.Fatalf("%d jobs running at once", n)
		}
		if want == a {
			for id, ahead := range map[int64]int{a: 0, b: 1, c: 2} {
				if got, err := g.r.Ahead(id); err != nil || got != ahead {
					t.Fatalf("job %d has %d ahead (%v), want %d", id, got, err, ahead)
				}
			}
			if g.state(b) != "queued" || g.state(c) != "queued" {
				t.Fatalf("while a runs: b %s, c %s, want both waiting", g.state(b), g.state(c))
			}
		}
		g.steps.let()
	}
	g.waitState(c, "succeeded")
	for _, pair := range [][2]int64{{a, b}, {b, c}} {
		if n := count(t, g.st.DB, `SELECT count(*) FROM jobs p, jobs q WHERE p.id = ? AND q.id = ? AND q.started_at >= p.finished_at`, pair[0], pair[1]); n != 1 {
			t.Fatalf("job %d started before job %d had finished", pair[1], pair[0])
		}
	}
}

// STOP IS AT ONCE. Pressed while item 1 is in hand, it cancels the job there and
// then: item 1 is abandoned, never finished, and the row reads stopped within a
// moment of the press, with what was done before it counted and the press named
// in the log ahead of the end.
func TestStopStopsAtOnceAndTheJobKeepsItsLog(t *testing.T) {
	g := newRig(t, jobs.Options{})
	x := g.enqueue(g.mitra(), "steps", n(5))
	if it := g.steps.next(); it != (item{x, 0}) {
		t.Fatalf("started %v", it)
	}
	g.steps.let()
	if it := g.steps.next(); it != (item{x, 1}) {
		t.Fatalf("started %v", it)
	}
	w := g.enqueue(g.mitra(), "steps", n(1))
	if err := g.r.Stop(w, g.mitra()); err != nil { // still waiting: stopped before it starts
		t.Fatal(err)
	}
	if g.state(w) != "stopped" {
		t.Fatalf("a waiting job read %s after Stop", g.state(w))
	}
	pressed := time.Now()
	if err := g.r.Stop(x, g.mitra()); err != nil {
		t.Fatal(err)
	}
	g.stoppedWithin(x, pressed, stopWithin)
	g.steps.quiet(300 * time.Millisecond) // and the stopped waiting job never starts

	var done, total, stopReq int
	if err := g.st.DB.QueryRow(`SELECT done, total, stop_requested FROM jobs WHERE id = ?`, x).Scan(&done, &total, &stopReq); err != nil {
		t.Fatal(err)
	}
	if done != 1 || total != 5 || stopReq != 1 {
		t.Fatalf("stopped job: done %d/%d, stop_requested %d; want the one item finished before the press", done, total, stopReq)
	}
	// In the order it happened: item 0 finished, Stop was pressed with item 1 in
	// hand, and item 1 never finished.
	want := []string{"item 0 done", "mitra pressed Stop", "stopped"}
	if got := g.lines(x); strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("its log: %q, want %q", got, want)
	}
	if got := g.lines(w); len(got) != 1 || got[0] != "mitra stopped it before it started" {
		t.Fatalf("the waiting job's log: %q", got)
	}
	if n := count(t, g.st.DB, `SELECT count(*) FROM jobs WHERE id = ? AND started_at IS NULL AND finished_at IS NOT NULL`, w); n != 1 {
		t.Fatal("the job stopped while waiting has a start time, or no finish time")
	}

	// Another reader's job does not exist for them; an admin may stop anyone's.
	y := g.enqueue(g.aro(), "steps", n(1))
	if err := g.r.Stop(y, g.mitra()); !errors.Is(err, jobs.ErrNotFound) {
		t.Fatalf("mitra stopping aro's job: %v, want ErrNotFound", err)
	}
	if err := g.r.Stop(99999, g.aro()); !errors.Is(err, jobs.ErrNotFound) {
		t.Fatalf("stopping a job that does not exist: %v", err)
	}
	g.steps.next()
	z := g.enqueue(g.mitra(), "steps", n(1))
	if err := g.r.Stop(z, g.aro()); err != nil || g.state(z) != "stopped" {
		t.Fatalf("the admin stopping mitra's waiting job: %v, %s", err, g.state(z))
	}
	g.steps.let()
	g.waitState(y, "succeeded")
	if err := g.r.Stop(y, g.aro()); err != nil || g.state(y) != "succeeded" {
		t.Fatalf("Stop on a finished job: %v, and it now reads %s", err, g.state(y))
	}
}

// A STOP THAT LANDS ONCE THE LAST ITEM IS WRITTEN HAS NOTHING LEFT TO STOP. The
// job has done everything it was given — it is only keeping its result — so it
// succeeded; it did not stop, and it has nothing left over to run again. A
// shutdown landing on the last item is the same: the server stopped after the job
// had finished, not while it ran.
func TestAStopThatLandsOnceTheLastItemIsDoneLeavesTheJobFinished(t *testing.T) {
	t.Run("stop", func(t *testing.T) {
		g := newRig(t, jobs.Options{})
		// Its one item, then the keeping of its result, which a Stop does not
		// reach into: a database write carries no context.
		kept, keep := make(chan struct{}), make(chan struct{})
		g.r.Register(jobs.Kind{Name: "keeps", Run: func(ctx context.Context, j *jobs.Job) error {
			if j.Stopping() {
				return nil
			}
			j.Log(jobs.LevelInfo, "item 0 done")
			j.Progress(1, 1)
			close(kept)
			<-keep
			return j.SetResult(map[string]int{"done": 1})
		}})
		id := g.enqueue(g.mitra(), "keeps", nil)
		<-kept
		if err := g.r.Stop(id, g.mitra()); err != nil {
			t.Fatal(err)
		}
		close(keep)
		g.waitState(id, "succeeded")
		want := []string{"item 0 done", "mitra pressed Stop"}
		if got := g.lines(id); strings.Join(got, "|") != strings.Join(want, "|") {
			t.Fatalf("its log: %q, want %q", got, want)
		}
	})
	t.Run("shutdown", func(t *testing.T) {
		g := newRig(t, jobs.Options{})
		id := g.enqueue(g.mitra(), "steps", n(1))
		g.steps.next()
		closed := make(chan error, 1)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			closed <- g.r.Close(ctx)
		}()
		// Refusing a new job is the same moment Close asks the running one to
		// stop (one lock), so from here the item in hand is the last under a
		// shutdown.
		eventually(t, "Close refuses new jobs", func() bool {
			_, err := g.r.Enqueue(g.mitra(), "quick", "", map[string]any{"late": true}, 0, nil)
			return errors.Is(err, jobs.ErrClosed)
		})
		g.steps.let()
		if err := <-closed; err != nil {
			t.Fatal(err)
		}
		if s := g.state(id); s != "succeeded" {
			t.Fatalf("a job whose last item finished as the server stopped reads %s, want succeeded", s)
		}
	})
}

func TestStopAllStopsWhatTheViewerCanSee(t *testing.T) {
	g := newRig(t, jobs.Options{})
	m1 := g.enqueue(g.mitra(), "steps", map[string]any{"n": 3, "t": 1})
	g.steps.next()
	m2 := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "t": 2})
	a1 := g.enqueue(g.aro(), "steps", map[string]any{"n": 2, "t": 3})
	m3 := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "t": 4})

	pressed := time.Now()
	stopping, waiting, err := g.r.StopAll(g.mitra())
	if err != nil || stopping != 1 || waiting != 2 {
		t.Fatalf("mitra's Stop all: %d stopping, %d stopped waiting, %v; want 1 and 2", stopping, waiting, err)
	}
	// Aro's job is not hers to stop. It waits, or has already started: her running
	// job is cancelled at the press, so it can have ended, and the worker moved on,
	// before Stop all has returned.
	if s := g.state(a1); g.state(m2) != "stopped" || g.state(m3) != "stopped" || (s != "queued" && s != "running") {
		t.Fatalf("after mitra's Stop all: m2 %s, m3 %s, aro's a1 %s", g.state(m2), g.state(m3), s)
	}
	g.stoppedWithin(m1, pressed, stopWithin) // its item in hand was not waited for
	if it := g.steps.next(); it.job != a1 {
		t.Fatalf("after mitra's jobs stopped, job %d started, want aro's %d", it.job, a1)
	}
	if got := g.lines(m1); strings.Join(got, "|") != "mitra pressed Stop all|stopped" {
		t.Fatalf("mitra's running job stopped by her Stop all says %q", got)
	}

	m4 := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "t": 5})
	pressed = time.Now()
	stopping, waiting, err = g.r.StopAll(g.aro())
	if err != nil || stopping != 1 || waiting != 1 {
		t.Fatalf("the admin's Stop all: %d stopping, %d stopped waiting, %v; want 1 and 1", stopping, waiting, err)
	}
	if g.state(m4) != "stopped" {
		t.Fatalf("the admin's Stop all left mitra's waiting job %s", g.state(m4))
	}
	g.stoppedWithin(a1, pressed, stopWithin)
	if got := g.lines(m4); len(got) != 1 || got[0] != "aro stopped it before it started" {
		t.Fatalf("mitra's job stopped by the admin says %q", got)
	}

	// The account going: its waiting jobs stop, and so does its running one, at once.
	m5 := g.enqueue(g.mitra(), "steps", map[string]any{"n": 2, "t": 6})
	g.steps.next()
	m6 := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "t": 7})
	a2 := g.enqueue(g.aro(), "steps", map[string]any{"n": 1, "t": 8})
	pressed = time.Now()
	release, err := g.r.StopOwner(2)
	if err != nil {
		t.Fatal(err)
	}
	if g.state(m6) != "stopped" {
		t.Fatalf("after StopOwner(mitra): m6 %s", g.state(m6))
	}
	// Until the delete ends, the account going starts nothing; anybody else can.
	if _, err := g.r.Enqueue(g.mitra(), "quick", "", map[string]any{"t": 9}, 0, nil); !errors.Is(err, jobs.ErrNoOwner) {
		t.Fatalf("mitra starting a job while her account is being deleted: %v, want ErrNoOwner", err)
	}
	a3 := g.enqueue(g.aro(), "quick", map[string]any{"t": 10})
	g.stoppedWithin(m5, pressed, stopWithin)
	if it := g.steps.next(); it.job != a2 {
		t.Fatalf("after mitra's jobs stopped, job %d started, want aro's %d", it.job, a2)
	}
	g.steps.let()
	g.waitState(a2, "succeeded")
	g.waitState(a3, "succeeded")
	// And once it has ended without the account going, it can again.
	release()
	release()
	g.waitState(g.enqueue(g.mitra(), "quick", map[string]any{"t": 11}), "succeeded")
}

// A STOP REACHES A JOB THAT HOLDS THE WRITE LOCK AT ONCE. An import stages its
// file in one transaction and asks, from inside it, whether to stop, so that a
// Stop rolls the whole file back; so does an approval, per work. Every Stop writes
// — the waiting row it stops, the running row's flag — and each write waits for
// that lock. A Stop that told the job only after its writes waited for the
// transaction to finish by itself, too late to stop it, or failed after five
// seconds. So the job is told first: this one holds the lock until it is, and
// each of the three ways to stop it — Stop, Stop all, an account's delete — has
// to reach it, and see it end stopped, well inside a second.
//
// Mutation: signalRunning taken out of Stop, stopWhere or both: each press waits
// out busy_timeout against the job's own lock and fails, and the job reads
// running long past 300 ms.
func TestAStopReachesAJobHoldingTheWriteLockAtOnce(t *testing.T) {
	for _, way := range []string{"stop", "stop all", "the account going"} {
		t.Run(way, func(t *testing.T) {
			g := newRig(t, jobs.Options{})
			entered := make(chan struct{})
			g.r.Register(jobs.Kind{Name: "staging", Rerunnable: true, Run: func(_ context.Context, j *jobs.Job) error {
				tx, err := g.st.DB.Begin() // _txlock=immediate: the lock is taken here
				if err != nil {
					return err
				}
				defer tx.Rollback()
				if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'staging')`, time.Now().UnixMilli()); err != nil {
					return err
				}
				close(entered)
				deadline := time.Now().Add(20 * time.Second)
				for !j.Stopping() {
					if time.Now().After(deadline) {
						return errors.New("never told to stop")
					}
					time.Sleep(time.Millisecond)
				}
				return nil // rolled back whole
			}})
			id := g.enqueue(g.mitra(), "staging", nil)
			<-entered

			pressed := time.Now()
			answered := make(chan error, 1)
			go func() {
				switch way {
				case "stop":
					answered <- g.r.Stop(id, g.mitra())
				case "stop all":
					_, _, err := g.r.StopAll(g.mitra())
					answered <- err
				default:
					release, err := g.r.StopOwner(2)
					release()
					answered <- err
				}
			}()
			eventually(t, fmt.Sprintf("job %d stopped (it is %s)", id, g.state(id)), func() bool { return g.state(id) == "stopped" })
			if took := time.Since(pressed); took > stopWithin {
				t.Fatalf("%s: the job read stopped %s after the press, want within %s", way, took, stopWithin)
			}
			if err := <-answered; err != nil {
				t.Fatalf("%s answered %v", way, err)
			}
			if n := count(t, g.st.DB, `SELECT count(*) FROM system_logs WHERE line = 'staging'`); n != 0 {
				t.Fatalf("%s: the stopped job's write was kept", way)
			}
		})
	}
}

// AND THE PRESS CANCELS THE RUNNING JOB BEFORE IT WRITES ANYTHING. A job with a
// call on the wire is ended by its context, and every Stop's own writes wait for
// SQLite's write lock, which somebody else can be holding: a reader's save, a
// search rebuild's check. A cancel that came after those writes left the call
// running for as long as the lock was held, up to busy_timeout's five seconds,
// which is not the owner's "most responsive kill switch". So the lock is held
// here from outside, by a writer that is not the job, while the job waits on a
// call only its context ends; each of the three ways to stop it has to reach
// that call within 300 ms of the press, with the lock still held, and once the
// lock is let go the press answers and the job reads stopped.
//
// Mutation: the cancel taken out of signalRunning, so a press cancels the job only
// in stopHeldLocked, after its writes: all three subtests red, "the call on the
// wire was not cut while the lock was held".
func TestAStopCutsTheRunningJobsCallBeforeItsOwnWritesWait(t *testing.T) {
	for _, way := range []string{"stop", "stop all", "the account going"} {
		t.Run(way, func(t *testing.T) {
			g := newRig(t, jobs.Options{})
			entered := make(chan struct{})
			cut := make(chan time.Time, 1)
			g.r.Register(jobs.Kind{Name: "lookup", Rerunnable: true, Run: func(ctx context.Context, j *jobs.Job) error {
				close(entered)
				<-ctx.Done() // a call on the wire, which only its context ends
				cut <- time.Now()
				j.Stopping()
				return nil
			}})
			id := g.enqueue(g.mitra(), "lookup", nil)
			<-entered

			tx, err := g.st.DB.Begin() // _txlock=immediate: the write lock is taken here
			if err != nil {
				t.Fatal(err)
			}
			if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'somebody else')`, time.Now().UnixMilli()); err != nil {
				t.Fatal(err)
			}
			pressed := time.Now()
			answered := make(chan error, 1)
			go func() {
				switch way {
				case "stop":
					answered <- g.r.Stop(id, g.mitra())
				case "stop all":
					_, _, err := g.r.StopAll(g.mitra())
					answered <- err
				default:
					release, err := g.r.StopOwner(2)
					release()
					answered <- err
				}
			}()
			select {
			case at := <-cut:
				if took := at.Sub(pressed); took > stopWithin {
					t.Fatalf("%s: the call on the wire was cut %s after the press, want within %s", way, took, stopWithin)
				}
			case <-time.After(time.Second):
				_ = tx.Rollback()
				t.Fatalf("%s: the call on the wire was not cut while the lock was held", way)
			}
			if err := tx.Rollback(); err != nil {
				t.Fatal(err)
			}
			if err := <-answered; err != nil {
				t.Fatalf("%s answered %v", way, err)
			}
			g.waitState(id, "stopped")
		})
	}
}

// A STOP ON A WAITING JOB IS ANSWERED AT ONCE WHILE THE RUNNING ONE HOLDS THE
// WRITE LOCK. A waiting job's Stop is its row's write, from waiting to stopped,
// and the job ahead of it can be holding SQLite's write lock for a while: an
// import stages its whole file in one transaction. The running job is not the
// one stopped, so nothing tells it to let go, and a Stop that wrote first waited
// for that transaction, up to busy_timeout's five seconds, and then answered an
// error. So here the job ahead holds the lock until the test lets it go, and a
// Stop and a Stop all on the job waiting behind it each have to answer within
// 300 ms with the lock still held, the queue reading the job as stopped (Held,
// what every read of the queue reads beside the rows). Once the lock is let go,
// the job ahead finishes, the stopped one's row says stopped, and it never ran.
//
// Mutation: Stop's waiting path back to writing the row before it answers (the
// UPDATE ... WHERE state = 'queued' it had): "stop" red, the press answered after
// busy_timeout with the lock's error. stopWhere's likewise: "stop all" red.
func TestAStopOnAWaitingJobIsAtOnceWhileTheRunningOneHoldsTheWriteLock(t *testing.T) {
	for _, way := range []string{"stop", "stop all"} {
		t.Run(way, func(t *testing.T) {
			g := newRig(t, jobs.Options{})
			start, entered, let := make(chan struct{}), make(chan struct{}), make(chan struct{})
			g.r.Register(jobs.Kind{Name: "staging", Run: func(context.Context, *jobs.Job) error {
				<-start
				tx, err := g.st.DB.Begin() // _txlock=immediate: the lock is taken here
				if err != nil {
					return err
				}
				defer tx.Rollback()
				if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'staging')`, time.Now().UnixMilli()); err != nil {
					return err
				}
				close(entered)
				<-let
				return tx.Commit()
			}})
			var ran atomic.Bool
			g.r.Register(jobs.Kind{Name: "behind", Run: func(context.Context, *jobs.Job) error {
				ran.Store(true)
				return nil
			}})
			// The job ahead is aro's, so mitra's Stop all has only her waiting one
			// to reach; both are queued before the lock is taken, since queueing is
			// a write too.
			ahead := g.enqueue(g.aro(), "staging", nil)
			behind := g.enqueue(g.mitra(), "behind", nil)
			close(start)
			<-entered

			pressed := time.Now()
			switch way {
			case "stop":
				if err := g.r.Stop(behind, g.mitra()); err != nil {
					t.Fatalf("the Stop answered %v after %s", err, time.Since(pressed))
				}
			default:
				stopping, waiting, err := g.r.StopAll(g.mitra())
				if err != nil || stopping != 0 || waiting != 1 {
					t.Fatalf("mitra's Stop all: %d stopping, %d stopped waiting, %v after %s; want 0 and 1",
						stopping, waiting, err, time.Since(pressed))
				}
			}
			if took := time.Since(pressed); took > stopWithin {
				t.Fatalf("%s on the waiting job answered %s after the press, with the lock held, want within %s", way, took, stopWithin)
			}
			if _, ok := g.r.Held()[behind]; !ok {
				t.Fatalf("%s answered, and the queue does not read the waiting job stopped", way)
			}

			close(let)
			g.waitState(ahead, "succeeded")
			// The row is written once the lock frees, and the queue lets go of
			// the job then.
			eventually(t, fmt.Sprintf("the stopped job's row says so (it says %s)", g.row(behind)), func() bool {
				_, held := g.r.Held()[behind]
				return !held && g.row(behind) == "stopped"
			})
			var started sql.NullInt64
			if err := g.st.DB.QueryRow(`SELECT started_at FROM jobs WHERE id = ?`, behind).Scan(&started); err != nil {
				t.Fatal(err)
			}
			if ran.Load() || started.Valid {
				t.Fatalf("the stopped job ran (its Run called: %v, started at %v)", ran.Load(), started)
			}
			if got := g.lines(behind); len(got) != 1 || got[0] != "mitra stopped it before it started" {
				t.Fatalf("the stopped job's log: %q", got)
			}
			// And the queue runs on: the same job, pressed again, is a new one
			// and runs.
			g.waitState(g.enqueue(g.mitra(), "behind", nil), "succeeded")
		})
	}
}

// A Stop and a Stop all from a request that signed in before the database was
// swapped are refused, and stop nothing: the id a Stop names, and the account a
// Stop all speaks for, belong to the file the request began on, and in the file
// the server is on now they may be somebody else's.
func TestAStopFromBeforeASwapIsRefusedAndStopsNothing(t *testing.T) {
	g := newRig(t, jobs.Options{})
	// Two items, and the Stop all at the end lands with the first in hand, which
	// it abandons.
	x := g.enqueue(g.mitra(), "steps", map[string]any{"n": 2, "t": "running"})
	g.steps.next()
	w := g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "t": "waiting"})
	mitra, aro := g.mitra(), g.aro()
	// The swap a restore makes, with nothing to move.
	if err := g.st.Swap(func() error { return nil }, nil, nil); err != nil {
		t.Fatal(err)
	}

	if err := g.r.Stop(w, mitra); !errors.Is(err, jobs.ErrStale) {
		t.Fatalf("Stop from a request that began before the swap: %v, want ErrStale", err)
	}
	if _, _, err := g.r.StopAll(aro); !errors.Is(err, jobs.ErrStale) {
		t.Fatalf("Stop all from a request that began before the swap: %v, want ErrStale", err)
	}
	if g.state(w) != "queued" || g.state(x) != "running" {
		t.Fatalf("after the refused stops: waiting %s, running %s", g.state(w), g.state(x))
	}
	if n := count(t, g.st.DB, `SELECT count(*) FROM jobs WHERE stop_requested = 1`); n != 0 {
		t.Fatalf("a refused stop asked %d job(s) to stop", n)
	}

	// Signed in again, on the file the server is on, the same presses work.
	if err := g.r.Stop(w, g.mitra()); err != nil || g.state(w) != "stopped" {
		t.Fatalf("Stop after signing in again: %v, the job reads %s", err, g.state(w))
	}
	if stopping, _, err := g.r.StopAll(g.aro()); err != nil || stopping != 1 {
		t.Fatalf("Stop all after signing in again: %d stopping, %v; want the running job", stopping, err)
	}
	g.waitState(x, "stopped")
}

func TestJobsARestartCaughtAreInterruptedAndNothingResumesByItself(t *testing.T) {
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`)
	// Timed an hour ago: the logbook's first write prunes, and a job finished in
	// 1970 would go with it.
	hourAgo := time.Now().Add(-time.Hour).UnixMilli()
	exec(t, st.DB, `INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at, finished_at) VALUES
		(10, 2, 'mitra', 'fill', 'queued', ?1, NULL, NULL),
		(11, 2, 'mitra', 'fill', 'running', ?1, ?1, NULL),
		(12, 2, 'mitra', 'fill', 'succeeded', ?1, ?1, ?1)`, hourAgo)
	lb := attached(t, st)
	r := jobs.NewRunner(st, lb, jobs.Options{})
	t.Cleanup(func() { r.Close(context.Background()) })
	var ran atomic.Int32
	r.Register(jobs.Kind{Name: "fill", Run: func(context.Context, *jobs.Job) error { ran.Add(1); return nil }})

	before := time.Now().UnixMilli()
	if err := r.Boot(); err != nil {
		t.Fatal(err)
	}
	got := strings1(t, st.DB, `SELECT id || ' ' || state || ' ' || (finished_at >= `+fmt.Sprint(before)+`) FROM jobs ORDER BY id`)
	if want := "10 interrupted 1|11 interrupted 1|12 succeeded 0"; strings.Join(got, "|") != want {
		t.Fatalf("after Boot: %q, want %q", strings.Join(got, "|"), want)
	}
	flush(t, lb)
	lines := strings1(t, st.DB, `SELECT job_id || ' ' || line FROM job_logs ORDER BY job_id`)
	if want := "10 the server restarted while this job was waiting|11 the server restarted while this job was running"; strings.Join(lines, "|") != want {
		t.Fatalf("lines: %q", lines)
	}
	time.Sleep(200 * time.Millisecond)
	if ran.Load() != 0 {
		t.Fatal("a job interrupted by the restart ran again by itself")
	}
	id, err := r.Enqueue(jobs.Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}, "fill", "", nil, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	eventually(t, "the job queued after Boot runs", func() bool { return ran.Load() == 1 })
	eventually(t, "it finishes", func() bool {
		return count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = ? AND state = 'succeeded'`, id) == 1
	})
}

func TestShutdownInterruptsWhatItCannotFinishAndRefusesAnythingNew(t *testing.T) {
	t.Run("a job that stops after its item", func(t *testing.T) {
		g := newRig(t, jobs.Options{})
		j1 := g.enqueue(g.mitra(), "steps", n(3))
		g.steps.next()
		j2 := g.enqueue(g.mitra(), "quick", nil)
		closed := make(chan error, 1)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			closed <- g.r.Close(ctx)
		}()
		eventually(t, "Close refuses new jobs", func() bool {
			_, err := g.r.Enqueue(g.mitra(), "quick", "", map[string]any{"late": true}, 0, nil)
			return errors.Is(err, jobs.ErrClosed)
		})
		g.steps.let()
		if err := <-closed; err != nil {
			t.Fatal(err)
		}
		if g.state(j1) != "interrupted" || g.state(j2) != "interrupted" {
			t.Fatalf("after shutdown: the running job %s, the waiting one %s", g.state(j1), g.state(j2))
		}
		if got := g.lines(j1); strings.Join(got, "|") != "item 0 done|the server stopped while this job was running" {
			t.Fatalf("the running job's log: %q", got)
		}
		if got := g.lines(j2); len(got) != 1 || got[0] != "the server stopped before this job started" {
			t.Fatalf("the waiting job's log: %q", got)
		}
		if err := g.r.Exclusive(func() error { return nil }); !errors.Is(err, jobs.ErrClosed) {
			t.Fatalf("Exclusive after Close: %v", err)
		}
	})

	t.Run("a job that ignores everything", func(t *testing.T) {
		g := newRig(t, jobs.Options{CancelWait: 100 * time.Millisecond})
		unstick := make(chan struct{})
		entered := make(chan struct{})
		g.r.Register(jobs.Kind{Name: "stuck", Run: func(context.Context, *jobs.Job) error {
			close(entered)
			<-unstick
			return errors.New("came back far too late")
		}})
		id := g.enqueue(g.mitra(), "stuck", nil)
		<-entered
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		start := time.Now()
		g.r.Close(ctx)
		if d := time.Since(start); d > 2*time.Second {
			t.Fatalf("Close waited %s for a job that would never return", d)
		}
		if g.state(id) != "interrupted" {
			t.Fatalf("the job Close gave up on reads %s", g.state(id))
		}
		close(unstick) // it comes back now, and must not write its end over that
		time.Sleep(300 * time.Millisecond)
		var errText string
		g.st.DB.QueryRow(`SELECT error FROM jobs WHERE id = ?`, id).Scan(&errText)
		if g.state(id) != "interrupted" || errText != "" {
			t.Fatalf("after it came back late: %s, error %q", g.state(id), errText)
		}
		// Nor add a line saying it failed to the log of a job that reads
		// interrupted. (The logbook is still open: the rig closes it last.)
		want := "the server stopped while this job was running, and could not wait for the item in hand"
		if got := g.lines(id); len(got) != 1 || got[0] != want {
			t.Fatalf("the log of the job shutdown gave up on: %q", got)
		}
	})

	t.Run("a job that listens to its context", func(t *testing.T) {
		g := newRig(t, jobs.Options{CancelWait: 5 * time.Second})
		entered := make(chan struct{})
		g.r.Register(jobs.Kind{Name: "waits", Run: func(ctx context.Context, _ *jobs.Job) error {
			close(entered)
			<-ctx.Done() // an outbound call, aborted by the runner's context
			return ctx.Err()
		}})
		id := g.enqueue(g.mitra(), "waits", nil)
		<-entered
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		g.r.Close(ctx)
		var errText string
		g.st.DB.QueryRow(`SELECT error FROM jobs WHERE id = ?`, id).Scan(&errText)
		if g.state(id) != "interrupted" || errText != "" {
			t.Fatalf("a job cancelled by shutdown: %s, error %q; want interrupted, not failed", g.state(id), errText)
		}
	})
}

// A SHUTDOWN WITH THE WRITE LOCK HELD ELSEWHERE DOES NOT WAIT IT OUT. The two
// writes Close makes once it stops waiting for the job — the one it gave up on,
// and the one still waiting — each wait half a second for the lock rather than
// busy_timeout's five, because shutdown has Docker's ten seconds for everything.
// What they could not write is left as it was, and the next start settles it.
func TestAShutdownWithTheLockHeldElsewhereDoesNotWaitItOut(t *testing.T) {
	g := newRig(t, jobs.Options{CancelWait: 100 * time.Millisecond})
	unstick, entered := make(chan struct{}), make(chan struct{})
	g.r.Register(jobs.Kind{Name: "stuck", Run: func(context.Context, *jobs.Job) error {
		close(entered)
		<-unstick
		return nil
	}})
	t.Cleanup(func() { close(unstick) })
	stuck := g.enqueue(g.mitra(), "stuck", nil)
	<-entered
	waiting := g.enqueue(g.mitra(), "quick", nil)

	letGo := holdWriteLock(t, g.st.DB)
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	err := g.r.Close(ctx)
	took := time.Since(start)
	letGo()
	if took > 3*time.Second {
		t.Fatalf("Close took %s with the lock held elsewhere: its writes waited out busy_timeout", took)
	}
	if err == nil {
		t.Fatal("Close could not write either end and reported nothing")
	}
	if g.state(stuck) != "running" || g.state(waiting) != "queued" {
		t.Fatalf("rows Close could not write: %s and %s, want them left running and queued", g.state(stuck), g.state(waiting))
	}
	if err := jobs.NewRunner(g.st, g.lb, jobs.Options{}).Boot(); err != nil {
		t.Fatal(err)
	}
	if g.state(stuck) != "interrupted" || g.state(waiting) != "interrupted" {
		t.Fatalf("the next start left them %s and %s, want both interrupted", g.state(stuck), g.state(waiting))
	}
}

// TIPPANI_JOBS_HOLD (HoldEnv) is used here, declared: it is the only way to have
// a job waiting with no job running, which is the state a restore finds when a
// reader queued something just before it.
func TestARestoreWaitsForTheRunningJobAndHoldsTheQueueWhileItRuns(t *testing.T) {
	g := newRig(t, jobs.Options{})
	x := g.enqueue(g.mitra(), "steps", n(1))
	g.steps.next()
	called := false
	if err := g.r.Exclusive(func() error { called = true; return nil }); !errors.Is(err, jobs.ErrBusy) || called {
		t.Fatalf("Exclusive while a job runs: %v, ran %v; want ErrBusy and not run", err, called)
	}
	// The hold goes on BEFORE x is let go. The worker that ran x looks at the
	// hold only at the top of its loop, so a hold set after x ended can come too
	// late for a look already under way, and that look takes q.
	t.Setenv(outbound.EnvVar, "1")
	t.Setenv(jobs.HoldEnv, "1")
	g.steps.let()
	g.waitState(x, "succeeded")

	q := g.enqueue(g.mitra(), "quick", map[string]any{"q": 1})
	time.Sleep(200 * time.Millisecond)
	if g.state(q) != "queued" {
		t.Fatalf("with the queue held the job reads %s", g.state(q))
	}
	t.Setenv(jobs.HoldEnv, "")

	stale := g.mitra()
	err := g.r.Exclusive(func() error {
		if _, err := g.r.Enqueue(g.mitra(), "quick", "", map[string]any{"during": 1}, 0, nil); !errors.Is(err, jobs.ErrBusy) {
			t.Errorf("Enqueue during a restore: %v, want ErrBusy", err)
		}
		// The restore's own swap of the database files.
		if err := g.st.Swap(func() error { return nil }, nil, nil); err != nil {
			return err
		}
		time.Sleep(100 * time.Millisecond)
		if s := g.state(q); s != "queued" {
			t.Errorf("a job ran during the restore: %s", s)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	g.waitState(q, "succeeded") // the queue starts again when the restore ends
	if _, err := g.r.Enqueue(stale, "quick", "", map[string]any{"after": 1}, 0, nil); !errors.Is(err, jobs.ErrStale) {
		t.Fatalf("Enqueue from a request that began before the swap: %v, want ErrStale", err)
	}
	if _, err := g.r.Enqueue(g.mitra(), "quick", "", map[string]any{"after": 1}, 0, nil); err != nil {
		t.Fatalf("Enqueue after the restore: %v", err)
	}
}

func TestOnlyTheOwnerCanRunAJobAgain(t *testing.T) {
	g := newRig(t, jobs.Options{})
	var secrets []any
	var mu sync.Mutex
	g.r.Register(jobs.Kind{Name: "again", Rerunnable: true, Run: func(_ context.Context, j *jobs.Job) error {
		mu.Lock()
		secrets = append(secrets, j.Secret())
		mu.Unlock()
		return nil
	}})
	g.r.Register(jobs.Kind{Name: "once", Run: func(context.Context, *jobs.Job) error { return nil }})
	g.r.Register(jobs.Kind{Name: "admin-only", AdminOnly: true, Rerunnable: true, Run: func(context.Context, *jobs.Job) error { return nil }})

	first, err := g.r.Enqueue(g.mitra(), "again", "Dune", map[string]any{"ids": []int{3, 1}}, 7, "pw1")
	if err != nil {
		t.Fatal(err)
	}
	g.waitState(first, "succeeded")

	if _, err := g.r.Rerun(first, g.aro(), nil); !errors.Is(err, jobs.ErrNotFound) {
		t.Fatalf("the admin rerunning mitra's job: %v, want ErrNotFound", err)
	}
	again, err := g.r.Rerun(first, g.mitra(), "pw2")
	if err != nil {
		t.Fatal(err)
	}
	g.waitState(again, "succeeded")
	var uid, rerunOf, total int64
	var kind, subject, params string
	if err := g.st.DB.QueryRow(`SELECT user_id, rerun_of, kind, subject, params, total FROM jobs WHERE id = ?`, again).
		Scan(&uid, &rerunOf, &kind, &subject, &params, &total); err != nil {
		t.Fatal(err)
	}
	if uid != 2 || rerunOf != first || kind != "again" || subject != "Dune" || params != `{"ids":[3,1]}` || total != 7 {
		t.Fatalf("the rerun: user %d rerun_of %d kind %q subject %q params %s total %d", uid, rerunOf, kind, subject, params, total)
	}
	mu.Lock()
	if fmt.Sprint(secrets) != "[pw1 pw2]" {
		t.Fatalf("the secrets each run saw: %v, want [pw1 pw2]", secrets)
	}
	mu.Unlock()

	once := g.enqueue(g.mitra(), "once", nil)
	g.waitState(once, "succeeded")
	if _, err := g.r.Rerun(once, g.mitra(), nil); !errors.Is(err, jobs.ErrNotRerunnable) {
		t.Fatalf("rerunning a kind that cannot be: %v", err)
	}

	adm := g.enqueue(g.aro(), "admin-only", nil)
	g.waitState(adm, "succeeded")
	demoted := g.aro()
	demoted.IsAdmin = false
	if _, err := g.r.Rerun(adm, demoted, nil); !errors.Is(err, jobs.ErrAdminOnly) {
		t.Fatalf("rerunning an admin job after losing admin: %v, want ErrAdminOnly", err)
	}

	res := exec(t, g.st.DB, `INSERT INTO jobs (user_id, username, kind, queued, state, created_at) VALUES (2, 'mitra', 'again', 0, 'succeeded', 1)`)
	inRequest, _ := res.LastInsertId()
	if _, err := g.r.Rerun(inRequest, g.mitra(), nil); !errors.Is(err, jobs.ErrNotRerunnable) {
		t.Fatalf("rerunning a job that ran in its request: %v", err)
	}

	held := g.enqueue(g.mitra(), "steps", n(1))
	g.steps.next()
	var dup *jobs.ErrDuplicate
	if _, err := g.r.Rerun(held, g.mitra(), nil); !errors.As(err, &dup) || dup.ID != held {
		t.Fatalf("rerunning a job still running: %v, want ErrDuplicate naming %d", err, held)
	}
	g.steps.let()

	old := g.mitra()
	if err := g.st.Swap(func() error { return nil }, nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := g.r.Rerun(first, old, nil); !errors.Is(err, jobs.ErrStale) {
		t.Fatalf("rerun from a request that began before a swap: %v", err)
	}
}

func TestAJobStartedTwiceOrASixthIsRefusedWithTheReason(t *testing.T) {
	g := newRig(t, jobs.Options{})
	g.r.Register(g.steps.kind("covers", true))

	first := g.enqueue(g.mitra(), "steps", map[string]any{"b": 1, "a": 2, "n": 1})
	g.steps.next() // running now, and holding the queue

	var dup *jobs.ErrDuplicate
	// The same params, written another way.
	if _, err := g.r.Enqueue(g.mitra(), "steps", "", json.RawMessage(`{ "n": 1, "a": 2, "b": 1 }`), 0, nil); !errors.As(err, &dup) || dup.ID != first {
		t.Fatalf("the same job again: %v, want ErrDuplicate naming %d", err, first)
	}
	// Somebody else's same job is theirs.
	g.enqueue(g.aro(), "steps", map[string]any{"b": 1, "a": 2, "n": 1})

	for i := range 4 {
		g.enqueue(g.mitra(), "steps", map[string]any{"n": 1, "i": i})
	}
	if _, err := g.r.Enqueue(g.mitra(), "steps", "", map[string]any{"n": 1, "i": 99}, 0, nil); !errors.Is(err, jobs.ErrLimit) {
		t.Fatalf("a sixth job: %v, want ErrLimit", err)
	}
	for _, c := range []struct {
		what  string
		owner jobs.Owner
		kind  string
		want  error
	}{
		{"a kind nobody registered", g.aro(), "juggle", jobs.ErrUnknownKind},
		{"a reader starting an admin's kind", g.mitra(), "covers", jobs.ErrAdminOnly},
		{"no account", jobs.Owner{Gen: g.st.Generation()}, "quick", jobs.ErrNoOwner},
		{"a request from before a swap", jobs.Owner{UserID: 1, Username: "aro", IsAdmin: true, Gen: g.st.Generation() + 1}, "quick", jobs.ErrStale},
	} {
		if _, err := g.r.Enqueue(c.owner, c.kind, "", nil, 0, nil); !errors.Is(err, c.want) {
			t.Errorf("%s: %v, want %v", c.what, err, c.want)
		}
	}

	// from_job is read from params into its column, and a negative total is none.
	id, err := g.r.Enqueue(g.aro(), "quick", "", map[string]any{"from_job": first, "items": []int{}}, -3, nil)
	if err != nil {
		t.Fatal(err)
	}
	var fromJob sql.NullInt64
	var total int
	g.st.DB.QueryRow(`SELECT from_job, total FROM jobs WHERE id = ?`, id).Scan(&fromJob, &total)
	if fromJob.Int64 != first || total != 0 {
		t.Fatalf("from_job %v total %d, want %d and 0", fromJob, total, first)
	}
	g.steps.releaseAll()
}

// THE LOST WAKEUP. The worker exits whenever it finds nothing waiting, and a job
// queued in that same instant must still be run: hundreds of exits one after
// another, then eight people pressing at once.
func TestNoJobIsLeftWaitingWithNothingToRunIt(t *testing.T) {
	g := newRig(t, jobs.Options{PerOwner: 100000})
	var ids []int64
	for i := range 200 {
		id := g.enqueue(g.mitra(), "quick", map[string]any{"i": i})
		g.waitState(id, "succeeded") // the worker is gone or going each time
		ids = append(ids, id)
	}
	var wg sync.WaitGroup
	for w := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range 40 {
				if _, err := g.r.Enqueue(g.mitra(), "quick", "", map[string]any{"w": w, "i": i}, 0, nil); err != nil {
					t.Error(err)
				}
				// Pauses about as long as a job takes, so the queue keeps
				// running dry and the worker keeps exiting between presses.
				time.Sleep(time.Duration((i*7+w)%5) * 300 * time.Microsecond)
			}
		}()
	}
	wg.Wait()
	eventually(t, "every job pressed at once has run", func() bool {
		return count(t, g.st.DB, `SELECT count(*) FROM jobs WHERE state != 'succeeded'`) == 0
	})
	if n := count(t, g.st.DB, `SELECT count(*) FROM jobs`); n != 200+8*40 {
		t.Fatalf("%d jobs, want %d", n, 200+8*40)
	}
}

// A Stop pressed the instant a job is queued races the worker claiming it. Either
// way it must hold: stopped before it starts, or stopped with at most the item it
// had already begun, and that one abandoned rather than finished. A Stop the claim
// swallowed would let it run on to the end.
func TestAStopNeverLosesARaceWithTheJobStarting(t *testing.T) {
	g := newRig(t, jobs.Options{PerOwner: 100000})
	outcomes := map[string]int{}
	for i := range 100 {
		id := g.enqueue(g.mitra(), "steps", map[string]any{"n": 2, "i": i})
		time.Sleep(time.Duration(i%40) * 250 * time.Microsecond)
		if err := g.r.Stop(id, g.mitra()); err != nil {
			t.Fatal(err)
		}
		items := 0
		for s := g.state(id); s == "queued" || s == "running"; s = g.state(id) {
			select {
			case it := <-g.steps.entered:
				if it.job != id {
					t.Fatalf("job %d started while %d was in hand", it.job, id)
				}
				items++ // and not let go: the Stop has cancelled it, so it ends on its own
			case <-time.After(5 * time.Millisecond):
			}
		}
		var done int
		g.st.DB.QueryRow(`SELECT done FROM jobs WHERE id = ?`, id).Scan(&done)
		if s := g.state(id); s != "stopped" || items > 1 || done != 0 {
			t.Fatalf("round %d: the job ended %s after %d item(s) begun and %d finished; want stopped with at most 1 begun and none finished",
				i, s, items, done)
		}
		var claimed int
		g.st.DB.QueryRow(`SELECT started_at IS NOT NULL FROM jobs WHERE id = ?`, id).Scan(&claimed)
		outcomes[fmt.Sprintf("claimed=%d items=%d", claimed, items)]++
	}
	t.Logf("outcomes over the rounds: %v", outcomes) // all three kinds, on this machine
}

func TestProgressIsWrittenEveryHalfSecondAndAlwaysAtTheEnd(t *testing.T) {
	g := newRig(t, jobs.Options{})
	at := make(chan struct{})
	on := make(chan struct{})
	g.r.Register(jobs.Kind{Name: "counter", Run: func(_ context.Context, j *jobs.Job) error {
		for i := 1; i < 1000; i++ {
			j.Progress(i, 1000)
		}
		at <- struct{}{}
		<-on
		j.Progress(1000, 1000)
		at <- struct{}{}
		<-on
		return nil
	}})
	id := g.enqueue(g.mitra(), "counter", nil)
	progress := func() string {
		var done, total int
		g.st.DB.QueryRow(`SELECT done, total FROM jobs WHERE id = ?`, id).Scan(&done, &total)
		return fmt.Sprintf("%d/%d", done, total)
	}
	<-at
	if p := progress(); p != "1/1000" {
		t.Fatalf("after 999 quick calls the row reads %s, want 1/1000 (only the first was due)", p)
	}
	on <- struct{}{}
	<-at
	if p := progress(); p != "1000/1000" {
		t.Fatalf("after the last item the row reads %s, want 1000/1000", p)
	}
	on <- struct{}{}
	g.waitState(id, "succeeded")
}

func TestAJobThatCrashesFailsAndTheNextOneStarts(t *testing.T) {
	g := newRig(t, jobs.Options{})
	g.r.Register(jobs.Kind{Name: "boom", Run: func(context.Context, *jobs.Job) error { panic("nil map") }})
	g.r.Register(jobs.Kind{Name: "refused", Run: func(context.Context, *jobs.Job) error {
		return errors.New(`Get "https://www.googleapis.com/books/v1/volumes?q=x&key=AIzaSECRET": 403`)
	}})
	boom := g.enqueue(g.mitra(), "boom", nil)
	refused := g.enqueue(g.mitra(), "refused", nil)
	after := g.enqueue(g.mitra(), "quick", nil)
	g.waitState(after, "succeeded")

	errOf := func(id int64) string {
		var s string
		g.st.DB.QueryRow(`SELECT error FROM jobs WHERE id = ?`, id).Scan(&s)
		return s
	}
	if g.state(boom) != "failed" || !strings.Contains(errOf(boom), "TIP-JOBS-001") {
		t.Fatalf("the job that panicked: %s, error %q", g.state(boom), errOf(boom))
	}
	if got := g.lines(boom); len(got) != 1 || !strings.HasPrefix(got[0], "failed: ") {
		t.Fatalf("its log: %q", got)
	}
	if g.state(refused) != "failed" || strings.Contains(errOf(refused), "AIzaSECRET") || !strings.Contains(errOf(refused), "key=…") {
		t.Fatalf("the job that failed with a key in its error: %s, error %q", g.state(refused), errOf(refused))
	}
}

// holdWriteLock takes SQLite's write lock from the library pool, as a long import
// holds it, until the returned func lets it go.
func holdWriteLock(t *testing.T, db *sql.DB) (letGo func()) {
	t.Helper()
	tx, err := db.Begin() // _txlock=immediate: the lock is taken here
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'the import')`, time.Now().UnixMilli()); err != nil {
		t.Fatal(err)
	}
	return func() {
		if err := tx.Commit(); err != nil {
			t.Error(err)
		}
	}
}

// A lock held for longer than one attempt waits (busy_timeout, five seconds):
// the job's start and its end each wait it out, and neither is lost to it.
func TestAWriteLockHeldPastItsWaitDelaysAJobButLosesNothing(t *testing.T) {
	t.Run("its end", func(t *testing.T) {
		t.Parallel()
		g := newRig(t, jobs.Options{})
		entered, finish := make(chan struct{}), make(chan struct{})
		returned := make(chan struct{})
		g.r.Register(jobs.Kind{Name: "gate", Run: func(context.Context, *jobs.Job) error {
			close(entered)
			<-finish
			defer close(returned)
			return nil
		}})
		a := g.enqueue(g.mitra(), "gate", nil)
		b := g.enqueue(g.mitra(), "quick", nil)
		<-entered
		letGo := holdWriteLock(t, g.st.DB)
		close(finish)
		<-returned
		time.Sleep(6 * time.Second) // the finishing write's first attempt gives up at five
		letGo()
		g.waitState(a, "succeeded") // not left reading running
		g.waitState(b, "succeeded") // and the one behind it still starts
	})
	t.Run("its start", func(t *testing.T) {
		t.Parallel()
		g := newRig(t, jobs.Options{})
		// A job waiting with no worker alive, as a claim that failed would leave it.
		id, _ := exec(t, g.st.DB, `INSERT INTO jobs (user_id, username, kind, state, created_at) VALUES (2, 'mitra', 'quick', 'queued', ?)`,
			time.Now().UnixMilli()).LastInsertId()
		letGo := holdWriteLock(t, g.st.DB)
		// A restore ending starts the queue; the worker's first claim meets the lock.
		if err := g.r.Exclusive(func() error { return nil }); err != nil {
			t.Fatal(err)
		}
		time.Sleep(6 * time.Second) // the claim's first attempt gives up at five
		letGo()
		g.waitState(id, "succeeded")
	})
}

// A job left waiting with no worker (a claim that failed on a locked database)
// is started by the reader pressing it again, though that press is refused as
// the same job.
func TestPressingAJobThatIsAlreadyWaitingStartsTheQueue(t *testing.T) {
	g := newRig(t, jobs.Options{})
	id, _ := exec(t, g.st.DB, `INSERT INTO jobs (user_id, username, kind, state, created_at) VALUES (2, 'mitra', 'quick', 'queued', ?)`,
		time.Now().UnixMilli()).LastInsertId()
	var dup *jobs.ErrDuplicate
	if _, err := g.r.Enqueue(g.mitra(), "quick", "", nil, 0, nil); !errors.As(err, &dup) || dup.ID != id {
		t.Fatalf("pressing the waiting job again: %v, want ErrDuplicate naming %d", err, id)
	}
	g.waitState(id, "succeeded")
}

// A job whose finishing write fails for good (a full disk; here a trigger that
// refuses it) still reads running, and nothing will write its end. The server's
// line says the end was not recorded rather than naming a state the row does not
// hold; the row stands in the way of the same job and counts toward the owner's
// five until Stop, or Stop all, settles it as interrupted.
func TestAJobWhoseEndCouldNotBeRecordedReadsRunningUntilStopSettlesIt(t *testing.T) {
	g := newRig(t, jobs.Options{})
	out := olog.CaptureForTest(t)
	exec(t, g.st.DB, `CREATE TRIGGER disk_full BEFORE UPDATE OF state ON jobs WHEN NEW.state = 'succeeded'
		BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END`)

	a := g.enqueue(g.mitra(), "quick", nil)
	eventually(t, "the finish is attempted", func() bool {
		return strings.Contains(out.String(), fmt.Sprintf("#%d quick for mitra could not record its end (it succeeded in", a))
	})
	if strings.Contains(out.String(), "quick for mitra succeeded") {
		t.Fatalf("the server's log names a state the record does not hold:\n%s", out.String())
	}
	if g.state(a) != "running" {
		t.Fatalf("a job whose end could not be written reads %s", g.state(a))
	}
	var dup *jobs.ErrDuplicate
	if _, err := g.r.Enqueue(g.mitra(), "quick", "", nil, 0, nil); !errors.As(err, &dup) || dup.ID != a {
		t.Fatalf("the same job again while the first reads running: %v, want ErrDuplicate naming %d", err, a)
	}

	if err := g.r.Stop(a, g.mitra()); err != nil {
		t.Fatal(err)
	}
	if g.state(a) != "interrupted" || count(t, g.st.DB, `SELECT count(*) FROM jobs WHERE id = ? AND finished_at IS NOT NULL`, a) != 1 {
		t.Fatalf("after Stop the job reads %s, want interrupted with a finish time", g.state(a))
	}
	if got := g.lines(a); len(got) != 1 || got[0] != "its end was never recorded; mitra stopped it, and it is marked interrupted" {
		t.Fatalf("its log: %q", got)
	}

	// Stop all settles one too, and counts it as ended rather than as stopping.
	b := g.enqueue(g.aro(), "quick", map[string]any{"b": 1})
	eventually(t, "the second finish is attempted", func() bool {
		return strings.Contains(out.String(), fmt.Sprintf("#%d quick for aro could not record its end", b))
	})
	stopping, ended, err := g.r.StopAll(g.aro())
	if err != nil || stopping != 0 || ended != 1 || g.state(b) != "interrupted" {
		t.Fatalf("Stop all over a row left running: %d stopping, %d ended, %v, and it reads %s", stopping, ended, err, g.state(b))
	}

	exec(t, g.st.DB, `DROP TRIGGER disk_full`)
	again := g.enqueue(g.mitra(), "quick", nil) // no longer refused as the same job
	g.waitState(again, "succeeded")
}

func TestAJobWhoseAccountWentIsNotRunForAnybody(t *testing.T) {
	g := newRig(t, jobs.Options{})
	var ran atomic.Int32
	g.r.Register(jobs.Kind{Name: "count", Run: func(context.Context, *jobs.Job) error { ran.Add(1); return nil }})
	g.r.Register(g.steps.kind("admin-steps", true))

	g.enqueue(g.aro(), "steps", n(1))
	g.steps.next() // holds the queue
	gone := g.enqueue(g.mitra(), "count", nil)
	exec(t, g.st.DB, `DELETE FROM users WHERE id = 2`) // as `tippani user del` does it
	exec(t, g.st.DB, `INSERT INTO users (id, username, password_hash) VALUES (2, 'someone-else', 'x')`)
	// A request that resolved mitra before her account went presses after it,
	// her id now somebody else's: refused, rather than queued under that id.
	if _, err := g.r.Enqueue(g.mitra(), "count", "", map[string]any{"late": true}, 0, nil); !errors.Is(err, jobs.ErrNoOwner) {
		t.Fatalf("a press from an account deleted mid-request: %v, want ErrNoOwner", err)
	}
	demoted := g.enqueue(g.aro(), "admin-steps", n(1))
	exec(t, g.st.DB, `UPDATE users SET is_admin = 0 WHERE id = 1`)
	g.steps.let()

	g.waitState(gone, "failed")
	g.waitState(demoted, "failed")
	if ran.Load() != 0 || count(t, g.st.DB, `SELECT count(*) FROM jobs WHERE user_id = 2`) != 0 {
		t.Fatal("a job whose account was deleted ran, or is kept, under an id somebody else now holds")
	}
	for id, want := range map[int64]string{gone: "the account that started this job is gone", demoted: "the account that started this job is no longer an admin"} {
		var e string
		g.st.DB.QueryRow(`SELECT error FROM jobs WHERE id = ?`, id).Scan(&e)
		if e != want {
			t.Errorf("job %d failed with %q, want %q", id, e, want)
		}
	}
}

// TIPPANI_JOBS_HOLD (HoldEnv), declared: the seam itself. It holds the queue
// only while the app is offline; online it is ignored.
func TestTheHoldSeamHoldsOnlyAnOfflineServer(t *testing.T) {
	g := newRig(t, jobs.Options{})
	t.Setenv(jobs.HoldEnv, "1")
	t.Setenv(outbound.EnvVar, "")
	online := g.enqueue(g.mitra(), "quick", map[string]any{"online": true})
	g.waitState(online, "succeeded")

	// The worker that ran it goes on to look for the next job, and one between
	// its hold check and its claim would claim the job below past a switch
	// flipped in that moment. It failed that way under the race detector, 1 run
	// in 20 on a loaded machine. In real use the seam is set before the server
	// starts, so only a test can open that gap. Exclusive waits out a claim in
	// progress and lets none begin, so flipped inside it the switch is on before
	// any worker looks again. It is refused as busy while the worker is still
	// finishing the online job's end.
	for {
		err := g.r.Exclusive(func() error { t.Setenv(outbound.EnvVar, "1"); return nil })
		if err == nil {
			break
		}
		if !errors.Is(err, jobs.ErrBusy) {
			t.Fatal(err)
		}
		time.Sleep(5 * time.Millisecond)
	}
	offline := g.enqueue(g.mitra(), "quick", map[string]any{"offline": true})
	time.Sleep(300 * time.Millisecond)
	if g.state(offline) != "queued" {
		t.Fatalf("offline with the hold on, the job reads %s", g.state(offline))
	}
	stopping, waiting, err := g.r.StopAll(g.mitra())
	if err != nil || stopping != 0 || waiting != 1 || g.state(offline) != "stopped" {
		t.Fatalf("Stop all on a held job: %d, %d, %v, %s", stopping, waiting, err, g.state(offline))
	}
}

// TIPPANI_JOBS_HOLD=running (HoldEnv, HoldRunning), declared: the seam's other
// position, which a journey uses to see a job running. Offline, the job the
// worker claims is held running before its first step until a Stop ends it,
// stopped, and the one behind it waits and is then held in its turn; online the
// same switch holds nothing.
func TestTheRunningHoldSeamHoldsTheClaimedJobAtItsStartOnlyOffline(t *testing.T) {
	g := newRig(t, jobs.Options{})
	var ran atomic.Int32
	g.r.Register(jobs.Kind{Name: "counted", Rerunnable: true, Run: func(context.Context, *jobs.Job) error {
		ran.Add(1)
		return nil
	}})
	t.Setenv(jobs.HoldEnv, jobs.HoldRunning)
	t.Setenv(outbound.EnvVar, "1")
	first := g.enqueue(g.mitra(), "counted", map[string]any{"n": 1})
	second := g.enqueue(g.mitra(), "counted", map[string]any{"n": 2})
	g.waitState(first, "running")
	time.Sleep(300 * time.Millisecond)
	if s1, s2, n := g.state(first), g.state(second), ran.Load(); s1 != "running" || s2 != "queued" || n != 0 {
		t.Fatalf("held: the first reads %s, the second %s, and %d steps ran; want running, queued, 0", s1, s2, n)
	}

	if err := g.r.Stop(first, g.mitra()); err != nil {
		t.Fatal(err)
	}
	g.waitState(first, "stopped")
	g.waitState(second, "running")
	if n := ran.Load(); n != 0 {
		t.Fatalf("the second job, held in its turn, ran %d steps", n)
	}
	stopping, waiting, err := g.r.StopAll(g.mitra())
	if err != nil || stopping != 1 || waiting != 0 {
		t.Fatalf("Stop all on the held running job: %d stopping, %d waiting, %v", stopping, waiting, err)
	}
	g.waitState(second, "stopped")

	// Online, the switch in the same position holds nothing: the job runs.
	t.Setenv(outbound.EnvVar, "")
	online := g.enqueue(g.mitra(), "counted", map[string]any{"n": 3})
	g.waitState(online, "succeeded")
	if n := ran.Load(); n != 1 {
		t.Fatalf("online, %d steps ran; want the one job's", n)
	}
}

func TestAJobSeesWhatItWasGivenAndReportsBack(t *testing.T) {
	g := newRig(t, jobs.Options{})
	type seen struct {
		params   map[string]any
		secret   any
		owner    jobs.Owner
		recorder bool
		tooLarge error
	}
	got := make(chan seen, 1)
	g.r.Register(jobs.Kind{Name: "echo", Run: func(ctx context.Context, j *jobs.Job) error {
		var s seen
		j.Params(&s.params)
		s.secret, s.owner = j.Secret(), j.Owner()
		s.recorder = jobs.From(ctx) == jobs.Recorder(j)
		s.tooLarge = j.SetResult(strings.Repeat("x", 9<<20))
		jobs.From(ctx).Subject("renamed\nsubject")
		jobs.From(ctx).Log(jobs.LevelWarn, "GET https://api.themoviedb.org/3/x?api_key=%s → 401", "K")
		got <- s
		return j.SetResult(map[string]int{"fetched": 3})
	}})
	id, err := g.r.Enqueue(g.mitra(), "echo", "original", map[string]any{"ids": []int{1}}, 1, "hunter2")
	if err != nil {
		t.Fatal(err)
	}
	s := <-got
	g.waitState(id, "succeeded")
	if fmt.Sprint(s.params["ids"]) != "[1]" || s.secret != "hunter2" || s.owner.UserID != 2 || s.owner.Username != "mitra" || !s.recorder {
		t.Fatalf("the job saw %+v", s)
	}
	if !errors.Is(s.tooLarge, jobs.ErrTooLarge) {
		t.Fatalf("a 9 MB result: %v, want ErrTooLarge", s.tooLarge)
	}
	var subject, result, params string
	g.st.DB.QueryRow(`SELECT subject, result, params FROM jobs WHERE id = ?`, id).Scan(&subject, &result, &params)
	if subject != "renamed⏎subject" || result != `{"fetched":3}` || strings.Contains(params, "hunter2") {
		t.Fatalf("row: subject %q result %q params %q", subject, result, params)
	}
	if lines := g.lines(id); len(lines) != 1 || lines[0] != "GET https://api.themoviedb.org/3/x?api_key=… → 401" {
		t.Fatalf("its log: %q", lines)
	}
}

// When a job ends the server says so in `docker logs`, and it says what the job
// was in the words the job's Markdown export uses: a fill of three works is
// "Fill gaps in 3 works", not "fill". A kind nobody named is called by its kind.
func TestTheServersLineNamesAFinishedJobInEnglish(t *testing.T) {
	g := newRig(t, jobs.Options{})
	out := olog.CaptureForTest(t)
	g.r.Register(jobs.Kind{Name: "fill", Run: func(_ context.Context, j *jobs.Job) error {
		j.Progress(3, 3)
		return nil
	}})
	fill, err := g.r.Enqueue(g.mitra(), "fill", "", map[string]any{"book_ids": []int{1, 2, 3}}, 3, nil)
	if err != nil {
		t.Fatal(err)
	}
	g.waitState(fill, "succeeded")
	quick := g.enqueue(g.mitra(), "quick", nil)
	g.waitState(quick, "succeeded")
	eventually(t, "both jobs' lines are printed", func() bool {
		return strings.Contains(out.String(), fmt.Sprintf("[jobs] #%d quick for mitra succeeded in", quick))
	})
	if want := fmt.Sprintf("[jobs] #%d Fill gaps in 3 works for mitra succeeded in", fill); !strings.Contains(out.String(), want) {
		t.Fatalf("the server's line for the fill: want %q in\n%s", want, out.String())
	}
}
