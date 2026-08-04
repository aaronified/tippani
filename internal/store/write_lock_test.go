package store

import (
	"path/filepath"
	"sync"
	"testing"
)

// The concurrent-write 500 the roadmap carried for two releases, reduced to the two
// statements that caused it.
//
// Almost every write in this app reads first — the duplicate check, the ownership
// check, the row it is about to update. Under SQLite's default DEFERRED locking that
// makes BEGIN take a read lock, and the first INSERT has to upgrade it to a write
// lock. SQLite will not run the busy handler for that upgrade: two transactions both
// holding read locks and both wanting to write would deadlock, so it fails the second
// one instantly with SQLITE_BUSY. busy_timeout is never consulted, which is why the
// original failure came back in 17ms with a 5000ms timeout configured.
//
// openDB opens with _txlock=immediate, which takes the write lock at BEGIN, before
// there is anything to upgrade. A second writer then simply waits.
//
// This test is the direct one: N transactions that each read, then write. Without
// _txlock=immediate it fails almost every run; with it, it must never fail.
func TestConcurrentReadThenWriteTransactions(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if _, err := s.DB.Exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER)`); err != nil {
		t.Fatal(err)
	}

	const n = 16
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			tx, err := s.DB.Begin()
			if err != nil {
				errs[i] = err
				return
			}
			defer tx.Rollback()
			// The read that used to poison the transaction.
			var count int
			if err := tx.QueryRow(`SELECT count(*) FROM t`).Scan(&count); err != nil {
				errs[i] = err
				return
			}
			if _, err := tx.Exec(`INSERT INTO t (v) VALUES (?)`, i); err != nil {
				errs[i] = err
				return
			}
			errs[i] = tx.Commit()
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("writer %d: %v (a SQLITE_BUSY here means openDB lost _txlock=immediate)", i, err)
		}
	}

	var total int
	if err := s.DB.QueryRow(`SELECT count(*) FROM t`).Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != n {
		t.Fatalf("%d rows written, want %d", total, n)
	}
}

// Readers must not have been serialised by the fix. _txlock only applies to read-write
// transactions, so a ReadOnly one still gets a plain deferred BEGIN and several can
// overlap — including while a writer holds the write lock, which is the whole point of
// WAL. If this ever fails, the DSN has started applying immediate locking to reads and
// every search on the box is now queueing behind imports.
func TestReadersOverlapAWriter(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if _, err := s.DB.Exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER)`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.Exec(`INSERT INTO t (v) VALUES (1)`); err != nil {
		t.Fatal(err)
	}

	// Hold the write lock open.
	w, err := s.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer w.Rollback()
	if _, err := w.Exec(`INSERT INTO t (v) VALUES (2)`); err != nil {
		t.Fatal(err)
	}

	// Two readers must still get through while it is held. The pool caps at 4, so two
	// alongside the writer is comfortably inside it.
	for i := 0; i < 2; i++ {
		var n int
		if err := s.DB.QueryRow(`SELECT count(*) FROM t`).Scan(&n); err != nil {
			t.Fatalf("read %d blocked by an open writer: %v", i, err)
		}
		if n != 1 {
			t.Fatalf("read %d saw %d rows, want 1 — the uncommitted write leaked", i, n)
		}
	}
}
