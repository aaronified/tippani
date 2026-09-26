package jobs

import (
	"context"
	"database/sql"
	"path/filepath"
	"strings"
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
		if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'the import')`); err != nil {
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
		if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'the import')`); err != nil {
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
