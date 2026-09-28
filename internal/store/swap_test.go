package store

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

// THE LOG POOL, AND THE ONE SWAP EVERY FILE CHANGE GOES THROUGH.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the store's
// own API — Swap, Recover, Reset, BeforeSwap, LogWrite, Generation and the LogDB
// field — and the
// system_logs table. That API is the package's whole contract with its two callers,
// the restore (httpapi, whose round trip is tested there) and the logbook that
// writes through LogWrite, which does not exist yet; nothing observable over HTTP
// can say which connection a line went through, whether it synced, or whether a
// swap waited for it. And one variable, promote, the rename that puts a recovered
// file over the old one, which failPromote replaces: a rename that fails while the
// file system goes on working cannot be made on a real one (a read-only directory
// also refuses the reopen that follows), and what the store does after one is the
// thing under test.
//
// What each one guards, in a sentence a person would say: logging costs no disk
// sync while a saved quote still does; a log line written after a restore, a
// recovery or a factory reset lands in the database the server is now on; a
// restore whose search index is too broken to rebuild recovers instead of hanging
// the server; a restore that fails puts the old library back and reopens it; a
// swap whose file cannot first be written what it has to hold is not made; and
// no failed swap or recovery leaves the server on closed pools while saying it
// worked, or leaves an empty database where the library was.

func TestTheLogPoolSkipsTheSyncALibraryWriteStillPays(t *testing.T) {
	s := openHead(t)
	check := func(when string) {
		t.Helper()
		// PRAGMA synchronous: 1 is NORMAL, 2 is FULL.
		if got := countT(t, s.LogDB, `PRAGMA synchronous`); got != 1 {
			t.Fatalf("%s: the log pool syncs at %d, want 1 (NORMAL)", when, got)
		}
		if got := countT(t, s.DB, `PRAGMA synchronous`); got != 2 {
			t.Fatalf("%s: the library pool syncs at %d, want 2 (FULL)", when, got)
		}
		if n := s.LogDB.Stats().MaxOpenConnections; n != 1 {
			t.Fatalf("%s: the log pool may open %d connections, want 1", when, n)
		}
	}
	check("at open")
	// A swap reopens both pools; they must come back configured the same way.
	if err := s.Reset(); err != nil {
		t.Fatal(err)
	}
	check("after a factory reset")
}

func TestALogLineWrittenAfterASwapLandsInTheDatabaseTheServerIsOn(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	logLine := func(line string) {
		t.Helper()
		if err := s.LogWrite(func(db *sql.DB) error {
			_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', ?)`, line)
			return err
		}); err != nil {
			t.Fatalf("log %q: %v", line, err)
		}
	}
	seen := func(line string) bool {
		t.Helper()
		return countT(t, s.DB, `SELECT count(*) FROM system_logs WHERE line = ?`, line) == 1
	}
	gen := s.Generation()
	advanced := func(what string) {
		t.Helper()
		if g := s.Generation(); g <= gen {
			t.Fatalf("%s did not count a generation (still %d)", what, g)
		} else {
			gen = g
		}
	}

	logLine("before anything")

	// A restore: another library's file put where this one was.
	restored := migratedFileWith(t, filepath.Join(t.TempDir(), "restored.db"), "The Restored Book")
	if err := s.Swap(func() error {
		if err := moveDB(s.Path(), filepath.Join(dir, "old.db")); err != nil {
			return err
		}
		return moveDB(restored, s.Path())
	}, nil, nil); err != nil {
		t.Fatalf("swap: %v", err)
	}
	advanced("a restore")
	if countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'The Restored Book'`) != 1 {
		t.Fatal("after the swap the library pool is not on the restored file")
	}
	logLine("after the restore")
	if !seen("after the restore") {
		t.Fatal("a line logged after the restore is not in the restored database")
	}

	// A whole-file recovery rebuilds into a new file; the log goes with it.
	if err := s.Recover(); err != nil {
		t.Fatalf("recover: %v", err)
	}
	advanced("a recovery")
	if !seen("after the restore") {
		t.Fatal("the recovery dropped the system log")
	}
	logLine("after the recovery")
	if !seen("after the recovery") {
		t.Fatal("a line logged after the recovery is not in the recovered database")
	}

	// A factory reset wipes everything, the log included, and starts again.
	if err := s.Reset(); err != nil {
		t.Fatalf("reset: %v", err)
	}
	advanced("a factory reset")
	if seen("after the recovery") {
		t.Fatal("a factory reset kept the system log")
	}
	logLine("after the reset")
	if !seen("after the reset") {
		t.Fatal("a line logged after the reset is not in the fresh database")
	}
}

func TestASwapWaitsForTheLogWriteInHandAndHoldsTheNextOne(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	restored := migratedFileWith(t, filepath.Join(t.TempDir(), "restored.db"), "The Restored Book")

	inWrite, writeGate := make(chan struct{}), make(chan struct{})
	moving, moveGate := make(chan struct{}), make(chan struct{})
	var openWrite, openMove sync.Once
	releaseWrite := func() { openWrite.Do(func() { close(writeGate) }) }
	releaseMove := func() { openMove.Do(func() { close(moveGate) }) }
	// A failure below must not leave either goroutine parked holding the lock the
	// store's own cleanup (Close) needs; this runs before it.
	t.Cleanup(func() { releaseWrite(); releaseMove() })

	go s.LogWrite(func(*sql.DB) error { close(inWrite); <-writeGate; return nil })
	<-inWrite

	swapped := make(chan error, 1)
	go func() {
		swapped <- s.Swap(func() error {
			close(moving)
			<-moveGate
			if err := moveDB(s.Path(), filepath.Join(dir, "old.db")); err != nil {
				return err
			}
			return moveDB(restored, s.Path())
		}, nil, nil)
	}()
	select {
	case <-moving:
		t.Fatal("the swap moved files while a log write was still in hand")
	case <-time.After(200 * time.Millisecond):
	}
	releaseWrite()
	select {
	case <-moving:
	case <-time.After(10 * time.Second):
		t.Fatal("the swap never started after the log write finished")
	}

	// A line arriving mid-swap waits, and then lands in the new file.
	wrote := make(chan error, 1)
	go func() {
		wrote <- s.LogWrite(func(db *sql.DB) error {
			_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'mid-swap')`)
			return err
		})
	}()
	select {
	case err := <-wrote:
		t.Fatalf("a log write ran while the files were moving (err=%v)", err)
	case <-time.After(200 * time.Millisecond):
	}
	releaseMove()
	if err := <-swapped; err != nil {
		t.Fatalf("swap: %v", err)
	}
	if err := <-wrote; err != nil {
		t.Fatalf("the held log write failed once the swap was done: %v", err)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM system_logs WHERE line = 'mid-swap'`); n != 1 {
		t.Fatal("the line held through the swap is not in the restored database")
	}
}

// A restore whose search index is too broken to rebuild in place: the boot-style
// bring-up escalates to a whole-file recovery, which is itself a swap, from inside
// the restore's swap. It must finish rather than wait on the lock its caller holds.
func TestARestoreWhoseIndexCannotBeRebuiltRecoversInsteadOfHanging(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	// Closed only once the swap has returned: a deadlocked swap holds the lock
	// Close takes, and closing then would hang the whole run instead of failing
	// this test.
	finished := false
	t.Cleanup(func() {
		if finished {
			s.Close()
		}
	})
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	// The archive's database: intact content, and an index the self-heal can only
	// recover (the shape httpapi's TestReindexEscalationRepointsSessions uses too).
	restored := brokenIndexArchive(t, "Leviathan Rising")

	done := make(chan error, 1)
	go func() {
		done <- s.Swap(func() error {
			if err := moveDB(s.Path(), filepath.Join(dir, "old.db")); err != nil {
				return err
			}
			return moveDB(restored, s.Path())
		}, nil, nil)
	}()
	select {
	case err := <-done:
		finished = true
		if err != nil {
			t.Fatalf("swap: %v", err)
		}
	case <-time.After(30 * time.Second):
		t.Fatal("a restore that needed a whole-file recovery never finished: the recovery is waiting on the restore's own lock")
	}

	if n := countT(t, s.DB, `SELECT count(*) FROM books_fts WHERE books_fts MATCH 'Leviathan'`); n != 1 {
		t.Fatalf("search after the recovery found %d, want the restored book", n)
	}
	if err := s.LogWrite(func(db *sql.DB) error {
		_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'after')`)
		return err
	}); err != nil {
		t.Fatalf("a log write after the recovered restore: %v", err)
	}
}

// A restore whose new database cannot be brought up puts the old files back: the
// rollback is handed the reason, the old library is live again, the log pool
// works, and the step that runs only on a successful swap never ran.
func TestARestoreThatFailsPutsTheOldLibraryBack(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (user_id, title) VALUES (1, 'The Kept Book')`)

	// A database from a newer Tippani: Migrate refuses it, so the bring-up fails
	// after the move succeeded — the case where only a rollback helps.
	future := migratedFileWith(t, filepath.Join(t.TempDir(), "future.db"), "From The Future")
	fdb, err := sql.Open("sqlite", "file:"+future)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fdb.Exec(`INSERT INTO schema_version (version) VALUES (99999)`); err != nil {
		t.Fatal(err)
	}
	fdb.Close()

	aside := filepath.Join(dir, "pre")
	if err := os.Mkdir(aside, 0o700); err != nil {
		t.Fatal(err)
	}
	var cause error
	afterRan := false
	err = s.Swap(
		func() error {
			if err := moveDB(s.Path(), filepath.Join(aside, "tippani.db")); err != nil {
				return err
			}
			return moveDB(future, s.Path())
		},
		func(why error) error {
			cause = why
			if err := moveDB(s.Path(), filepath.Join(dir, "failed.db")); err != nil {
				return err
			}
			return moveDB(filepath.Join(aside, "tippani.db"), s.Path())
		},
		func(*sql.DB) error { afterRan = true; return nil },
	)
	if err == nil {
		t.Fatal("a swap onto a database from a newer Tippani reported success")
	}
	var rb *RollbackError
	if errors.As(err, &rb) {
		t.Fatalf("the rollback succeeded but the swap reported it failing: %v", err)
	}
	if cause == nil || !strings.Contains(cause.Error(), "newer Tippani") {
		t.Fatalf("the rollback was not handed why the swap failed: %v", cause)
	}
	if afterRan {
		t.Fatal("the success-only step ran on the rolled-back files")
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'The Kept Book'`); n != 1 {
		t.Fatal("the old library is not live after the rollback")
	}
	if err := s.LogWrite(func(db *sql.DB) error {
		_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'after the rollback')`)
		return err
	}); err != nil {
		t.Fatalf("a log write after the rollback: %v", err)
	}

	// And a rollback that cannot put the files back says so as its own kind of
	// failure: the restore exits for a clean boot on it.
	future2 := migratedFileWith(t, filepath.Join(t.TempDir(), "future2.db"), "Also From The Future")
	fdb, _ = sql.Open("sqlite", "file:"+future2)
	if _, err := fdb.Exec(`INSERT INTO schema_version (version) VALUES (99999)`); err != nil {
		t.Fatal(err)
	}
	fdb.Close()
	err = s.Swap(
		func() error {
			if err := moveDB(s.Path(), filepath.Join(aside, "tippani.db")); err != nil {
				return err
			}
			return moveDB(future2, s.Path())
		},
		func(error) error { return errors.New("the disk went away") },
		nil,
	)
	if !errors.As(err, &rb) || !strings.Contains(rb.Rollback.Error(), "the disk went away") {
		t.Fatalf("a failed rollback reported %v, want a RollbackError carrying why", err)
	}
}

// A SWAP THAT CANNOT FIRST WRITE WHAT ITS FILE HAS TO HOLD IS NOT MADE. BeforeSwap's
// fn is the queue's (internal/jobs): the waiting jobs a Stop has stopped, written
// into the file before it is replaced. When it fails, a restore, a recovery and a
// factory reset each answer ErrNotSwapped with nothing moved or rolled back, no
// generation counted and the library open where it was — the queue's Stops are
// kept by generation, so a count here would let them go unwritten. What it
// writes is in the file a recovery goes on with, since it runs before the copy.
// And a restore that fails after its move rolls back without asking it: the file
// the rollback moves aside is the one the restore brought in, and a rollback
// refused would leave the server on it.
//
// Mutations, each red here: Swap going on to its rollback when BeforeSwap's fn
// refuses (the rollback runs and a generation is counted); recoverLocked asking
// it at its swap rather than before its copy (the recovered file lacks what it
// wrote); the rollback asking it (the restore reports a failed rollback).
func TestASwapWhoseFileCannotFirstBeWrittenIsNotMade(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (user_id, title) VALUES (1, 'The Kept Book')`)

	refused := errors.New("the lock was held elsewhere")
	s.BeforeSwap(func(*sql.DB) error { return refused })
	gen := s.Generation()
	moved, rolledBack, afterRan := false, false, false
	err = s.Swap(
		func() error { moved = true; return nil },
		func(error) error { rolledBack = true; return nil },
		func(*sql.DB) error { afterRan = true; return nil },
	)
	if !errors.Is(err, ErrNotSwapped) || !errors.Is(err, refused) {
		t.Fatalf("a restore whose file could not first be written answered %v, want ErrNotSwapped with why", err)
	}
	if moved || rolledBack || afterRan {
		t.Fatalf("the refused restore went on: moved %v, rolled back %v, after %v", moved, rolledBack, afterRan)
	}
	if err := s.Recover(); !errors.Is(err, ErrNotSwapped) {
		t.Fatalf("a recovery whose file could not first be written answered %v", err)
	}
	if err := s.Reset(); !errors.Is(err, ErrNotSwapped) {
		t.Fatalf("a factory reset whose file could not first be written answered %v", err)
	}
	if s.Generation() != gen {
		t.Fatal("a refused swap counted a generation")
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'The Kept Book'`); n != 1 {
		t.Fatal("the library is not open where it was after the refused swaps")
	}

	// What it writes is in the file a recovery goes on with.
	s.BeforeSwap(func(db *sql.DB) error {
		_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'written before the swap')`)
		return err
	})
	if err := s.Recover(); err != nil {
		t.Fatal(err)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM system_logs WHERE line = 'written before the swap'`); n != 1 {
		t.Fatalf("the recovered file holds %d of what was written before the swap, want 1", n)
	}

	// A restore that fails after its move: asked once, before the move, and not
	// again by the rollback.
	asked := 0
	s.BeforeSwap(func(*sql.DB) error {
		if asked++; asked > 1 {
			return refused
		}
		return nil
	})
	future := migratedFileWith(t, filepath.Join(t.TempDir(), "future.db"), "From The Future")
	fdb, err := sql.Open("sqlite", "file:"+future)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fdb.Exec(`INSERT INTO schema_version (version) VALUES (99999)`); err != nil {
		t.Fatal(err)
	}
	fdb.Close()
	aside := filepath.Join(dir, "pre")
	if err := os.Mkdir(aside, 0o700); err != nil {
		t.Fatal(err)
	}
	err = s.Swap(
		func() error {
			if err := moveDB(s.Path(), filepath.Join(aside, "tippani.db")); err != nil {
				return err
			}
			return moveDB(future, s.Path())
		},
		func(error) error {
			if err := moveDB(s.Path(), filepath.Join(dir, "failed.db")); err != nil {
				return err
			}
			return moveDB(filepath.Join(aside, "tippani.db"), s.Path())
		},
		nil,
	)
	var rb *RollbackError
	if err == nil || errors.As(err, &rb) || errors.Is(err, ErrNotSwapped) {
		t.Fatalf("a restore that failed after its move answered %v, want its own failure with the old library back", err)
	}
	if asked != 1 {
		t.Fatalf("BeforeSwap's fn was asked %d times by a restore and its rollback, want once", asked)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'The Kept Book'`); n != 1 {
		t.Fatal("the old library is not live after the rollback")
	}
}

// A swap whose file work fails before it moved anything reopens the files it
// found. One whose failure took the file away tries to reopen too, and fails
// rather than create an empty database where the library was; and a rollback that
// says it put the file back when it did not is caught the same way, as a failed
// rollback, which the restore answers by exiting with the old files kept.
func TestAFailedSwapReopensWhatIsThereAndConjuresNothing(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)

	if err := s.Swap(func() error { return errors.New("nothing moved") }, nil, nil); err == nil {
		t.Fatal("a failed move reported success")
	}
	if countT(t, s.DB, `SELECT count(*) FROM users`) != 1 {
		t.Fatal("after a move that failed untouched, the library is not open")
	}
	if err := s.LogWrite(func(db *sql.DB) error {
		_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'still here')`)
		return err
	}); err != nil {
		t.Fatalf("after a move that failed untouched, the log pool is not open: %v", err)
	}

	err = s.Swap(func() error {
		if err := moveDB(s.Path(), filepath.Join(dir, "elsewhere.db")); err != nil {
			return err
		}
		return errors.New("moved the library away and stopped")
	}, nil, nil)
	if err == nil {
		t.Fatal("a failed move reported success")
	}
	if !strings.Contains(err.Error(), "reopen") {
		t.Fatalf("a swap that left nothing to reopen did not say its reopen failed: %v", err)
	}
	if _, err := os.Stat(s.Path()); !os.IsNotExist(err) {
		t.Fatalf("a failed swap created a database where the library was (stat: %v)", err)
	}

	// The rollback that lies: it reports the old file back and leaves the path
	// empty. Opening what is there would make a new empty database, and the
	// restore, told the rollback worked, would answer "previous data is intact"
	// and delete the staging directory the library had been moved into.
	s2 := openHead(t)
	mustExecT(t, s2, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	aside := filepath.Join(t.TempDir(), "aside.db")
	err = s2.Swap(
		func() error {
			if err := moveDB(s2.Path(), aside); err != nil {
				return err
			}
			return errors.New("moved the library aside and stopped")
		},
		func(error) error { return nil },
		nil,
	)
	var rb *RollbackError
	if !errors.As(err, &rb) {
		t.Fatalf("a rollback that left nothing at the path reported %v, want a RollbackError", err)
	}
	if _, err := os.Stat(s2.Path()); !os.IsNotExist(err) {
		t.Fatalf("a rollback that put nothing back got an empty database made for it (stat: %v)", err)
	}
}

// A recovery rebuilds the library into a new file and then renames it over the
// old one. When that last rename fails, the old file must still be there and
// open: the server goes on serving it, and a restart finds it, rather than an
// empty path that the next boot fills with a new database.
func TestARecoveryWhoseLastRenameFailsKeepsTheLibraryOpen(t *testing.T) {
	s := openHead(t)
	mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, s, `INSERT INTO books (user_id, title) VALUES (1, 'The Kept Book')`)
	failPromote(t, func(string, string) error { return errors.New("the rename was refused") })

	if err := s.Recover(); err == nil {
		t.Fatal("a recovery whose rename failed reported success")
	}
	if _, err := os.Stat(s.Path()); err != nil {
		t.Fatalf("a failed rename left nothing at the library's path: %v", err)
	}
	if n := countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'The Kept Book'`); n != 1 {
		t.Fatal("the library is not open after the failed recovery")
	}
	if err := s.LogWrite(func(db *sql.DB) error {
		_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'still here')`)
		return err
	}); err != nil {
		t.Fatalf("the log pool is not open after the failed recovery: %v", err)
	}
}

// The same failed rename, reached from inside a restore: the archive's search
// index is too broken to rebuild, so the bring-up recovers the whole file, and the
// recovery's rename fails. The restore then reports only what is true — either the
// restored library is live and answering, or the old one is back.
func TestARestoreWhoseRecoveryCannotFinishReportsOnlyWhatIsTrue(t *testing.T) {
	setup := func(t *testing.T) (s *Store, move func() error, rollback func(error) error, rolledBack *bool) {
		t.Helper()
		dir := t.TempDir()
		var err error
		if s, err = Open(filepath.Join(dir, "tippani.db")); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { s.Close() })
		if err := s.Migrate(); err != nil {
			t.Fatal(err)
		}
		mustExecT(t, s, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
		mustExecT(t, s, `INSERT INTO books (user_id, title) VALUES (1, 'The Kept Book')`)
		restored := brokenIndexArchive(t, "Leviathan Rising")
		pre, failed := filepath.Join(dir, "pre"), filepath.Join(dir, "failed")
		for _, d := range []string{pre, failed} {
			if err := os.Mkdir(d, 0o700); err != nil {
				t.Fatal(err)
			}
		}
		rolledBack = new(bool)
		move = func() error {
			if err := moveDB(s.Path(), filepath.Join(pre, "tippani.db")); err != nil {
				return err
			}
			return moveDB(restored, s.Path())
		}
		// As the restore's does: everything in the data dir out of the way (the
		// restored file, if there is one, and the recovery's leftovers), then the
		// old files back.
		rollback = func(error) error {
			*rolledBack = true
			if err := moveEntriesExcept(dir, failed, "pre", "failed"); err != nil {
				return err
			}
			return moveEntriesExcept(pre, dir)
		}
		return s, move, rollback, rolledBack
	}

	t.Run("the rename fails and the restored file stays", func(t *testing.T) {
		s, move, rollback, rolledBack := setup(t)
		failPromote(t, func(string, string) error { return errors.New("the rename was refused") })
		if err := s.Swap(move, rollback, nil); err != nil {
			t.Fatalf("swap: %v (the restored file was intact, only its search index was broken)", err)
		}
		if *rolledBack {
			t.Fatal("the restore rolled back although the restored file was there and open")
		}
		if n := countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'Leviathan Rising'`); n != 1 {
			t.Fatal("the restore reported success but the restored library is not what the server is on")
		}
		if err := s.LogWrite(func(db *sql.DB) error {
			_, err := db.Exec(`INSERT INTO system_logs (at, level, line) VALUES (1, 'info', 'after')`)
			return err
		}); err != nil {
			t.Fatalf("the restore reported success but the log pool is not open: %v", err)
		}
	})

	// The rename this replaced deleted the old file first, so a failure left the
	// path empty. Should anything leave it so again, the bring-up has to notice
	// the closed pools: the restore rolls back rather than answering "complete".
	t.Run("the path is left empty", func(t *testing.T) {
		s, move, rollback, rolledBack := setup(t)
		failPromote(t, func(_, to string) error {
			os.Remove(to)
			return errors.New("the rename failed after the old file was gone")
		})
		afterRan := false
		err := s.Swap(move, rollback, func(*sql.DB) error { afterRan = true; return nil })
		if err == nil {
			t.Fatal("a restore left on closed pools reported success")
		}
		var rb *RollbackError
		if errors.As(err, &rb) {
			t.Fatalf("the rollback worked but the swap reported it failing: %v", err)
		}
		if !*rolledBack || afterRan {
			t.Fatalf("rolled back %v, success step ran %v; want the rollback and not the step", *rolledBack, afterRan)
		}
		if n := countT(t, s.DB, `SELECT count(*) FROM books WHERE title = 'The Kept Book'`); n != 1 {
			t.Fatal("the old library is not live after the rollback")
		}
	})
}

// A recovery copies rows into a fresh file, and a fresh file's AUTOINCREMENT
// counter starts from the highest id it was given. When the newest job had been
// pruned, that is lower than the old file's counter, and the next job would take
// the pruned one's id — and with it every link and log line that named it.
func TestARecoveryDoesNotHandOutAPrunedJobsId(t *testing.T) {
	s := openHead(t)
	mustExecT(t, s, `INSERT INTO jobs (id, kind, state, created_at) VALUES (7, 'fill', 'succeeded', 1), (8, 'fill', 'succeeded', 2)`)
	mustExecT(t, s, `DELETE FROM jobs WHERE id = 8`)
	if err := s.Recover(); err != nil {
		t.Fatal(err)
	}
	res, err := s.DB.Exec(`INSERT INTO jobs (kind, state, created_at) VALUES ('fill', 'queued', 3)`)
	if err != nil {
		t.Fatal(err)
	}
	if id, _ := res.LastInsertId(); id <= 8 {
		t.Fatalf("the first job after a recovery got id %d, one the old file had already given out", id)
	}
}

// migratedFileWith builds a head-schema database at path holding one book, and
// returns path. Closed, so it can be moved.
func migratedFileWith(t *testing.T, path, title string) string {
	t.Helper()
	o, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := o.Migrate(); err != nil {
		t.Fatal(err)
	}
	mustExecT(t, o, `INSERT INTO users (id, username, password_hash) VALUES (1, 'alice', 'x')`)
	mustExecT(t, o, `INSERT INTO books (user_id, title) VALUES (1, ?)`, title)
	if err := o.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

// brokenIndexArchive is a restorable database whose books_fts is gone, so there is
// no CREATE statement to rebuild it from: rebuildFTSTable fails for real and the
// self-heal has only a whole-file recovery left.
func brokenIndexArchive(t *testing.T, title string) string {
	t.Helper()
	path := migratedFileWith(t, filepath.Join(t.TempDir(), "restored.db"), title)
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`DROP TABLE books_fts`); err != nil {
		t.Fatal(err)
	}
	return path
}

// failPromote has the recovery's last step, the rename of the rebuilt file over
// the old one, run fn instead, until the test ends.
func failPromote(t *testing.T, fn func(from, to string) error) {
	t.Helper()
	was := promote
	promote = fn
	t.Cleanup(func() { promote = was })
}

// moveEntriesExcept moves every entry of from into to but the names given.
func moveEntriesExcept(from, to string, except ...string) error {
	entries, err := os.ReadDir(from)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if slices.Contains(except, e.Name()) {
			continue
		}
		if err := os.Rename(filepath.Join(from, e.Name()), filepath.Join(to, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

// moveDB moves a closed database and whichever of its sidecars exist, as the
// restore's move does with the whole data dir.
func moveDB(from, to string) error {
	for _, suffix := range []string{"-wal", "-shm"} {
		if err := os.Rename(from+suffix, to+suffix); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return os.Rename(from, to)
}
