package store

import (
	"database/sql"
	"errors"
	"fmt"
	"testing"
)

// A LOCK SOMEBODY ELSE HOLDS IS TOLD APART FROM A WRITE THAT CANNOT WORK.
//
// WHAT IT KNOWS, declared: IsBusy is a classifier and the function is the
// observable unit; nothing over HTTP reports which error a log batch met. The
// busy error is produced for real, by a second SQLite client on the same file (as
// a `sqlite3` shell or a second process would be) asking for the write lock the
// store's pool holds, with no busy wait of its own, so the answer comes at once.

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
