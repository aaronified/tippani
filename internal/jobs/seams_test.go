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
//     of busy_timeout (five seconds each) with a lock held throughout.
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
// window is microseconds wide and timing does not reach it on purpose.
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
	if err := r.Stop(id, owner); err != nil {
		t.Fatal(err)
	}
	close(stopped)

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

// A SECRET IS FORGOTTEN ON EVERY WAY A JOB ENDS. White-box, declared: it reads
// the runner's secrets map, because a secret let go is by design unobservable —
// nothing outside the job that holds it can read one, and after the job ends
// nothing can at all. Uses TIPPANI_JOBS_HOLD (HoldEnv), declared, for the one
// path that needs a job waiting with nothing running: a restore ending it.
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
	stateOf := func(id int64) string {
		var s string
		st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&s)
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
	if err := r.StopOwner(2); err != nil {
		t.Fatal(err)
	}
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

	// Ended by a restore while the queue was held.
	t.Setenv("TIPPANI_OFFLINE", "1")
	t.Setenv(HoldEnv, "1")
	restored := enq(mitra, "quick", 7)
	t.Setenv(HoldEnv, "")
	if err := r.Exclusive(func() error {
		_, err := st.DB.Exec(`UPDATE jobs SET state = 'interrupted', finished_at = 1 WHERE id = ?`, restored)
		return err
	}); err != nil {
		t.Fatal(err)
	}
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
