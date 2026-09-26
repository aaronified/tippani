package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ErrNoConnection means the pool had no connection to give within the wait.
// It is the one failure this file reports as itself, because it is the failure
// issue #40 was: a live process whose requests all queue on a pool that never
// frees, while nothing says so.
var ErrNoConnection = errors.New("no database connection came free")

// ConnWait is how long an API request may wait for a pool connection before it
// is refused. Twice busyTimeout, because a writer waiting for SQLite's lock holds
// its connection for at most busyTimeout and then fails and lets go of it: a
// request that has waited twice that long is waiting on something that is not
// coming back.
//
// NO DATABASE CALL IN THIS APP CARRIES A CONTEXT. Every Query, QueryRow, Exec and
// Begin runs on context.Background(), so database/sql's wait for a free
// connection ends only when one is freed. A request deadline would bound
// nothing. So the bound is taken once, at the door, by Admit.
const ConnWait = 2 * busyTimeout

// Admit waits up to `wait` for a pool connection and hands it straight back. It
// holds nothing afterwards, so what it proves is that a connection came free, not
// that one is reserved. A request that passes may still wait inside its handler,
// and that wait is named in the log (httpapi's inflight tracker) rather than
// bounded.
func (s *Store) Admit(parent context.Context, wait time.Duration) error {
	db := s.DB
	ctx, cancel := context.WithTimeout(parent, wait)
	defer cancel()
	c, err := db.Conn(ctx)
	if err != nil {
		return noConn(db, err, wait)
	}
	return c.Close()
}

// Probe is Admit plus one read on the connection it got: the question a health
// check should ask, "can a request arriving now reach the database and get an
// answer". The read is the same statement GET /api/auth/status runs, and it is
// NOT in a transaction, because a transaction takes SQLite's write lock at BEGIN
// under _txlock=immediate and would queue behind any writer.
func (s *Store) Probe(parent context.Context, wait time.Duration) error {
	db := s.DB
	ctx, cancel := context.WithTimeout(parent, wait)
	defer cancel()
	c, err := db.Conn(ctx)
	if err != nil {
		return noConn(db, err, wait)
	}
	defer c.Close()
	var n int
	return c.QueryRowContext(context.Background(), `SELECT count(*) FROM users`).Scan(&n)
}

// noConn turns a timed-out wait into ErrNoConnection with the pool's own counts,
// and returns any other error unchanged: a closed handle mid-swap, or a caller
// that went away.
func noConn(db *sql.DB, err error, wait time.Duration) error {
	if !errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	st := db.Stats()
	return fmt.Errorf("%w in %s (%d of %d in use)", ErrNoConnection, wait, st.InUse, st.MaxOpenConnections)
}
