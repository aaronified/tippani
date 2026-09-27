package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"time"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// IsBusy reports whether err is SQLite's SQLITE_BUSY — another connection held the
// write lock for longer than busy_timeout — however deeply it is wrapped. The
// extended codes (BUSY_SNAPSHOT, BUSY_RECOVERY, BUSY_TIMEOUT) count too: each is
// the same "try again later" and none is a fault in the statement.
//
// It is here so that the one caller that retries on it, the logbook's drainer,
// can tell a lock held by somebody's import from a write that will never work,
// without importing the driver: which driver is underneath is this package's
// business, and so is the shape of its errors.
func IsBusy(err error) bool {
	var se *sqlite.Error
	return errors.As(err, &se) && se.Code()&0xff == sqlite3.SQLITE_BUSY
}

// WithLockWait runs fn on one connection of the library pool that waits at most
// wait for SQLite's write lock, rather than busy_timeout's five seconds, having
// waited at most wait for the connection itself. It is for the few writes that
// have a deadline of their own and would rather fail than be late: shutdown's,
// which must be done inside Docker's ten-second grace or be killed mid-way.
//
// NOT A CONTEXT, BECAUSE A CONTEXT BOUNDS NOTHING HERE. The driver answers a
// context that ends with sqlite3_interrupt, and SQLite does not look at that while
// it waits on the lock: measured on this driver, an ExecContext with half a
// second left returned after the full five, as did a QueryContext. busy_timeout
// is the wait SQLite itself keeps to, and it is per connection, so this pins one,
// shortens it, and sets it back before the connection returns to the pool. A
// connection whose wait could not be set back is thrown away instead, so no later
// writer inherits the short one and gives up early on an ordinary busy moment.
func (s *Store) WithLockWait(wait time.Duration, fn func(c *sql.Conn) error) error {
	db := s.DB
	ctx, cancel := context.WithTimeout(context.Background(), wait)
	c, err := db.Conn(ctx)
	cancel()
	if err != nil {
		return noConn(db, err, wait)
	}
	defer c.Close()
	bg := context.Background()
	if _, err := c.ExecContext(bg, fmt.Sprintf("PRAGMA busy_timeout = %d", max(wait.Milliseconds(), 1))); err != nil {
		return err
	}
	ferr := fn(c)
	if _, err := c.ExecContext(bg, fmt.Sprintf("PRAGMA busy_timeout = %d", busyTimeout.Milliseconds())); err != nil {
		_ = c.Raw(func(any) error { return driver.ErrBadConn })
	}
	return ferr
}
