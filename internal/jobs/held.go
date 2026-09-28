package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"maps"
	"slices"
	"time"
)

// A STOP ON A WAITING JOB IS KEPT IN MEMORY FIRST, AND ITS ROW IS WRITTEN AFTER.
//
// The owner's "the job cancel button must also be the most responsive kill
// switch. No dillydallying after it has been pressed." A waiting job's Stop is a
// write, its row from waiting to stopped, and a write waits for SQLite's write
// lock: while a running import stages its file, in one transaction, or an
// approval writes a work, in one of its own, the Stop on the job waiting behind
// it waited with them, up to busy_timeout's five seconds, and answered an error
// if the lock was still held then. So the Stop is recorded here first, and the
// row's write follows when the lock frees:
//
//   - from the moment a job is held, no claim takes it (claim leaves it out, and a
//     claim already under way when it was held stops it before its first step),
//     an Enqueue's duplicate and limit checks do not count it, and nothing counts
//     it as ahead of anybody;
//   - the screens' reads of the queue read it as stopped (Held, which httpapi
//     reads GET /jobs, /jobs/{id}, /jobs/summary and /jobs/common through);
//   - its row is written by the Stop itself when the lock can be had within
//     heldWriteWait, and otherwise by whichever comes first: the worker, before
//     each claim; the running job, after each progress write, which it makes
//     between items with its own transaction closed; or shutdown, before it
//     interrupts what still waits.
//
// NO GOROUTINE WAITS FOR THE LOCK ON ITS BEHALF: the three writers are the two
// that already exist (§1 of the design log, "nothing wakes on a timer"). If the
// Stop's own write cannot land and no worker is alive to be told, the row waits
// for the next of them, and until then every read says what the Stop did.
//
// REJECTED: a waiting job's Stop that waits out the lock, as it did, which is the
// dillydallying. A goroutine per Stop that retries the write, which would be a
// third goroutine outliving the call that starts it. And the in-memory mark
// alone, with the row written only when the job would have been claimed: a
// restart before then would find it waiting and mark it interrupted, and the
// duplicate check would go on refusing the same job pressed again.

// heldWriteWait is the most a Stop waits for the write lock to write the row of
// a waiting job it held, before leaving that write to the others: long enough
// for an ordinary write of somebody else's to finish, short enough that the press
// is answered at once.
const heldWriteWait = 50 * time.Millisecond

// heldStop is a waiting job a Stop has stopped, in the database it was stopped in
// (gen), at `at` (its finished_at to be, in Unix ms).
type heldStop struct {
	gen uint64
	at  int64
}

// Held is every waiting job a Stop has stopped whose row may not say so yet, with
// the moment it was stopped (Unix ms), in the database the server is on now. The
// readers of the queue read these as stopped at that moment.
func (r *Runner) Held() map[int64]int64 {
	gen := r.st.Generation()
	r.hmu.Lock()
	defer r.hmu.Unlock()
	out := make(map[int64]int64, len(r.held))
	for id, h := range r.held {
		if h.gen == gen {
			out[id] = h.at
		}
	}
	return out
}

// HeldJSON is Held's ids as a JSON array, for a statement to leave them out with
// json_each: "[]" when there are none.
func HeldJSON(held map[int64]int64) string { return jsonIDs(slices.Sorted(maps.Keys(held))) }

// jsonIDs is ids as a JSON array, for json_each.
func jsonIDs(ids []int64) string {
	if ids == nil {
		ids = []int64{}
	}
	b, _ := json.Marshal(ids)
	return string(b)
}

// heldJSON is the current database's held ids, as HeldJSON writes them.
func (r *Runner) heldJSON() string { return HeldJSON(r.Held()) }

// hold marks the waiting jobs ids stopped in memory, in database gen. fresh is
// the ones it held now, whose Stop is news and has a line to log; taken is the
// ones the worker took, or that ended, since their rows were read, which are not
// held, and a running job's Stop reaches them. Any other id was held already, by
// an earlier press.
//
// THE ROW IS READ AGAIN ONCE THE MARK IS IN PLACE, which is what makes the answer
// true. A claim that commits after that read finds the mark, whether it was
// taken out of the claim (claim) or the claim was already under way (work, which
// then stops the job before its first step); a claim that committed before it
// shows in the read as a job no longer waiting, and its mark is taken back.
func (r *Runner) hold(gen uint64, ids []int64) (fresh, taken []int64, err error) {
	at := time.Now().UnixMilli()
	var marked []int64
	r.hmu.Lock()
	for _, id := range ids {
		if h, ok := r.held[id]; ok && h.gen == gen {
			continue
		}
		r.held[id] = heldStop{gen: gen, at: at}
		marked = append(marked, id)
	}
	r.hmu.Unlock()
	for _, id := range marked {
		var state string
		rerr := r.st.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, id).Scan(&state)
		if rerr == nil && state == StateQueued {
			fresh = append(fresh, id)
			continue
		}
		r.hmu.Lock()
		if h, ok := r.held[id]; ok && h == (heldStop{gen: gen, at: at}) {
			delete(r.held, id) // claimed, or ended, before the mark went in
			taken = append(taken, id)
		} else {
			// Taken since, by a claim that found the mark and stopped the job
			// before its first step, or written by a settle: held after all.
			fresh = append(fresh, id)
		}
		r.hmu.Unlock()
		if rerr != nil && err == nil {
			err = rerr
		}
	}
	return fresh, taken, err
}

// unhold takes back the mark on id in database gen, if there is one, and says
// whether there was: the worker's claim took a job that a Stop held while the
// claim was under way.
func (r *Runner) unhold(gen uint64, id int64) bool {
	r.hmu.Lock()
	defer r.hmu.Unlock()
	h, ok := r.held[id]
	if !ok || h.gen != gen {
		return false
	}
	delete(r.held, id)
	return true
}

// hasHeld is whether any job is held, so a progress write adds nothing when none
// is.
func (r *Runner) hasHeld() bool {
	r.hmu.Lock()
	defer r.hmu.Unlock()
	return len(r.held) > 0
}

// beginner is the library pool or one connection pinned from it (Close's, whose
// wait for the lock is its own).
type beginner interface {
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
}

// settleHeld writes the held jobs' rows, stopped at the moment each was held, in
// one transaction, and lets go of the marks it wrote: from then on the row says
// what the mark said. A mark from a database the server is no longer on is let
// go of unwritten, since its row is in a file nothing reads.
func (r *Runner) settleHeld(db beginner) error {
	gen := r.st.Generation()
	r.hmu.Lock()
	todo := map[int64]heldStop{}
	for id, h := range r.held {
		if h.gen != gen {
			delete(r.held, id)
			continue
		}
		todo[id] = h
	}
	r.hmu.Unlock()
	if len(todo) == 0 {
		return nil
	}
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for id, h := range todo {
		if _, err := tx.Exec(`UPDATE jobs SET state = 'stopped', finished_at = ? WHERE id = ? AND state = 'queued'`, h.at, id); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	r.hmu.Lock()
	for id, h := range todo {
		if r.held[id] == h {
			delete(r.held, id)
		}
	}
	r.hmu.Unlock()
	return nil
}

// settleHeldSoon is the Stop's own try at the rows it held: at most
// heldWriteWait for the lock, and, when that is not enough, a word to the worker,
// which writes them before its next claim. The word is given only if the queue's
// lock is free this instant: the one that holds it is either an Enqueue, which
// starts the worker itself when its insert is done, or the worker, which is
// alive to find them; waiting for it would be waiting for the insert, and so for
// the very write lock this is not waiting for.
func (r *Runner) settleHeldSoon() {
	err := r.st.WithLockWait(heldWriteWait, func(c *sql.Conn) error { return r.settleHeld(c) })
	if err == nil || !r.mu.TryLock() {
		return
	}
	r.kickLocked()
	r.mu.Unlock()
}
