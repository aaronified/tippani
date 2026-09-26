package store

import (
	"database/sql"
	"errors"
	"fmt"
	"os"

	"tippani/internal/olog"
)

// SWAPPING THE DATABASE FILES UNDER A LIVE STORE. Three things do it: a restore
// (Swap, below), Recover and Reset (repair.go). Each used to close and reopen the
// one pool its own way, and with a second pool on the same file (LogDB) that stops
// being safe: a pool left open on a file that has been moved aside goes on writing
// into the moved file, and a pool the swap forgot to reopen answers every write
// with "database is closed" until a restart. So all three run through swapLocked,
// and it is the only code that closes or reopens a pool after Open.

// swapLocked is the body every swap shares. The caller holds logMu for writing and
// then repairMu (store.go gives the order), which is what parks the logbook's
// drainer in LogWrite for the whole swap.
//
// It checkpoints, closes the log pool and then the library pool, runs files with
// nothing open, and reopens both pools on whatever then sits at the path — on
// every exit, a failed files included, because a store left holding closed pools
// fails every request until somebody restarts it.
//
// THE ONE EXIT THAT DOES NOT REOPEN is a failed files that left no file at the
// path. Opening would create an empty database there, and a server that comes back
// empty after a failed swap looks like a server that lost everything; with the
// pools closed it only looks broken, and the files are wherever files left them.
//
// Every call counts a generation, failed or not: a failed swap may still have
// moved files, and a consumer that sees a new number only gives up trusting an id
// it noted before, which is the safe mistake.
//
// Nothing here or below it may take logMu or repairMu: the caller holds both, and
// neither is reentrant. That is why Recover's body is recoverLocked, which a
// restore's FTS self-heal reaches from inside Swap.
func (s *Store) swapLocked(files func() error) error {
	defer s.gen.Add(1)
	if err := s.Checkpoint(); err != nil {
		olog.Alertf("[store] pre-swap checkpoint returned: %v (continuing)", err)
	}
	// Log pool first: it is the one a drainer would be writing through, and
	// nothing is — logMu says so — so it closes with nothing in flight.
	if err := s.LogDB.Close(); err != nil {
		olog.Alertf("[store] closing the log pool before the swap returned: %v (continuing)", err)
	}
	if err := s.DB.Close(); err != nil {
		olog.Alertf("[store] closing the library pool before the swap returned: %v (continuing)", err)
	}
	filesErr := files()
	if filesErr != nil {
		if _, err := os.Stat(s.path); err != nil {
			return filesErr
		}
	}
	if err := s.openPools(); err != nil {
		return errors.Join(filesErr, fmt.Errorf("reopen %s after the swap: %w", s.path, err))
	}
	return filesErr
}

// bringUp readies a database that has just been swapped in exactly as boot readies
// one: migrate forward, integrity-check, FTS self-heal. The caller holds logMu and
// repairMu, so the self-heal runs repairFTSLocked, whose escalation to a whole-file
// recovery (another swap) re-takes neither.
func (s *Store) bringUp() error {
	if err := s.Migrate(); err != nil {
		return fmt.Errorf("migrate restored database: %w", err)
	}
	s.CheckIntegrity()
	s.repairFTSLocked()
	return nil
}

// Swap replaces the database files under the live store, for a restore. It holds
// the swap lock from before the first file moves until both pools are open on the
// result, so everything between is one step to anybody else:
//
//   - move puts the new files in place, with both pools closed;
//   - both pools reopen on them, and they are brought up as boot would (bringUp);
//   - after, when given, runs on the new library pool while the logbook's drainer
//     is still parked — the restore carries the job history over here;
//   - when any of those fails, rollback (when given) is handed the failure and puts
//     the previous files back, and they are reopened and brought up the same way.
//     after does not run on them.
//
// A nil error means the new files are live. Any other error means they are not:
// either the rollback put the old ones back, or — a *RollbackError — it could not,
// and the store holds whatever the failed rollback left.
//
// It replaces the CloseForSwap / ReopenAfterSwap pair, which left the gap between
// them unguarded: the restore's file moves ran with no lock held, and its rollback
// reopened the old files with a second, separate call. Callers holding their own
// *sql.DB (the session store) must re-read Store.DB afterwards, on every exit.
func (s *Store) Swap(move func() error, rollback func(cause error) error, after func(db *sql.DB) error) error {
	s.logMu.Lock()
	defer s.logMu.Unlock()
	s.repairMu.Lock()
	defer s.repairMu.Unlock()

	err := s.swapLocked(move)
	if err == nil {
		err = s.bringUp()
	}
	if err == nil && after != nil {
		err = after(s.DB)
	}
	if err == nil || rollback == nil {
		return err
	}
	rbErr := s.swapLocked(func() error { return rollback(err) })
	if rbErr == nil {
		rbErr = s.bringUp()
	}
	if rbErr != nil {
		return &RollbackError{Cause: err, Rollback: rbErr}
	}
	return err
}

// RollbackError is Swap's report that the swap failed and putting the previous
// files back failed too. The store is then on whatever the failed rollback left,
// which nothing can vouch for; the restore exits for a clean boot on it.
type RollbackError struct {
	Cause    error // why the swap failed
	Rollback error // why putting the old files back failed
}

func (e *RollbackError) Error() string {
	return fmt.Sprintf("%v; rolling back: %v", e.Cause, e.Rollback)
}

func (e *RollbackError) Unwrap() []error { return []error{e.Cause, e.Rollback} }
