package store

import (
	"context"
	"database/sql"
	"testing"
)

// HoldEveryConnectionForTest takes every connection the pool has and keeps them
// until the test ends, which is the state issue #40 describes: a live process
// whose pool gives nothing to anyone. Exported, and living in the package that
// owns the pool, because httpapi's tests need it and the pool size is this
// package's fact, not theirs.
//
// Bare connections, not transactions: under _txlock=immediate a read-write
// transaction takes SQLite's write lock at BEGIN, and a second one would deadlock
// against the first instead of holding the pool.
func HoldEveryConnectionForTest(t *testing.T, db *sql.DB) []*sql.Conn {
	t.Helper()
	if db.Stats().MaxOpenConnections == 0 {
		t.Fatal("HoldEveryConnectionForTest: the pool is unbounded, so it cannot be held full")
	}
	var held []*sql.Conn
	for st := db.Stats(); st.InUse < st.MaxOpenConnections; st = db.Stats() {
		c, err := db.Conn(context.Background())
		if err != nil {
			t.Fatalf("hold connection %d: %v", len(held)+1, err)
		}
		held = append(held, c)
	}
	t.Cleanup(func() { ReleaseForTest(held) })
	return held
}

// ReleaseForTest gives held connections back to the pool. Safe to call twice: a
// connection already given back answers sql.ErrConnDone, which is ignored.
func ReleaseForTest(held []*sql.Conn) {
	for _, c := range held {
		_ = c.Close()
	}
}
