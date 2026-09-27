package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// A LOCK SOMEBODY ELSE HOLDS IS TOLD APART FROM A WRITE THAT CANNOT WORK.
//
// WHAT IT KNOWS, declared: IsBusy is a classifier and the function is the
// observable unit; nothing over HTTP reports which error a log batch met. The
// busy error is produced for real, by a second SQLite client on the same file (as
// a `sqlite3` shell or a second process would be) asking for the write lock the
// store's pool holds, with no busy wait of its own, so the answer comes at once;
// and its extended form, SQLITE_BUSY_SNAPSHOT, by a second client whose read
// snapshot the store's pool commits past before the client writes. The test reads
// that error's code from the driver to know it met the extended one, since a
// plain BUSY passing would prove nothing about the extended codes.
// The tests of shutdown's bounded waits (WithLockWait, CloseLog, CheckpointWithin)
// turn that round: the second client holds the lock, and the store's own calls
// are what must not wait it out. Nothing over HTTP runs during a shutdown, and
// the timing is the thing under test; LogWrite, the one way anything writes
// through the log pool, stands in for the logbook's drainer.

func TestIsBusyKnowsALockHeldElsewhere(t *testing.T) {
	s := openHead(t)
	tx, err := s.DB.Begin() // _txlock=immediate: the write lock is taken here
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	other, err := sql.Open("sqlite", "file:"+s.Path()+"?_txlock=immediate&_pragma=busy_timeout(0)")
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	_, busy := other.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'x')`)
	if busy == nil {
		t.Fatal("a second writer got the lock the store's transaction holds")
	}
	if !IsBusy(busy) {
		t.Fatalf("IsBusy(%v) = false for a lock held by another connection", busy)
	}
	if !IsBusy(fmt.Errorf("write a log batch: %w", busy)) {
		t.Fatal("IsBusy lost the busy error once it was wrapped")
	}

	// An extended busy code is busy too. A read transaction on a DEFERRED
	// connection holds a snapshot; once another connection commits past it, its
	// first write is SQLITE_BUSY_SNAPSHOT, which no busy wait fixes by itself and a
	// retry in a fresh transaction does.
	reader, err := sql.Open("sqlite", "file:"+s.Path()+"?_txlock=deferred&_pragma=busy_timeout(0)")
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	tx.Rollback() // the store's lock above is let go, so the next commit can land
	rtx, err := reader.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer rtx.Rollback()
	var n int
	if err := rtx.QueryRow(`SELECT count(*) FROM system_logs`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'committed past the snapshot')`); err != nil {
		t.Fatal(err)
	}
	_, stale := rtx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'from the stale snapshot')`)
	var se *sqlite.Error
	if !errors.As(stale, &se) || se.Code() != sqlite3.SQLITE_BUSY_SNAPSHOT {
		t.Fatalf("a write from a snapshot another connection committed past: %v, want SQLITE_BUSY_SNAPSHOT", stale)
	}
	if !IsBusy(stale) {
		t.Fatalf("IsBusy(%v) = false for SQLITE_BUSY_SNAPSHOT", stale)
	}

	// A write that fails for a reason no wait will fix is not busy.
	_, bad := s.DB.Exec(`INSERT INTO no_such_table VALUES (1)`)
	if bad == nil {
		t.Fatal("an insert into a missing table succeeded")
	}
	for _, e := range []error{nil, bad, sql.ErrNoRows, errors.New("database is locked")} {
		if IsBusy(e) {
			t.Errorf("IsBusy(%v) = true", e)
		}
	}
}

// holdLockElsewhere takes SQLite's write lock from a second client on the same
// file, as a `sqlite3` shell left in a transaction does, until letGo.
func holdLockElsewhere(t *testing.T, s *Store) (letGo func()) {
	t.Helper()
	other, err := sql.Open("sqlite", "file:"+s.Path()+"?_txlock=immediate")
	if err != nil {
		t.Fatal(err)
	}
	tx, err := other.Begin()
	if err != nil {
		other.Close()
		t.Fatal(err)
	}
	var once sync.Once
	letGo = func() {
		once.Do(func() {
			tx.Rollback()
			other.Close()
		})
	}
	t.Cleanup(letGo)
	return letGo
}

// A WRITE GIVEN ITS OWN WAIT GIVES UP ON TIME, AND LEAVES THE POOL AS IT WAS.
// Shutdown's writes use it: busy_timeout's five seconds, three times over, put
// the checkpoint past Docker's grace. And the connection it borrowed goes back to
// the pool waiting the full five again, or some later save would give up early on
// an ordinary busy moment.
func TestAWriteGivenItsOwnWaitGivesUpOnTimeAndLeavesThePoolAsItWas(t *testing.T) {
	s := openHead(t)
	letGo := holdLockElsewhere(t, s)

	start := time.Now()
	err := s.WithLockWait(300*time.Millisecond, func(c *sql.Conn) error {
		_, err := c.ExecContext(context.Background(), `INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'x')`)
		return err
	})
	if took := time.Since(start); !IsBusy(err) || took > 2*time.Second {
		t.Fatalf("with the lock held elsewhere, a write given 300ms returned %v after %s", err, took)
	}

	// Every connection the pool has, the borrowed one among them, waits out a
	// lock held for a second: four writes at once take all four.
	go func() {
		time.Sleep(time.Second)
		letGo()
	}()
	var wg sync.WaitGroup
	errs := make(chan error, 4)
	for i := range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.DB.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'after')`, i)
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("an ordinary write gave up on a lock held for a second: %v (a connection kept the short wait)", err)
		}
	}
}

// SHUTDOWN DOES NOT WAIT OUT A LOG WRITE THAT IS WAITING ON THE LOCK. The log pool
// is left to close by itself the moment that write lets go.
func TestClosingTheLogPoolWaitsOnlyAsLongAsItWasTold(t *testing.T) {
	s := openHead(t)
	letGo := holdLockElsewhere(t, s)
	wrote := make(chan error, 1)
	go func() {
		wrote <- s.LogWrite(func(db *sql.DB) error {
			_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'in flight')`)
			return err
		})
	}()
	time.Sleep(100 * time.Millisecond) // the write is waiting on the lock

	start := time.Now()
	if err := s.CloseLog(200 * time.Millisecond); !errors.Is(err, ErrLogStillWriting) || time.Since(start) > 2*time.Second {
		t.Fatalf("closing the log pool under a waiting write returned %v after %s", err, time.Since(start))
	}
	letGo()
	if err := <-wrote; err != nil {
		t.Fatalf("the write in flight failed once the lock was let go: %v", err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for s.LogDB.Ping() == nil {
		if time.Now().After(deadline) {
			t.Fatal("the log pool never closed after the write in flight let go")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// SHUTDOWN'S CHECKPOINT SAYS WHEN IT COULD NOT FINISH, AND STILL DOES WHAT IT CAN.
// With a writer holding the lock past its wait it folds back every frame committed
// before that writer began, and says the database was busy; Checkpoint's plain
// Exec used to report that as a clean shutdown.
func TestTheShutdownCheckpointSaysWhenItCouldNotFinish(t *testing.T) {
	s := openHead(t)
	if _, err := s.DB.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'a committed line')`); err != nil {
		t.Fatal(err)
	}
	letGo := holdLockElsewhere(t, s)
	start := time.Now()
	err := s.CheckpointWithin(300 * time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "were folded back and it was not truncated") || time.Since(start) > 2*time.Second {
		t.Fatalf("a checkpoint under a held lock returned %v after %s", err, time.Since(start))
	}
	letGo()
	if err := s.CheckpointWithin(300 * time.Millisecond); err != nil {
		t.Fatalf("with nothing in its way, the checkpoint: %v", err)
	}
}
