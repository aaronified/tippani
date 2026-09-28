package jobs

import (
	"context"
	"database/sql"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"tippani/internal/store"
)

// THE LOGBOOK'S SEAMS, AND THE ONE REAL WAIT.
//
// WHAT IT KNOWS, declared: this file is inside the package, and it knows the
// Logbook's tuning — the system log's ceiling and the prune's chunk size, the
// number of busy attempts, and beforeWrite, the hook that runs before a batch is
// written. Each is changed on the test's own logbook and nowhere else. Why
// nothing observable could serve:
//
//   - the ceiling is a million rows, and a million inserts under -race (which
//     instruments the whole pure-Go SQLite engine) is minutes per run for the
//     same rule the test proves at 50;
//   - no input makes the drainer panic, and what the logbook does after one —
//     keep going, and say what it lost — is the thing under test;
//   - a batch dropped after its last busy attempt would otherwise need six waits
//     of busy_timeout (five seconds each) with a lock held throughout;
//   - a job's finishing write and the log's batch take the same SQLite write
//     lock, so holding the lock holds both, and the order they land in once it
//     is let go is a race between them. Parking the drainer itself (beforeWrite)
//     is the only way to hold a job's lines back while leaving its finishing
//     write free to land first, which is exactly the defect Flush-before-finish
//     exists to prevent. The black-box version of that test failed about one run
//     in fifteen with the Flush removed, because the drainer usually won anyway;
//   - a buffer that is never empty when the drainer looks — the flood the prune
//     must not starve behind — is a matter of timing from outside, and
//     beforeWrite adding one line before every batch makes it exact;
//   - what an evicted line still holds in memory is in no table, so that test
//     reads the buffer itself.
//
// The busy retry that succeeds uses no seam: it holds SQLite's write lock for
// real, from the library pool, for longer than one attempt waits.

func openStoreInternal(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	return st
}

func flushT(t *testing.T, lb *Logbook, d time.Duration) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), d)
	defer cancel()
	if err := lb.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
}

func linesT(t *testing.T, db *sql.DB, q string) []string {
	t.Helper()
	rows, err := db.Query(q)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		out = append(out, s)
	}
	return out
}

// FLUSH BEFORE FINISH. With the drainer parked on beforeWrite, a job that has
// logged and returned does not read finished while its lines are still waiting,
// and reads finished with every one of them once they are written. And the wait
// is bounded: a drainer that does not come back holds the job for FlushWait and
// no longer, so a stuck log never stalls the queue.
func TestAFinishedJobsLastLinesAreThereWhenItSaysItFinished(t *testing.T) {
	const lines = 20
	// rig is a store, a logbook whose drainer parks before its first batch until
	// release is called, and a runner with flushWait and one kind that logs its
	// lines, says it has returned, and returns.
	rig := func(t *testing.T, flushWait time.Duration) (st *store.Store, r *Runner, parked, returned chan struct{}, release func()) {
		st = openStoreInternal(t)
		if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
			t.Fatal(err)
		}
		lb := NewLogbook()
		hold := make(chan struct{})
		parked, returned = make(chan struct{}), make(chan struct{})
		var parkOnce, releaseOnce sync.Once
		release = func() { releaseOnce.Do(func() { close(hold) }) }
		lb.tune.beforeWrite = func() {
			parkOnce.Do(func() { close(parked) })
			<-hold
		}
		lb.Attach(st)
		t.Cleanup(func() { lb.Close(context.Background()) })
		r = NewRunner(st, lb, Options{FlushWait: flushWait})
		t.Cleanup(func() { r.Close(context.Background()) })
		// Cleanups run last first: the drainer is let go before either close,
		// each of which could otherwise wait on it for ever after a failure.
		t.Cleanup(release)
		r.Register(Kind{Name: "chatty", Run: func(_ context.Context, j *Job) error {
			for i := range lines {
				j.Log(LevelInfo, "line %d", i)
			}
			close(returned)
			return nil
		}})
		return st, r, parked, returned, release
	}
	owner := func(st *store.Store) Owner { return Owner{UserID: 2, Username: "mitra", Gen: st.Generation()} }
	read := func(st *store.Store, id int64) (state string, n int) {
		st.DB.QueryRow(`SELECT state, (SELECT count(*) FROM job_logs WHERE job_id = jobs.id) FROM jobs WHERE id = ?`, id).
			Scan(&state, &n)
		return state, n
	}

	t.Run("waits for its lines", func(t *testing.T) {
		st, r, parked, returned, release := rig(t, 30*time.Second)
		id, err := r.Enqueue(owner(st), "chatty", "", nil, 0, nil)
		if err != nil {
			t.Fatal(err)
		}
		<-returned
		<-parked
		for end := time.Now().Add(time.Second); time.Now().Before(end); time.Sleep(20 * time.Millisecond) {
			if state, n := read(st, id); state != StateRunning {
				t.Fatalf("with its lines still waiting to be written, the job reads %s with %d of %d lines", state, n, lines)
			}
		}
		release()
		deadline := time.Now().Add(20 * time.Second)
		for {
			state, n := read(st, id) // one read: the state and the count are of one moment
			if state == StateSucceeded {
				if n != lines {
					t.Fatalf("the job reads finished with %d of its %d lines", n, lines)
				}
				return
			}
			if time.Now().After(deadline) {
				t.Fatalf("the job still reads %s after its lines were let through", state)
			}
			time.Sleep(10 * time.Millisecond)
		}
	})

	t.Run("but not for ever", func(t *testing.T) {
		st, r, parked, returned, release := rig(t, 300*time.Millisecond)
		id, err := r.Enqueue(owner(st), "chatty", "", nil, 0, nil)
		if err != nil {
			t.Fatal(err)
		}
		<-returned
		<-parked
		deadline := time.Now().Add(10 * time.Second)
		for state, _ := read(st, id); state != StateSucceeded; state, _ = read(st, id) {
			if time.Now().After(deadline) {
				t.Fatalf("with the log stuck, the job still reads %s long after its flush wait ran out", state)
			}
			time.Sleep(10 * time.Millisecond)
		}
		release()
		deadline = time.Now().Add(20 * time.Second)
		for _, n := read(st, id); n != lines; _, n = read(st, id) {
			if time.Now().After(deadline) {
				t.Fatalf("%d of %d lines arrived after the log came back", n, lines)
			}
			time.Sleep(10 * time.Millisecond)
		}
	})
}

// A STOPPED JOB'S END IS NOT HELD FOR ITS LOG. With the drainer parked, a job
// somebody stops reads stopped within a moment of the press, although the runner
// would wait thirty seconds for the lines of a job that finished by itself: the
// person who pressed Stop is watching that row. Its lines, the press's included,
// are all there once the log is let go.
func TestAStoppedJobsEndIsNotHeldForItsLog(t *testing.T) {
	st := openStoreInternal(t)
	if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
		t.Fatal(err)
	}
	lb := NewLogbook()
	hold := make(chan struct{})
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(hold) }) }
	lb.tune.beforeWrite = func() { <-hold }
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	r := NewRunner(st, lb, Options{FlushWait: 30 * time.Second})
	t.Cleanup(func() {
		// Bounded, so a run a broken Stop never reached is cut off by shutdown's
		// cancel rather than waited for.
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		r.Close(ctx)
	})
	t.Cleanup(release)
	waiting := make(chan struct{})
	r.Register(Kind{Name: "outward", Run: func(ctx context.Context, j *Job) error {
		j.Log(LevelInfo, "asking the supplier")
		close(waiting)
		<-ctx.Done() // a call on the wire, aborted by the Stop
		j.Stopping()
		return nil
	}})
	owner := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}
	id, err := r.Enqueue(owner, "outward", "", nil, 1, nil)
	if err != nil {
		t.Fatal(err)
	}
	<-waiting
	pressed := time.Now()
	if err := r.Stop(id, owner); err != nil {
		t.Fatal(err)
	}
	var state string
	for st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&state); state != StateStopped; st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&state) {
		if time.Since(pressed) > 5*time.Second {
			t.Fatalf("with the log held, the stopped job still reads %s five seconds after the press", state)
		}
		time.Sleep(2 * time.Millisecond)
	}
	if took, bound := time.Since(pressed), 300*time.Millisecond*UnderRace; took > bound {
		t.Fatalf("the stopped job read stopped %s after the press, want within %s", took, bound)
	}
	release()
	flushT(t, lb, 20*time.Second)
	want := "asking the supplier|mitra pressed Stop|stopped"
	if got := strings.Join(linesT(t, st.DB, `SELECT line FROM job_logs ORDER BY id`), "|"); got != want {
		t.Fatalf("its log once the log was let go: %q, want %q", got, want)
	}
}

// AN EVICTED LINE LETS GO OF WHAT IT HELD. With nothing draining (as while the
// drainer waits out a held lock), a buffer full of request lines takes errors,
// each pushing request lines out. What the buffer still holds stays inside the
// 8 MB, and the husks of what it pushed out do not pile up beside it.
func TestAnEvictedLineLetsGoOfWhatItHeld(t *testing.T) {
	lb := NewLogbook() // never attached: nothing drains
	for range 5000 {
		lb.System(LevelRequest, "", strings.Repeat("r", 2000))
	}
	for range 1100 {
		lb.System(LevelError, "", strings.Repeat("e", 8000))
	}
	lb.mu.Lock()
	held, entries, live := 0, 0, 0
	for _, e := range lb.buf[lb.head:] {
		held += len(e.text)
		entries++
		if !e.gone {
			live++
		}
	}
	lb.mu.Unlock()
	if held > maxBufferBytes {
		t.Errorf("the buffer holds %d bytes of text, over its %d", held, maxBufferBytes)
	}
	if entries > 2*live {
		t.Errorf("the buffer keeps %d entries for %d lines still waiting", entries, live)
	}
}

// THE PRUNE UNDER A FLOOD. Every batch the drainer writes brings another line
// with it (beforeWrite), so the buffer is never empty when the drainer looks, as
// under a crawler; the month-old lines still go, a chunk at a time between
// batches.
func TestThePruneStillRunsWhileLinesNeverStopArriving(t *testing.T) {
	st := openStoreInternal(t)
	old := time.Now().Add(-31 * 24 * time.Hour).UnixMilli()
	for i := range 450 {
		if _, err := st.DB.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'request', 'old')`, old+int64(i)); err != nil {
			t.Fatal(err)
		}
	}
	lb := NewLogbook()
	lb.tune.pruneChunk = 100 // five chunks for the 450
	var flooding atomic.Bool
	flooding.Store(true)
	lb.tune.beforeWrite = func() {
		if flooding.Load() {
			lb.System(LevelRequest, "", "GET /api/books 200")
		}
	}
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	// Cleanups run last first: the flood stops before the close, whose flush
	// then has an end.
	t.Cleanup(func() { flooding.Store(false) })
	lb.System(LevelRequest, "", "the first request") // the flood keeps itself going from here

	deadline := time.Now().Add(20 * time.Second)
	for {
		var left, flood int
		st.DB.QueryRow(`SELECT count(*) FILTER (WHERE line = 'old'), count(*) FILTER (WHERE line LIKE 'GET %') FROM system_logs`).
			Scan(&left, &flood)
		if left == 0 {
			if flood == 0 {
				t.Fatal("the old lines went, but no flood ran while they did")
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("%d month-old lines still kept after %d lines of flood", left, flood)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestTheSystemLogPastItsCeilingLosesItsOldest(t *testing.T) {
	st := openStoreInternal(t)
	for i := range 120 {
		if _, err := st.DB.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'request', ?)`,
			time.Now().UnixMilli(), i); err != nil {
			t.Fatal(err)
		}
	}
	lb := NewLogbook()
	lb.tune.systemCeiling = 50
	lb.tune.pruneChunk = 7 // 70 to go: ten chunks and a short one
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	lb.PruneSoon()

	deadline := time.Now().Add(20 * time.Second)
	for {
		var n int
		st.DB.QueryRow(`SELECT count(*) FROM system_logs`).Scan(&n)
		if n == 50 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("%d lines after the prune, want the newest 50", n)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if got := linesT(t, st.DB, `SELECT min(line) || '-' || max(line) FROM (SELECT CAST(line AS INTEGER) AS line FROM system_logs)`); got[0] != "70-119" {
		t.Fatalf("kept %s, want the newest: 70-119", got[0])
	}
}

func TestADrainerPanicLosesOnlyTheBatchInHandAndSaysSo(t *testing.T) {
	st := openStoreInternal(t)
	lb := NewLogbook()
	var calls atomic.Int32
	lb.tune.beforeWrite = func() {
		if calls.Add(1) == 1 {
			panic("a bug in the writer")
		}
	}
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })

	lb.System(LevelInfo, "", "in the batch that panics")
	flushT(t, lb, 10*time.Second) // settles: the line is counted as not kept
	lb.System(LevelInfo, "", "after the restart")
	flushT(t, lb, 10*time.Second)

	got := linesT(t, st.DB, `SELECT code || ' ' || line FROM system_logs ORDER BY id`)
	want := []string{
		"TIP-LOG-002 1 log line was not kept (writing them failed; the server's error output says why)",
		" after the restart",
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("after a panic:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
}

func TestABatchWaitsOutAHeldLockAndIsDroppedOnlyAfterItsLastTry(t *testing.T) {
	t.Run("kept", func(t *testing.T) {
		t.Parallel()
		st := openStoreInternal(t)
		lb := NewLogbook()
		lb.Attach(st)
		t.Cleanup(func() { lb.Close(context.Background()) })

		// A writer on the library pool holds the lock past one attempt's
		// busy_timeout (5 s), as a long import would.
		tx, err := st.DB.Begin()
		if err != nil {
			t.Fatal(err)
		}
		// Timed now: the first batch's prune would take a line from 1970 as old.
		if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'the import')`, time.Now().UnixMilli()); err != nil {
			t.Fatal(err)
		}
		lb.System(LevelInfo, "", "waited its turn")
		time.Sleep(6 * time.Second)
		if err := tx.Commit(); err != nil {
			t.Fatal(err)
		}
		flushT(t, lb, 20*time.Second)
		if got := linesT(t, st.DB, `SELECT line FROM system_logs ORDER BY id`); strings.Join(got, "|") != "the import|waited its turn" {
			t.Fatalf("after the lock was let go: %q", got)
		}
	})
	t.Run("dropped", func(t *testing.T) {
		t.Parallel()
		st := openStoreInternal(t)
		lb := NewLogbook()
		lb.tune.busyAttempts = 1
		lb.Attach(st)
		t.Cleanup(func() { lb.Close(context.Background()) })

		tx, err := st.DB.Begin()
		if err != nil {
			t.Fatal(err)
		}
		// Timed now: the first batch's prune would take a line from 1970 as old.
		if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'the import')`, time.Now().UnixMilli()); err != nil {
			t.Fatal(err)
		}
		lb.System(LevelInfo, "", "gave up on")
		flushT(t, lb, 20*time.Second) // one attempt, five seconds, then counted
		if err := tx.Commit(); err != nil {
			t.Fatal(err)
		}
		lb.System(LevelInfo, "", "the next line")
		flushT(t, lb, 20*time.Second)
		got := linesT(t, st.DB, `SELECT line FROM system_logs ORDER BY id`)
		want := "the import|1 log line was not kept (writing them failed; the server's error output says why)|the next line"
		if strings.Join(got, "|") != want {
			t.Fatalf("after giving up:\n%q\nwant\n%q", strings.Join(got, "|"), want)
		}
	})
}

// THE RUNNER'S ONE SEAM: afterClaim, which holds the worker between claiming a
// job and taking its lock again, so a Stop lands in exactly the window where the
// row already reads running and the worker has not yet said which job it holds.
// runner_test.go's race test reaches the paths either side of it by timing; this
// window is microseconds wide and timing does not reach it on purpose. A Stop in
// that window waits for the claim to end before it answers, so the test also
// reads claimStop, the runner's note of it, to know the Stop has asked before the
// claim is let go: nothing outside can say that a call still waiting has.
func TestAStopInTheInstantAfterTheClaimIsNotLost(t *testing.T) {
	st := openStoreInternal(t)
	if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
		t.Fatal(err)
	}
	lb := NewLogbook()
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	r := NewRunner(st, lb, Options{})
	t.Cleanup(func() { r.Close(context.Background()) })
	var items atomic.Int32
	r.Register(Kind{Name: "two", Run: func(_ context.Context, j *Job) error {
		for range 2 {
			if j.Stopping() {
				return nil
			}
			items.Add(1)
		}
		return nil
	}})
	claimed := make(chan struct{})
	stopped := make(chan struct{})
	var once sync.Once
	r.afterClaim = func(bool) { // the worker looks again after the job; hold only the first claim
		once.Do(func() {
			close(claimed)
			<-stopped
		})
	}
	owner := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}
	id, err := r.Enqueue(owner, "two", "", nil, 2, nil)
	if err != nil {
		t.Fatal(err)
	}
	<-claimed
	stopErr := make(chan error, 1)
	go func() { stopErr <- r.Stop(id, owner) }()
	for asked := false; !asked; {
		r.mu.Lock()
		_, asked = r.claimStop[id]
		r.mu.Unlock()
		time.Sleep(time.Millisecond)
	}
	close(stopped)
	if err := <-stopErr; err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(20 * time.Second)
	var state string
	for {
		st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&state)
		if state != StateQueued && state != StateRunning {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the job never finished")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if state != StateStopped || items.Load() != 0 {
		t.Fatalf("stopped the instant after its claim, the job ended %s after %d item(s); want stopped after none", state, items.Load())
	}
}

// The other side of that window, through the same seam: a Stop on a row a failed
// finishing write left running, pressed while the worker is claiming another job,
// waits for the claim and then settles the row — rather than taking it for the
// job being claimed and leaving it running for good.
func TestAStopOnARowLeftRunningDuringAClaimStillSettlesIt(t *testing.T) {
	st := openStoreInternal(t)
	if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
		t.Fatal(err)
	}
	res, err := st.DB.Exec(`INSERT INTO jobs (user_id, username, kind, state, created_at, started_at) VALUES (2, 'mitra', 'quick', 'running', ?1, ?1)`,
		time.Now().UnixMilli())
	if err != nil {
		t.Fatal(err)
	}
	orphan, _ := res.LastInsertId()
	lb := NewLogbook()
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	r := NewRunner(st, lb, Options{})
	t.Cleanup(func() { r.Close(context.Background()) })
	r.Register(Kind{Name: "quick", Run: func(context.Context, *Job) error { return nil }})
	claimed, letGo := make(chan struct{}), make(chan struct{})
	var once sync.Once
	r.afterClaim = func(bool) {
		once.Do(func() {
			close(claimed)
			<-letGo
		})
	}
	owner := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}
	next, err := r.Enqueue(owner, "quick", "", map[string]int{"n": 1}, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	<-claimed
	stopErr := make(chan error, 1)
	go func() { stopErr <- r.Stop(orphan, owner) }()
	for asked := false; !asked; {
		r.mu.Lock()
		_, asked = r.claimStop[orphan]
		r.mu.Unlock()
		time.Sleep(time.Millisecond)
	}
	close(letGo)
	if err := <-stopErr; err != nil {
		t.Fatal(err)
	}
	stateOf := func(id int64) string {
		var s string
		st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&s)
		return s
	}
	if s := stateOf(orphan); s != StateInterrupted {
		t.Fatalf("Stop returned and the row left running reads %s, want interrupted", s)
	}
	deadline := time.Now().Add(20 * time.Second)
	for stateOf(next) != StateSucceeded {
		if time.Now().After(deadline) {
			t.Fatalf("the job being claimed meanwhile reads %s, want succeeded", stateOf(next))
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// A SECRET IS FORGOTTEN ON EVERY WAY A JOB ENDS. White-box, declared: it reads
// the runner's secrets map, because a secret let go is by design unobservable —
// nothing outside the job that holds it can read one, and after the job ends
// nothing can at all. Uses TIPPANI_JOBS_HOLD (HoldEnv), declared, for the one
// path that needs a job waiting with nothing running: a restore ending it; and,
// before that path, waits on the runner's idle channel, since the moment the
// worker lets go of its last job shows in no row.
func TestASecretIsForgottenOnEveryWayAJobEnds(t *testing.T) {
	st := openStoreInternal(t)
	if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'aro', 'x', 1), (2, 'mitra', 'x', 0)`); err != nil {
		t.Fatal(err)
	}
	lb := NewLogbook()
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	r := NewRunner(st, lb, Options{PerOwner: 100, CancelWait: 50 * time.Millisecond})
	held := func() int {
		r.smu.Lock()
		defer r.smu.Unlock()
		return len(r.secrets)
	}
	// As the queue has it: a waiting job a Stop has stopped reads stopped before
	// its row is written (held.go).
	stateOf := func(id int64) string {
		var s string
		st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&s)
		if _, held := r.Held()[id]; held && s == StateQueued {
			return StateStopped
		}
		return s
	}
	waitFor := func(id int64, want string) {
		t.Helper()
		deadline := time.Now().Add(20 * time.Second)
		for stateOf(id) != want {
			if time.Now().After(deadline) {
				t.Fatalf("job %d is %s, want %s", id, stateOf(id), want)
			}
			time.Sleep(5 * time.Millisecond)
		}
	}
	entered, unblock := make(chan string, 10), make(chan struct{})
	var sawSecret atomic.Value
	r.Register(Kind{Name: "block", Run: func(_ context.Context, j *Job) error {
		sawSecret.Store(j.Secret())
		entered <- "in"
		<-unblock
		return nil
	}})
	r.Register(Kind{Name: "quick", Run: func(context.Context, *Job) error { return nil }})
	aro := Owner{UserID: 1, Username: "aro", IsAdmin: true, Gen: st.Generation()}
	mitra := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}
	enq := func(o Owner, kind string, tag int) int64 {
		t.Helper()
		id, err := r.Enqueue(o, kind, "", map[string]int{"tag": tag}, 0, "pw")
		if err != nil {
			t.Fatal(err)
		}
		return id
	}

	// Succeeded.
	waitFor(enq(mitra, "quick", 1), StateSucceeded)
	if n := held(); n != 0 {
		t.Fatalf("after a job succeeded: %d secret(s) held", n)
	}

	// Stopped while waiting, by Stop, Stop all and StopOwner; failed because its
	// account went. One job holds the queue meanwhile, and holds its own secret.
	b := enq(aro, "block", 2)
	<-entered
	if sawSecret.Load() != "pw" {
		t.Fatal("the running job could not read its secret")
	}
	w1, w2, w3 := enq(mitra, "quick", 3), enq(mitra, "quick", 4), enq(mitra, "quick", 5)
	if err := r.Stop(w1, mitra); err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.StopAll(Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}); err != nil {
		t.Fatal(err)
	}
	gone := enq(aro, "quick", 6)
	release, err := r.StopOwner(2)
	if err != nil {
		t.Fatal(err)
	}
	release()
	if stateOf(w1) != StateStopped || stateOf(w2) != StateStopped || stateOf(w3) != StateStopped {
		t.Fatal("the waiting jobs were not all stopped")
	}
	if n := held(); n != 2 { // the running one, and aro's waiting one
		t.Fatalf("after three stopped while waiting: %d secret(s) held, want 2", n)
	}
	if _, err := st.DB.Exec(`UPDATE users SET id = 3 WHERE id = 1`); err != nil { // aro's id no longer names aro
		t.Fatal(err)
	}
	unblock <- struct{}{}
	waitFor(b, StateSucceeded)
	waitFor(gone, StateFailed)
	if n := held(); n != 0 {
		t.Fatalf("after a job whose account went failed: %d secret(s) held", n)
	}
	if _, err := st.DB.Exec(`UPDATE users SET id = 1 WHERE id = 3`); err != nil {
		t.Fatal(err)
	}

	// Ended by a restore while the queue was held. The restore comes once the
	// worker that ended the jobs above has let go (a restore pressed while it
	// still holds its last job is refused as busy, rightly, and that is not this
	// case), and the hold stays on through it: cleared any sooner, a worker still
	// on its way out could claim the waiting job first, and the restore would
	// then be refused for the job it was meant to interrupt.
	r.mu.Lock()
	idle := r.idle
	r.mu.Unlock()
	select {
	case <-idle:
	case <-time.After(20 * time.Second):
		t.Fatal("the worker never let go after the jobs above ended")
	}
	t.Setenv("TIPPANI_OFFLINE", "1")
	t.Setenv(HoldEnv, "1")
	restored := enq(mitra, "quick", 7)
	if err := r.Exclusive(func() error {
		_, err := st.DB.Exec(`UPDATE jobs SET state = 'interrupted', finished_at = 1 WHERE id = ?`, restored)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	t.Setenv(HoldEnv, "")
	if n := held(); n != 0 {
		t.Fatalf("after a restore interrupted a waiting job: %d secret(s) held", n)
	}

	// Interrupted by shutdown: the one it gave up waiting for, and one waiting.
	abandoned := enq(aro, "block", 8)
	<-entered
	waiting := enq(mitra, "quick", 9)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	r.Close(ctx)
	if stateOf(abandoned) != StateInterrupted || stateOf(waiting) != StateInterrupted {
		t.Fatalf("after Close: %s and %s", stateOf(abandoned), stateOf(waiting))
	}
	if n := held(); n != 0 {
		t.Fatalf("after shutdown: %d secret(s) held", n)
	}
	close(unblock)
}

// THE WORKER'S LOST WAKEUP, AT ITS EXACT INSTANT. afterClaim (declared above)
// lands an Enqueue after the worker's claim has found nothing and before it takes
// its lock to decide to exit: the new job's kick sees a worker still alive and
// starts none, so that worker must look again rather than leave the job waiting.
// runner_test.go's many-cycles test drives the same guard by volume.
func TestAJobQueuedTheInstantTheWorkerFoundNoneStillRuns(t *testing.T) {
	st := openStoreInternal(t)
	if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
		t.Fatal(err)
	}
	lb := NewLogbook()
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	r := NewRunner(st, lb, Options{})
	t.Cleanup(func() { r.Close(context.Background()) })
	r.Register(Kind{Name: "quick", Run: func(context.Context, *Job) error { return nil }})
	owner := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}

	var once sync.Once
	var late atomic.Int64
	r.afterClaim = func(found bool) {
		if found {
			return
		}
		once.Do(func() {
			id, err := r.Enqueue(owner, "quick", "", map[string]string{"when": "the instant it found none"}, 0, nil)
			if err != nil {
				t.Error(err)
			}
			late.Store(id)
		})
	}
	first, err := r.Enqueue(owner, "quick", "", nil, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		var n int
		st.DB.QueryRow(`SELECT count(*) FROM jobs WHERE id IN (?, ?) AND state = 'succeeded'`, first, late.Load()).Scan(&n)
		if n == 2 {
			return
		}
		if time.Now().After(deadline) {
			var s string
			st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, late.Load()).Scan(&s)
			t.Fatalf("the job queued the instant the worker found none is still %q", s)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// A RESTORE PRESSED WHILE THE WORKER IS LOOKING, through the same seam. The
// worker looks for a job every time it is kicked and nearly always finds none,
// and an Exclusive that lands in that look waits for it to end rather than
// answering "a job is running" with nothing running: the admin's second
// maintenance step, pressed just after the first, used to be refused that way.
// A look that does take a job still refuses it.
func TestAnExclusiveDuringALookWaitsForWhatTheLookFinds(t *testing.T) {
	for _, tc := range []struct {
		name  string
		found bool // the claim to hold: the one that finds a job, or the one that finds none
		want  error
	}{{"finds none", false, nil}, {"finds a job", true, ErrBusy}} {
		t.Run(tc.name, func(t *testing.T) {
			st := openStoreInternal(t)
			if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
				t.Fatal(err)
			}
			lb := NewLogbook()
			lb.Attach(st)
			t.Cleanup(func() { lb.Close(context.Background()) })
			r := NewRunner(st, lb, Options{})
			t.Cleanup(func() { r.Close(context.Background()) })
			running, finish := make(chan struct{}), make(chan struct{})
			looking, letGo := make(chan struct{}), make(chan struct{})
			var endFinish, endLetGo sync.Once
			let := func() { endLetGo.Do(func() { close(letGo) }) }
			end := func() { endFinish.Do(func() { close(finish) }) }
			t.Cleanup(end) // before the runner's Close, which waits for the held job
			t.Cleanup(let)
			r.Register(Kind{Name: "held", Run: func(context.Context, *Job) error {
				close(running)
				<-finish
				return nil
			}})
			r.Register(Kind{Name: "quick", Run: func(context.Context, *Job) error { return nil }})
			var once sync.Once
			r.afterClaim = func(found bool) {
				if found == tc.found {
					once.Do(func() {
						close(looking)
						<-letGo
					})
				}
			}
			owner := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}
			kind := "quick" // it ends at once, and the worker looks again, finding none
			if tc.found {
				kind = "held"
			}
			if _, err := r.Enqueue(owner, kind, "", nil, 0, nil); err != nil {
				t.Fatal(err)
			}
			<-looking
			ran := false
			done := make(chan error, 1)
			go func() { done <- r.Exclusive(func() error { ran = true; return nil }) }()
			select {
			case err := <-done:
				t.Fatalf("Exclusive answered %v while the worker was still looking", err)
			case <-time.After(50 * time.Millisecond):
			}
			let()
			if tc.found {
				<-running
			}
			err := <-done
			end()
			if err != tc.want || ran != (tc.want == nil) {
				t.Fatalf("Exclusive after a look that %s: %v, ran %v; want %v", tc.name, err, ran, tc.want)
			}
		})
	}
}

// A STOP THAT HOLDS A JOB WHILE A CLAIM WAITS FOR THE LOCK, THEN WRITES ITS ROW
// AFTER THE CLAIM HAS TAKEN IT, STILL STOPS IT. A claim reads the held set, then
// waits for SQLite's write lock; a Stop pressed in that wait marks the job and
// finds its row still waiting, answers "stopped", and tries for the lock itself
// (held.go). When the lock frees, the claim can have it first and take the job,
// and the Stop's write then finds no waiting row. The worker stops the job before
// its first step only if the mark is still there when it looks (unhold), so the
// write must not let go of a mark whose job the claim now has.
//
// WHAT IT KNOWS, declared: afterClaim (above), the held map and settleHeld. The
// interleaving is a claim's lock wait crossed with a Stop's, which timing reaches
// about as often as the busy handler's sleeps allow; here the mark is put in and
// the Stop's own write run at the one instant it has to land in, after the
// claim's commit and before the worker looks.
func TestAStopWhoseWriteLandsAfterTheClaimTookTheJobStillStopsIt(t *testing.T) {
	st := openStoreInternal(t)
	if _, err := st.DB.Exec(`INSERT INTO users (id, username, password_hash) VALUES (2, 'mitra', 'x')`); err != nil {
		t.Fatal(err)
	}
	lb := NewLogbook()
	lb.Attach(st)
	t.Cleanup(func() { lb.Close(context.Background()) })
	r := NewRunner(st, lb, Options{})
	t.Cleanup(func() { r.Close(context.Background()) })
	var items atomic.Int32
	r.Register(Kind{Name: "two", Run: func(_ context.Context, j *Job) error {
		for range 2 {
			if j.Stopping() {
				return nil
			}
			items.Add(1)
		}
		return nil
	}})
	var once sync.Once
	r.afterClaim = func(found bool) {
		if !found {
			return
		}
		once.Do(func() {
			var id int64
			if err := st.DB.QueryRow(`SELECT id FROM jobs WHERE state = 'running'`).Scan(&id); err != nil {
				t.Error(err)
				return
			}
			// The Stop's hold, made while the claim waited: its mark in, its read of
			// the row from before the claim's commit.
			r.hmu.Lock()
			r.held[id] = heldStop{gen: st.Generation(), at: time.Now().UnixMilli()}
			r.hmu.Unlock()
			// And that Stop's own write of the row, which had the lock next.
			if err := r.settleHeld(st.DB); err != nil {
				t.Error(err)
			}
		})
	}
	owner := Owner{UserID: 2, Username: "mitra", Gen: st.Generation()}
	id, err := r.Enqueue(owner, "two", "", nil, 2, nil)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(20 * time.Second)
	var state string
	for {
		st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&state)
		if state != StateQueued && state != StateRunning {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the job never finished")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if state != StateStopped || items.Load() != 0 {
		t.Fatalf("stopped while its claim waited for the lock, the job ended %s after %d item(s); want stopped after none", state, items.Load())
	}
}
