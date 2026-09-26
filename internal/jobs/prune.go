package jobs

import (
	"database/sql"
	"errors"
	"time"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// The prune's steps, in order: old system lines, the lines of old finished jobs,
// those jobs, and then the ceiling on the system log. Job lines go before their
// jobs so no one statement deletes a month of lines through the cascade.
const (
	pruneSystem = iota
	pruneJobLogs
	pruneJobs
	pruneCeiling
	pruneDone
)

// pruneRun is one prune in progress. The cutoff is fixed when it starts, so a
// prune that yields to a hundred batches still deletes against one line.
type pruneRun struct {
	cutoff   int64 // unix ms; finished before this is old
	step     int
	boundary int64 // the ceiling step's newest id to delete; 0 until found
}

// nextPruneLocked is the prune the drainer should run a chunk of when it has no
// batch: the one in progress, or a new one if one was asked for.
func (lb *Logbook) nextPruneLocked() *pruneRun {
	if lb.prune == nil && lb.pruneWanted {
		lb.pruneWanted = false
		lb.lastPrune = time.Now()
		lb.prune = &pruneRun{cutoff: time.Now().Add(-lb.tune.retention).UnixMilli()}
	}
	return lb.prune
}

// pruneStep runs one chunk of run in its own transaction and moves run on when a
// chunk comes back short. A failure ends this prune; the next chance (an hour's
// writing later, or the Jobs tab opening) starts a new one.
func (lb *Logbook) pruneStep(st *store.Store, run *pruneRun) {
	var n int64
	err := lb.retrying(st, func(db *sql.DB) error {
		var err error
		n, err = pruneChunkOf(db, run, lb.tune.pruneChunk, lb.tune.systemCeiling)
		return err
	})
	lb.mu.Lock()
	defer lb.mu.Unlock()
	if err != nil {
		stderr.Printf("[error] %s the prune of jobs and log lines older than 30 days stopped: %v", olog.CodeLogPrune, err)
		lb.prune = nil
		return
	}
	if n < int64(lb.tune.pruneChunk) {
		run.step++
	}
	if run.step >= pruneDone {
		lb.prune = nil
	}
}

// pruneChunkOf deletes up to chunk rows for run's step and says how many.
func pruneChunkOf(db *sql.DB, run *pruneRun, chunk, ceiling int) (int64, error) {
	// A job still queued or running is never old, whatever its dates say.
	const finished = `SELECT id FROM jobs WHERE finished_at < ? AND state NOT IN ('queued', 'running')`
	var res sql.Result
	var err error
	switch run.step {
	case pruneSystem:
		res, err = db.Exec(`DELETE FROM system_logs WHERE id IN
			(SELECT id FROM system_logs WHERE at < ? ORDER BY id LIMIT ?)`, run.cutoff, chunk)
	case pruneJobLogs:
		res, err = db.Exec(`DELETE FROM job_logs WHERE id IN
			(SELECT id FROM job_logs WHERE job_id IN (`+finished+`) LIMIT ?)`, run.cutoff, chunk)
	case pruneJobs:
		res, err = db.Exec(`DELETE FROM jobs WHERE id IN (`+finished+` ORDER BY id LIMIT ?)`, run.cutoff, chunk)
	case pruneCeiling:
		if run.boundary == 0 {
			// The newest id that is past the ceiling, counted from the newest end.
			err = db.QueryRow(`SELECT id FROM system_logs ORDER BY id DESC LIMIT 1 OFFSET ?`, ceiling).
				Scan(&run.boundary)
			if errors.Is(err, sql.ErrNoRows) {
				return 0, nil // under the ceiling
			}
			if err != nil {
				return 0, err
			}
		}
		res, err = db.Exec(`DELETE FROM system_logs WHERE id IN
			(SELECT id FROM system_logs WHERE id <= ? ORDER BY id LIMIT ?)`, run.boundary, chunk)
	default:
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
