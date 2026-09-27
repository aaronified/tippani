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

	stop      atomic.Bool // a person asked it to stop
	shutdown  atomic.Bool // the server is stopping
	abandoned atomic.Bool // Close stopped waiting for it and marked it interrupted

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
	j.r.lb.JobLine(j.id, level, fmt.Sprintf(format, args...))
}

// Subject renames what the job is about, in its row.
func (j *Job) Subject(s string) {
	j.subject = cleanSubject(s)
	if _, err := j.r.st.DB.Exec(`UPDATE jobs SET subject = ? WHERE id = ?`, j.subject, j.id); err != nil {
		olog.Errorf(olog.CodeJobRecord, "[jobs] #%d subject: %v", j.id, err)
	}
}

// Stopping reports whether the job should stop after the item in hand: a person
// pressed Stop, or the server is shutting down. Run checks it between items.
func (j *Job) Stopping() bool { return j.stop.Load() || j.shutdown.Load() }

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

// SetResult stores v, as JSON, for the job's own screen to read back. More than
// 8 MB is refused (ErrTooLarge).
func (j *Job) SetResult(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if len(b) > maxResult {
		return ErrTooLarge
	}
	_, err = j.r.st.DB.Exec(`UPDATE jobs SET result = ? WHERE id = ?`, string(b), j.id)
	return err
}
