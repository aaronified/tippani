package jobs

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"tippani/internal/olog"
)

// Job is the handle a Kind's Run gets: what it was asked to do, who asked, and
// the ways it reports back. It is also the Recorder in Run's context, so an
// outbound call made anywhere under Run lands in this job's log.
type Job struct {
	r        *Runner
	id       int64
	kind     string
	uid      sql.NullInt64
	username string // as it was when the job was queued
	owner    Owner  // as the account is now, read when the job was claimed
	subject  string
	params   string
	started  time.Time
	// gen is the store generation the job was claimed under, so its lines are
	// written only into the file where its id is this job (Logbook.jobLineIn).
	// A job runs inside one generation: Exclusive, which every swap the server
	// makes runs under, waits for the job in hand and holds the worker.
	gen uint64

	stop      atomic.Bool // a person asked it to stop
	shutdown  atomic.Bool // the server is stopping
	told      atomic.Bool // Stopping told the run to stop, so it stopped short (finish)
	abandoned atomic.Bool // Close stopped waiting for it and marked it interrupted
	// over is closed when the worker lets go of the job, its end recorded
	// (WaitOwnerIdle waits on it).
	over chan struct{}

	pmu       sync.Mutex
	done      int
	total     int
	lastWrite time.Time
}

// ID is the job's id.
func (j *Job) ID() int64 { return j.id }

// Owner is the account the job runs for, as it was when the job was claimed.
func (j *Job) Owner() Owner { return j.owner }

// Log adds a line to the job's log. It never waits on the database.
func (j *Job) Log(level, format string, args ...any) {
	j.r.lb.jobLineIn(j.gen, j.id, level, fmt.Sprintf(format, args...))
}

// Subject renames what the job is about, in its row.
func (j *Job) Subject(s string) {
	j.subject = cleanSubject(s)
	if _, err := j.r.st.DB.Exec(`UPDATE jobs SET subject = ? WHERE id = ?`, j.subject, j.id); err != nil {
		olog.Errorf(olog.CodeJobRecord, "[jobs] #%d subject: %v", j.id, err)
	}
}

// Stopping reports whether the job should stop after the item in hand: a person
// pressed Stop, or the server is shutting down. Run checks it between items, and
// stops when it answers yes — which is how the job's end is told: a run that was
// answered yes stopped short of its items, and one never answered yes did them
// all, a Stop pressed during its last item notwithstanding (finish).
func (j *Job) Stopping() bool {
	if !j.stopAsked() {
		return false
	}
	j.told.Store(true)
	return true
}

// stopAsked is whether Stop or shutdown has asked the job to stop, without
// telling its run so.
func (j *Job) stopAsked() bool { return j.stop.Load() || j.shutdown.Load() }

// Params decodes the job's params into v.
func (j *Job) Params(v any) error { return json.Unmarshal([]byte(j.params), v) }

// Secret is what Enqueue was given to keep in memory for this job (a backup's
// password), or nil.
func (j *Job) Secret() any {
	j.r.smu.Lock()
	defer j.r.smu.Unlock()
	return j.r.secrets[j.id]
}

// Progress records how far the job has got. It writes at most every half second,
// and always when done reaches total; the finishing write records the last
// numbers whatever the throttle held back.
func (j *Job) Progress(done, total int) {
	j.pmu.Lock()
	j.done, j.total = done, total
	due := time.Since(j.lastWrite) >= progressEvery || (total > 0 && done >= total)
	if due {
		j.lastWrite = time.Now()
	}
	j.pmu.Unlock()
	if !due {
		return
	}
	if _, err := j.r.st.DB.Exec(`UPDATE jobs SET done = ?, total = ? WHERE id = ? AND state = 'running'`,
		done, total, j.id); err != nil {
		olog.Errorf(olog.CodeJobRecord, "[jobs] #%d progress: %v", j.id, err)
	}
}

// final is the progress to record at the end: the last Progress, or the row's
// own total when Run never called it.
func (j *Job) final() (done, total int) {
	j.pmu.Lock()
	defer j.pmu.Unlock()
	return j.done, j.total
}

// SetResult stores v, as JSON, for the job's own screen to read back, and the
// counts its kind makes of it (Kind.Counts) in the same write. More than 8 MB is
// refused (ErrTooLarge).
func (j *Job) SetResult(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if len(b) > MaxResult {
		return ErrTooLarge
	}
	counts, err := j.counts(b)
	if err != nil {
		return err
	}
	_, err = j.r.st.DB.Exec(`UPDATE jobs SET result = ?, counts = ? WHERE id = ?`, string(b), counts, j.id)
	return err
}

// counts is the kind's counts of result, as stored: {} for a kind that counts
// nothing. A string among them passes the door a subject does (one line,
// redacted, 200 characters): it is a provider's error text more often than not,
// and it rides on every list row and into a flash.
func (j *Job) counts(result []byte) (string, error) {
	k, ok := j.r.kind(j.kind)
	if !ok || k.Counts == nil {
		return "{}", nil
	}
	c := k.Counts(result)
	if len(c) == 0 {
		return "{}", nil
	}
	for key, v := range c {
		if s, ok := v.(string); ok {
			c[key] = cleanSubject(s)
		}
	}
	b, err := json.Marshal(c)
	if err != nil {
		return "", fmt.Errorf("jobs: counts: %w", err)
	}
	return string(b), nil
}
