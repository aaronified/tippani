package store

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// THE LOG POOL, AND THE ONE SWAP EVERY FILE CHANGE GOES THROUGH.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the store's
// own API — Swap, Recover, Reset, LogWrite, Generation and the LogDB field — and the
// system_logs table. That API is the package's whole contract with its two callers,
// the restore (httpapi, whose round trip is tested there) and the logbook that
// writes through LogWrite, which does not exist yet; nothing observable over HTTP
// can say which connection a line went through, whether it synced, or whether a
// swap waited for it.
//
// What each one guards, in a sentence a person would say: logging costs no disk
// sync while a saved quote still does; a log line written after a restore, a
// recovery or a factory reset lands in the database the server is now on; a
// restore whose search index is too broken to rebuild recovers instead of hanging
// the server; and a restore that fails puts the old library back and reopens it.

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

	// The archive's database: intact content, and books_fts gone, so there is no
	// CREATE statement to rebuild it from — rebuildFTSTable fails for real and the
	// self-heal has only Recover left (the shape httpapi's
	// TestReindexEscalationRepointsSessions uses too).
	restored := migratedFileWith(t, filepath.Join(t.TempDir(), "restored.db"), "Leviathan Rising")
	broken, err := sql.Open("sqlite", "file:"+restored)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := broken.Exec(`DROP TABLE books_fts`); err != nil {
		t.Fatal(err)
	}
	broken.Close()

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

// A swap whose file work fails before it moved anything reopens the files it
// found; one whose failure took the file away reopens nothing rather than create
// an empty database where the library was.
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

	if err := s.Swap(func() error {
		if err := moveDB(s.Path(), filepath.Join(dir, "elsewhere.db")); err != nil {
			return err
		}
		return errors.New("moved the library away and stopped")
	}, nil, nil); err == nil {
		t.Fatal("a failed move reported success")
	}
	if _, err := os.Stat(s.Path()); !os.IsNotExist(err) {
		t.Fatalf("a failed swap created a database where the library was (stat: %v)", err)
	}
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
