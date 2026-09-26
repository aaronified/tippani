package store

import (
	"errors"

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
