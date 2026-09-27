package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"tippani/internal/olog"
	"tippani/internal/outbound"
	"tippani/internal/store"
)

// What Enqueue, Stop, Rerun and Exclusive refuse with. The API maps each to its
// status (spec D); the text here is for logs and tests, and the words a reader
// sees are the API's.
var (
	ErrClosed        = errors.New("jobs: the server is shutting down")                             // 503
	ErrBusy          = errors.New("jobs: busy (a job, or a restore, reset or update, is running)") // 409
	ErrStale         = errors.New("jobs: the database was swapped since this request began")       // 409, answered like ErrBusy
	ErrAdminOnly     = errors.New("jobs: only an admin can start this kind of job")                // 403
	ErrLimit         = errors.New("jobs: already this many jobs queued or running")                // 429
	ErrNotFound      = errors.New("jobs: no such job")                                             // 404
	ErrNotRerunnable = errors.New("jobs: this job cannot be run again")                            // 409
	ErrUnknownKind   = errors.New("jobs: no such kind of job")                                     // 400
	ErrNoOwner       = errors.New("jobs: a job needs an account to belong to")                     // 400; also an account deleted mid-request
	ErrTooLarge      = errors.New("jobs: a job's result may be at most 8 MB")                      // the kind's bug
)

// ErrDuplicate is Enqueue's answer when the same owner already has the same kind
// with the same params queued or running: pressing Fill gaps twice on one
// selection is one job, and the second press is told which (409, with ID).
type ErrDuplicate struct{ ID int64 }

func (e *ErrDuplicate) Error() string {
	return fmt.Sprintf("jobs: the same job is already queued or running (#%d)", e.ID)
}

// HoldEnv is the journey tier's test seam, declared here and in the header of
// every file that uses it: TIPPANI_JOBS_HOLD=1 keeps the worker from claiming,
// so every job enqueued stays waiting. A journey runs offline, where every job
// would otherwise finish in milliseconds and there would be no waiting job to
// see. It is honoured ONLY while outbound.Off() — a server that can reach the
// internet ignores it, so the switch cannot quietly stall a real deployment.
const HoldEnv = "TIPPANI_JOBS_HOLD"

func holding() bool { return os.Getenv(HoldEnv) == "1" && outbound.Off() }

// maxResult is the most a job's result may hold. The result is read back whole by
// the job's own screen (a re-verify's preview), and a row larger than this would
// be a bug in the kind, not a large library.
const maxResult = 8 << 20

// progressEvery is the most often Progress writes: a fill of two thousand items
// is not two thousand writes, and a screen polling once a second sees no less.
const progressEvery = 500 * time.Millisecond

// Kind is one sort of queued job: what it is called, who may start it, whether a
// finished one can be run again, and what it does.
//
// Run gets the runner's own context, never a request's: it outlives the request
// that queued it by design, and it is cancelled only when the server shuts down.
// It should check j.Stopping() between items — Stop means "after the item in
// hand" — and report each item with j.Progress.
type Kind struct {
	Name       string
	AdminOnly  bool
	Rerunnable bool
	Run        func(ctx context.Context, j *Job) error
}

// Owner is who a job is for, as the request knew them: the account, and the store
// generation read before the account was (store.Generation says why that order).
type Owner struct {
	UserID   int64
	Username string
	IsAdmin  bool
	Gen      uint64
}

// Options tunes a Runner. The zero value is the server's.
type Options struct {
	// PerOwner caps an owner's queued and running jobs (ErrLimit). 0 means 5.
	PerOwner int
	// CancelWait is how long Close waits for a job after cancelling the
	// runner's context, before marking it interrupted. 0 means 1 s.
	CancelWait time.Duration
	// FlushWait bounds the wait for a job's last lines before its finishing
	// write. 0 means 2 s.
	FlushWait time.Duration
}

// Runner is the queue: one job at a time across the server, the rest waiting in
// the order they were started. Queued jobs are rows on the library pool, written
// synchronously like any other small write; their lines go through the Logbook.
//
// THE WORKER is one goroutine at most, started by the call that gives it work
// and gone when there is none. It claims the oldest waiting job, runs it, and
// looks again. The lost-wakeup guard is a mutex over {alive, pending}: whoever
// queues a job sets pending after its row is committed and starts a worker if
// none is alive; the worker clears pending before each look, and exits only if,
// finding nothing, it also finds pending still clear. A job committed before the
// look is found by it; one committed after sets pending, and the worker looks
// again.
type Runner struct {
	st   *store.Store
	lb   *Logbook
	opts Options

	kmu   sync.RWMutex
	kinds map[string]Kind

	// The runner's own context: every job runs under it, and Close cancels it.
	base   context.Context
	cancel context.CancelFunc

	mu        sync.Mutex
	closed    bool
	exclusive int // Exclusive calls in progress
	alive     bool
	pending   bool
	claiming  bool
	claimStop map[int64]bool // Stop asked for a job while the worker was claiming it
	// claimEnded is closed when the claim in progress ends. A Stop waits on it:
	// until the claim is over, nobody can say whether it took the job asked for.
	claimEnded chan struct{}
	running    *Job
	idle       chan struct{} // closed when the current worker exits

	// secrets are what a job needs and must never be stored: a backup's
	// password. Kept by job id, never on the Job and never in the row, and
	// deleted on every way a job can end. Under their own lock, so a job
	// reading its secret mid-transaction never waits on an Enqueue that is
	// itself waiting on that transaction's write lock.
	smu     sync.Mutex
	secrets map[int64]any

	// afterClaim runs between a claim and the worker taking the lock again, told
	// whether the claim found a job. A test seam and nothing else: the one way to
	// land a Stop or an Enqueue inside that window, which lasts microseconds and
	// which no timing reaches on purpose.
	afterClaim func(found bool)
}

// NewRunner makes the queue. It starts nothing: Boot settles what a previous run
// left behind, and the first Enqueue starts the worker.
func NewRunner(st *store.Store, lb *Logbook, opts Options) *Runner {
	if opts.PerOwner <= 0 {
		opts.PerOwner = 5
	}
	if opts.CancelWait <= 0 {
		opts.CancelWait = time.Second
	}
	if opts.FlushWait <= 0 {
		opts.FlushWait = 2 * time.Second
	}
	base, cancel := context.WithCancel(context.Background())
	return &Runner{
		st: st, lb: lb, opts: opts,
		kinds: map[string]Kind{}, base: base, cancel: cancel,
		claimStop: map[int64]bool{}, secrets: map[int64]any{},
		idle: closedChan(),
	}
}

func closedChan() chan struct{} {
	c := make(chan struct{})
	close(c)
	return c
}

// Register adds a kind. It panics on a name out of shape, a nil Run or a second
// registration: each is a mistake in the code that wires the kinds, found at
// start rather than at the first press.
func (r *Runner) Register(k Kind) {
	if !kindShape.MatchString(k.Name) || k.Run == nil {
		panic(fmt.Sprintf("jobs: bad kind %q", k.Name))
	}
	r.kmu.Lock()
	defer r.kmu.Unlock()
	if _, dup := r.kinds[k.Name]; dup {
		panic(fmt.Sprintf("jobs: kind %q registered twice", k.Name))
	}
	r.kinds[k.Name] = k
}

func (r *Runner) kind(name string) (Kind, bool) {
	r.kmu.RLock()
	defer r.kmu.RUnlock()
	k, ok := r.kinds[name]
	return k, ok
}

// Enqueue queues a job for owner and returns its id. params is stored as JSON
// and handed back to Run through j.Params; it must never hold a secret, which
// goes in secret instead and lives only in memory, for Run to read through
// j.Secret. total is the item count the screen shows before the first Progress.
//
// A params object with a from_job member (a job id) also records it in the row's
// from_job column: a re-verify's apply names the check it came from that way, and
// it is the one member of params the runner reads.
func (r *Runner) Enqueue(owner Owner, kind, subject string, params any, total int, secret any) (int64, error) {
	return r.enqueue(owner, kind, subject, params, total, secret, 0)
}

func (r *Runner) enqueue(owner Owner, kind, subject string, params any, total int, secret any, rerunOf int64) (int64, error) {
	k, ok := r.kind(kind)
	if !ok {
		return 0, ErrUnknownKind
	}
	if owner.UserID == 0 {
		return 0, ErrNoOwner
	}
	if k.AdminOnly && !owner.IsAdmin {
		return 0, ErrAdminOnly
	}
	p, err := canonicalParams(params)
	if err != nil {
		return 0, fmt.Errorf("jobs: params: %w", err)
	}

	// Held across the insert, so a Close or an Exclusive that starts now waits
	// for this job to be in the table (where it will interrupt or hold it)
	// rather than racing it.
	r.mu.Lock()
	defer r.mu.Unlock()
	switch {
	case r.closed:
		return 0, ErrClosed
	case r.exclusive > 0:
		return 0, ErrBusy
	case owner.Gen != r.st.Generation():
		return 0, ErrStale
	}
	id, err := r.insert(owner, kind, cleanSubject(subject), p, total, rerunOf)
	if err == nil && secret != nil {
		r.smu.Lock()
		r.secrets[id] = secret
		r.smu.Unlock()
	}
	// Kicked when the insert refuses, too. A press refused as a duplicate or as
	// one too many is a press on jobs that are already waiting, and if a claim
	// that failed on a locked database left them with no worker, pressing again
	// is what a reader will do and has to be what starts one. A kick with
	// nothing waiting costs a worker that looks once and exits.
	r.kickLocked()
	return id, err
}

// insert checks the account, the duplicate and the limit and inserts, in one
// transaction, so two presses at once cannot both pass either check.
//
// THE ACCOUNT IS CHECKED HERE, BY ID AND NAME, because 0079's trigger only clears
// user_id on the rows that exist when an account is deleted, and users.id is
// reused. A request that resolved its account just before the delete would
// otherwise insert the dead id just after it, and the job would run for whoever
// is given that id next. The main pool's transactions take the write lock at
// BEGIN (_txlock=immediate), so no delete lands between this check and the
// insert, and the trigger covers every delete after it: a user_id on a queued
// row always names the account that queued it, which is what lets the claim
// (execute) and Rerun check the id alone.
func (r *Runner) insert(owner Owner, kind, subject, params string, total int, rerunOf int64) (int64, error) {
	tx, err := r.st.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var one int
	switch err := tx.QueryRow(`SELECT 1 FROM users WHERE id = ? AND username = ?`, owner.UserID, owner.Username).Scan(&one); {
	case errors.Is(err, sql.ErrNoRows):
		return 0, ErrNoOwner
	case err != nil:
		return 0, err
	}
	var dup int64
	err = tx.QueryRow(`SELECT id FROM jobs WHERE user_id = ? AND kind = ? AND params = ?
		AND state IN ('queued', 'running') ORDER BY id LIMIT 1`, owner.UserID, kind, params).Scan(&dup)
	switch {
	case err == nil:
		return 0, &ErrDuplicate{ID: dup}
	case !errors.Is(err, sql.ErrNoRows):
		return 0, err
	}
	var n int
	if err := tx.QueryRow(`SELECT count(*) FROM jobs WHERE user_id = ? AND state IN ('queued', 'running')`,
		owner.UserID).Scan(&n); err != nil {
		return 0, err
	}
	if n >= r.opts.PerOwner {
		return 0, ErrLimit
	}
	res, err := tx.Exec(`INSERT INTO jobs (user_id, username, kind, queued, subject, state, params, total,
		                                   rerun_of, from_job, created_at)
		VALUES (?, ?, ?, 1, ?, 'queued', ?, ?, ?, ?, ?)`,
		owner.UserID, owner.Username, kind, subject, params, max(total, 0),
		nullID(rerunOf), nullID(fromJobOf(params)), time.Now().UnixMilli())
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, tx.Commit()
}

// canonicalParams is params as JSON with its keys sorted and no spaces, so two
// presses that mean the same job store the same text and the duplicate check can
// compare them. A json.RawMessage (a rerun's stored params) goes through the same
// round trip.
func canonicalParams(params any) (string, error) {
	var raw []byte
	switch p := params.(type) {
	case nil:
		return "{}", nil
	case json.RawMessage:
		raw = p
	default:
		b, err := json.Marshal(p)
		if err != nil {
			return "", err
		}
		raw = b
	}
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return "", err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// fromJobOf is params' from_job, when it is a positive whole number.
func fromJobOf(params string) int64 {
	var p struct {
		FromJob json.Number `json:"from_job"`
	}
	if json.Unmarshal([]byte(params), &p) != nil {
		return 0
	}
	n, err := p.FromJob.Int64()
	if err != nil || n <= 0 {
		return 0
	}
	return n
}

func nullID(id int64) any {
	if id <= 0 {
		return nil
	}
	return id
}

// kickLocked tells the worker there may be work, starting one if none is alive
// and nothing holds it off.
func (r *Runner) kickLocked() {
	r.pending = true
	if r.alive || r.closed || r.exclusive > 0 {
		return
	}
	r.alive = true
	r.idle = make(chan struct{})
	go r.work(r.idle)
}

// isClosed is whether shutdown has begun: a claim still retrying against a locked
// database stops trying then, since Close interrupts whatever waits.
func (r *Runner) isClosed() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.closed
}

// work is the worker: claim, run, repeat, and exit when there is nothing to claim.
func (r *Runner) work(idle chan struct{}) {
	defer close(idle)
	for {
		r.mu.Lock()
		if r.closed || r.exclusive > 0 || holding() {
			r.alive = false
			r.mu.Unlock()
			return
		}
		r.pending = false
		r.claiming = true
		r.claimEnded = make(chan struct{})
		r.mu.Unlock()

		var j *Job
		err := busyRetry(busyAttempts, busyBackoff, busyCeiling, r.isClosed, func() error {
			var err error
			j, err = r.claim()
			return err
		})
		if r.afterClaim != nil {
			r.afterClaim(j != nil)
		}

		r.mu.Lock()
		r.claiming = false
		close(r.claimEnded)
		stop := j != nil && r.claimStop[j.id]
		clear(r.claimStop)
		if err != nil {
			// A lock held through every retry, or a write that cannot work. The
			// worker goes, rather than spin on a database that is refusing it;
			// the job stays queued, and the next Enqueue — even one refused as
			// the same job — or the end of an Exclusive starts a worker for it.
			olog.Errorf(olog.CodeJobRecord, "[jobs] claiming the next job: %v", err)
		}
		if j == nil {
			if err == nil && r.pending {
				r.mu.Unlock()
				continue
			}
			r.alive = false
			r.mu.Unlock()
			return
		}
		if stop {
			j.stop.Store(true)
		}
		if r.closed {
			j.shutdown.Store(true) // claimed as Close began: it ends at once, interrupted
		}
		r.running = j
		r.mu.Unlock()

		r.run(j)

		r.mu.Lock()
		r.running = nil
		r.mu.Unlock()
	}
}

// claim marks the oldest waiting job running and returns it, or nil when none
// waits. One statement, so a Stop's compare-and-set on the same row either
// lands before it (and there is nothing to claim) or after it (and finds it
// running).
func (r *Runner) claim() (*Job, error) {
	// The generation is read with a claim in progress, which Exclusive waits out
	// before any swap, so it is the generation of the file the claim reads.
	j := &Job{r: r, started: time.Now(), gen: r.st.Generation()}
	var stopReq int
	err := r.st.DB.QueryRow(`UPDATE jobs SET state = 'running', started_at = ?
		WHERE id = (SELECT id FROM jobs WHERE state = 'queued' ORDER BY id LIMIT 1)
		RETURNING id, user_id, username, kind, subject, params, total, stop_requested`,
		j.started.UnixMilli()).
		Scan(&j.id, &j.uid, &j.username, &j.kind, &j.subject, &j.params, &j.total, &stopReq)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	j.stop.Store(stopReq != 0)
	return j, nil
}

// run runs one claimed job to its end and records the end.
func (r *Runner) run(j *Job) {
	r.finish(j, r.execute(j))
}

var (
	errOwnerGone    = errors.New("the account that started this job is gone")
	errNoLongerKind = errors.New("this server no longer knows this kind of job")
	errNoLongerAdmn = errors.New("the account that started this job is no longer an admin")
)

// execute checks the owner and runs the kind, catching a panic.
//
// THE OWNER IS CHECKED BY ID ALONE, not by id and name as the spec first had
// it. A reader may rename themselves while their job waits, and the row keeps
// the name it was started under. The id is enough because insert checked the
// account by id and name in the transaction that added the row, and 0079's
// trigger sets user_id to NULL on every delete after that, in the same
// statement: a user_id still on the row names the account that queued it, never
// whoever is given that id next. A restore interrupts every waiting job as it
// carries them over, so no job from another generation is ever claimed.
func (r *Runner) execute(j *Job) (err error) {
	if !j.uid.Valid {
		return errOwnerGone
	}
	var name string
	var admin bool
	switch err := r.st.DB.QueryRow(`SELECT username, is_admin FROM users WHERE id = ?`, j.uid.Int64).
		Scan(&name, &admin); {
	case errors.Is(err, sql.ErrNoRows):
		return errOwnerGone
	case err != nil:
		return fmt.Errorf("reading the account that started this job: %w", err)
	}
	j.owner = Owner{UserID: j.uid.Int64, Username: name, IsAdmin: admin, Gen: j.gen}
	k, ok := r.kind(j.kind)
	if !ok {
		return errNoLongerKind
	}
	if k.AdminOnly && !admin {
		return errNoLongerAdmn
	}
	defer func() {
		if p := recover(); p != nil {
			// The stack goes to the server's log with the code; the job's own
			// error says only where to look.
			olog.Errorf(olog.CodeJobPanic, "[jobs] #%d %s panicked: %v\n%s", j.id, j.kind, p, debug.Stack())
			err = fmt.Errorf("the job stopped on an internal error (%s)", olog.CodeJobPanic)
		}
	}()
	return k.Run(WithRecorder(r.base, j), j)
}

// finish records how a job ended. Its last line is logged and flushed first, so
// a screen that sees the job finished finds its whole log already there. A job
// Close gave up on was already marked interrupted, with its line; nothing more is
// written for it but the stdout line.
//
// The finishing write waits out a held lock (busyRetry), and stops waiting if
// Close gives up on the job meanwhile, since that already wrote its end. A write
// that fails even so leaves the row reading running with nothing to end it; the
// server's line then says the end was not recorded, rather than naming a state
// the record does not hold, and Stop settles the row (settleOrphan).
func (r *Runner) finish(j *Job, runErr error) {
	state, errText, last, lvl := StateSucceeded, "", "", LevelInfo
	switch {
	case runErr != nil && !(j.Stopping() && errors.Is(runErr, context.Canceled)):
		state, errText = StateFailed, clean(LevelError, runErr.Error())
		last, lvl = "failed: "+errText, LevelError
	case j.stop.Load():
		state, last = StateStopped, "stopped"
	case j.shutdown.Load():
		// Nobody pressed Stop: the server stopped under it.
		state, last, lvl = StateInterrupted, "the server stopped while this job was running", LevelWarn
	}
	done, total := j.final()
	var recErr error
	if j.abandoned.Load() {
		state = StateInterrupted
	} else {
		if last != "" {
			j.Log(lvl, "%s", last)
		}
		ctx, cancel := context.WithTimeout(context.Background(), r.opts.FlushWait)
		r.lb.Flush(ctx)
		cancel()
		recErr = busyRetry(busyAttempts, busyBackoff, busyCeiling, j.abandoned.Load, func() error {
			_, err := r.st.DB.Exec(`UPDATE jobs SET state = ?, error = ?, done = ?, total = ?, finished_at = ?
				WHERE id = ? AND state = 'running'`,
				state, errText, done, total, time.Now().UnixMilli(), j.id)
			return err
		})
	}
	r.forget(j.id)

	who := j.owner.Username
	if who == "" {
		who = j.username
	}
	dur := took(time.Since(j.started))
	if recErr != nil {
		olog.Errorf(olog.CodeJobRecord, "[jobs] #%d %s for %s could not record its end (it %s in %s, %d/%d), so it reads running until Stop or a restart settles it: %v",
			j.id, j.kind, who, state, dur, done, total, recErr)
		return
	}
	line := fmt.Sprintf("[jobs] #%d %s for %s %s in %s (%d/%d)", j.id, j.kind, who, state, dur, done, total)
	if errText != "" {
		line += ": " + errText
	}
	olog.Printf("%s", line)
}

func took(d time.Duration) string {
	if d < time.Second {
		return d.Round(time.Millisecond).String()
	}
	return d.Round(time.Second).String()
}

// forget drops what the runner holds in memory for a job that has ended.
func (r *Runner) forget(ids ...int64) {
	r.smu.Lock()
	defer r.smu.Unlock()
	for _, id := range ids {
		delete(r.secrets, id)
	}
}

// visible says whether viewer may see (and so stop) a job owned by uid: their own,
// or anyone's for an admin. Another reader's job does not exist for them (404).
func visible(viewer Owner, uid sql.NullInt64) bool {
	return viewer.IsAdmin || (uid.Valid && uid.Int64 == viewer.UserID)
}

// Stop stops a job: at once if it is still waiting, after the item in hand if it
// is running. A job that has already ended is left as it ended. A job the viewer
// may not see is ErrNotFound.
//
// Compare-and-set, so it cannot lose a race with the worker's claim: the waiting
// row is stopped only if it is still waiting, and a job the claim got to first is
// asked to stop in memory as well as in its row, where the worker, claiming or
// running it, will see it. A row that reads running with no job in the worker's
// hands is one whose end was never recorded, and it is settled (settleOrphan);
// stopHeldLocked says which is which.
func (r *Runner) Stop(id int64, viewer Owner) error {
	if viewer.Gen != r.st.Generation() {
		return ErrStale
	}
	var uid sql.NullInt64
	switch err := r.st.DB.QueryRow(`SELECT user_id FROM jobs WHERE id = ?`, id).Scan(&uid); {
	case errors.Is(err, sql.ErrNoRows):
		return ErrNotFound
	case err != nil:
		return err
	}
	if !visible(viewer, uid) {
		return ErrNotFound
	}
	res, err := r.st.DB.Exec(`UPDATE jobs SET state = 'stopped', finished_at = ? WHERE id = ? AND state = 'queued'`,
		time.Now().UnixMilli(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		r.forget(id)
		r.lb.jobLineIn(viewer.Gen, id, LevelInfo, fmt.Sprintf("%s stopped it before it started", viewer.Username))
		return nil
	}
	r.mu.Lock()
	held, fresh := r.stopHeldLocked(id)
	r.mu.Unlock()
	if !held {
		_, err := r.settleOrphan(viewer.Gen, id, fmt.Sprintf("its end was never recorded; %s stopped it, and it is marked interrupted", viewer.Username))
		return err
	}
	res, err = r.st.DB.Exec(`UPDATE jobs SET stop_requested = 1 WHERE id = ? AND state = 'running'`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 1 && fresh {
		r.lb.jobLineIn(viewer.Gen, id, LevelInfo, fmt.Sprintf("%s asked it to stop; it stops after the item in hand", viewer.Username))
	}
	return nil
}

// stopHeldLocked asks the job in the worker's hands to stop, if it is id, and
// reports whether it was (held) and whether the ask is news (fresh). A job the
// worker does not hold has ended, whatever its row says, and nothing is kept for
// it.
//
// A CLAIM IN PROGRESS IS WAITED OUT. Until it ends, the row the claim took reads
// running while the worker has not yet said which job it holds, so a running row
// cannot be told from one left running by a failed finishing write — and taking
// the one for the other would either leave that one running for good or mark the
// job just claimed interrupted as it starts. So the ask goes in claimStop, where
// the worker applies it before the job's first item if the claim took id, and
// the answer waits for the claim, which is one statement. Called and returning
// with r.mu held; it lets go of it while it waits.
func (r *Runner) stopHeldLocked(id int64) (held, fresh bool) {
	for r.claiming {
		if !r.claimStop[id] {
			r.claimStop[id] = true
			fresh = true
		}
		ended := r.claimEnded
		r.mu.Unlock()
		<-ended
		r.mu.Lock()
	}
	if j := r.running; j != nil && j.id == id {
		news := !j.stop.Swap(true)
		return true, fresh || news
	}
	return false, false
}

// settleOrphan ends a row that reads running although no job is in the worker's
// hands: a job whose finishing write failed past every retry (finish says so on
// stderr). Nothing would ever write its end, and until something does it counts
// toward its owner's five, blocks the same job being started again and stands in
// every waiting job's count ahead — so Stop settles it, as interrupted, as a
// restart would have. The caller has seen that the worker does not hold it, with
// no claim in progress (stopHeldLocked); it cannot come to hold it afterwards,
// because a claim takes only a waiting row, and the compare-and-set leaves a row
// that has since ended alone. It reports whether it settled the row.
func (r *Runner) settleOrphan(gen uint64, id int64, line string) (bool, error) {
	res, err := r.st.DB.Exec(`UPDATE jobs SET state = 'interrupted', finished_at = ? WHERE id = ? AND state = 'running'`,
		time.Now().UnixMilli(), id)
	if err != nil {
		return false, err
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return false, nil
	}
	r.forget(id)
	r.lb.jobLineIn(gen, id, LevelWarn, line)
	return true, nil
}

// StopAll stops every job the viewer can see: their own, or everyone's for an
// admin (the confirm says so). Waiting jobs are stopped at once; the running one
// is asked to stop after the item in hand. It says how many of each. A row left
// reading running whose end was never recorded is settled at once and counted
// with the waiting ones: like them, it has ended by the time this returns.
func (r *Runner) StopAll(viewer Owner) (stopping, stoppedWaiting int, err error) {
	if viewer.Gen != r.st.Generation() {
		return 0, 0, ErrStale
	}
	scope, args := "", []any{}
	if !viewer.IsAdmin {
		scope, args = " AND user_id = ?", []any{viewer.UserID}
	}
	return r.stopWhere(viewer.Gen, scope, args,
		fmt.Sprintf("%s stopped it before it started", viewer.Username),
		fmt.Sprintf("%s asked every job to stop; this one stops after the item in hand", viewer.Username),
		fmt.Sprintf("its end was never recorded; %s asked every job to stop, and it is marked interrupted", viewer.Username))
}

// StopOwner stops every job of an account that is about to be deleted: waiting
// ones at once, the running one after the item in hand.
func (r *Runner) StopOwner(uid int64) error {
	// Read before the statements that find the jobs: store.Generation says why.
	gen := r.st.Generation()
	_, _, err := r.stopWhere(gen, " AND user_id = ?", []any{uid},
		"stopped before it started: the account that started it is being deleted",
		"the account that started this job is being deleted; it stops after the item in hand",
		"its end was never recorded; the account that started it is being deleted, and it is marked interrupted")
	return err
}

// stopWhere stops the jobs scope picks. gen is the generation read before it, so
// its lines go only into the file its statements found the jobs in.
func (r *Runner) stopWhere(gen uint64, scope string, args []any, waitingLine, runningLine, orphanLine string) (stopping, stoppedWaiting int, err error) {
	waiting, err := r.ids(`UPDATE jobs SET state = 'stopped', finished_at = ? WHERE state = 'queued'`+scope+` RETURNING id`,
		append([]any{time.Now().UnixMilli()}, args...)...)
	if err != nil {
		return 0, 0, err
	}
	r.forget(waiting...)
	for _, id := range waiting {
		r.lb.jobLineIn(gen, id, LevelInfo, waitingLine)
	}
	stoppedWaiting = len(waiting)
	running, err := r.ids(`UPDATE jobs SET stop_requested = 1 WHERE state = 'running'`+scope+` RETURNING id`, args...)
	if err != nil {
		return 0, stoppedWaiting, err
	}
	for _, id := range running {
		r.mu.Lock()
		held, fresh := r.stopHeldLocked(id)
		r.mu.Unlock()
		switch {
		case !held:
			settled, err := r.settleOrphan(gen, id, orphanLine)
			if err != nil {
				return stopping, stoppedWaiting, err
			}
			if settled {
				stoppedWaiting++
			}
		case fresh:
			r.lb.jobLineIn(gen, id, LevelInfo, runningLine)
			stopping++
		default:
			stopping++
		}
	}
	return stopping, stoppedWaiting, nil
}

// ids runs a statement that returns job ids.
func (r *Runner) ids(q string, args ...any) ([]int64, error) {
	rows, err := r.st.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// Rerun queues a finished job again, for the viewer: same kind, subject, params
// and item count, a new id, and rerun_of pointing back. Only the job's own owner
// may (an admin sees other readers' jobs, and still may not run them again as
// themselves); anyone else gets ErrNotFound. A kind that is not Rerunnable, or a
// job that ran in its request, is ErrNotRerunnable. AdminOnly is checked against
// the viewer now, not as they were when it first ran. A kind that needs a secret
// (a backup's password) needs it again: nothing kept one.
func (r *Runner) Rerun(id int64, viewer Owner, secret any) (int64, error) {
	if viewer.Gen != r.st.Generation() {
		return 0, ErrStale
	}
	var uid sql.NullInt64
	var kind, subject, params string
	var total, queued int
	switch err := r.st.DB.QueryRow(`SELECT user_id, kind, subject, params, total, queued FROM jobs WHERE id = ?`, id).
		Scan(&uid, &kind, &subject, &params, &total, &queued); {
	case errors.Is(err, sql.ErrNoRows):
		return 0, ErrNotFound
	case err != nil:
		return 0, err
	}
	if !uid.Valid || uid.Int64 != viewer.UserID {
		return 0, ErrNotFound
	}
	if k, ok := r.kind(kind); !ok || !k.Rerunnable || queued == 0 {
		return 0, ErrNotRerunnable
	}
	return r.enqueue(viewer, kind, subject, json.RawMessage(params), total, secret, id)
}

// Boot settles what the previous run of the server left: every job still waiting
// or running is interrupted, with a line saying so. Nothing resumes on its own —
// a person reruns it. serve() calls it once, after the store is open; the CLI
// commands that open the store beside a live server never do, or they would
// interrupt that server's running job.
func (r *Runner) Boot() error {
	gen := r.st.Generation()
	rows, err := r.st.DB.Query(`UPDATE jobs SET state = 'interrupted', finished_at = ?
		WHERE state IN ('queued', 'running') RETURNING id, started_at IS NOT NULL`, time.Now().UnixMilli())
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var wasRunning bool
		if err := rows.Scan(&id, &wasRunning); err != nil {
			return err
		}
		line := "the server restarted while this job was waiting"
		if wasRunning {
			line = "the server restarted while this job was running"
		}
		r.lb.jobLineIn(gen, id, LevelWarn, line)
	}
	return rows.Err()
}

// Close is the queue's part of shutdown. It refuses new jobs, asks the running
// one to stop after the item in hand, and waits for it until ctx ends. Then it
// cancels the runner's context, so the job's outbound calls abort, and waits
// Options.CancelWait more. A job still not back is marked interrupted there and
// then (its goroutine is left to finish on its own; its end is not recorded over
// that). Every waiting job is interrupted. A job ended by shutdown is interrupted,
// not stopped: nobody pressed Stop.
func (r *Runner) Close(ctx context.Context) error {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return nil
	}
	r.closed = true
	if j := r.running; j != nil {
		j.shutdown.Store(true)
	}
	idle := r.idle
	r.mu.Unlock()

	var errs []error
	select {
	case <-idle:
	case <-ctx.Done():
		r.cancel()
		t := time.NewTimer(r.opts.CancelWait)
		select {
		case <-idle:
		case <-t.C:
			errs = append(errs, r.abandon())
		}
		t.Stop()
	}
	r.cancel()

	gen := r.st.Generation()
	waiting, err := r.ids(`UPDATE jobs SET state = 'interrupted', finished_at = ? WHERE state = 'queued' RETURNING id`,
		time.Now().UnixMilli())
	errs = append(errs, err)
	r.forget(waiting...)
	for _, id := range waiting {
		r.lb.jobLineIn(gen, id, LevelWarn, "the server stopped before this job started")
	}
	return errors.Join(errs...)
}

// abandon marks the job still in the worker's hands interrupted, when shutdown
// can wait for it no longer.
func (r *Runner) abandon() error {
	r.mu.Lock()
	j := r.running
	r.mu.Unlock()
	if j == nil {
		return nil
	}
	j.abandoned.Store(true)
	r.forget(j.id)
	j.Log(LevelWarn, "the server stopped while this job was running, and could not wait for the item in hand")
	done, total := j.final()
	_, err := r.st.DB.Exec(`UPDATE jobs SET state = 'interrupted', done = ?, total = ?, finished_at = ?
		WHERE id = ? AND state = 'running'`, done, total, time.Now().UnixMilli(), j.id)
	return err
}

// Exclusive runs fn with the queue held: a restore, a factory reset, a reindex or
// an update, each of which swaps or rewrites the database under whatever is
// running. It refuses with ErrBusy while a job runs or is being claimed; while fn
// runs, the worker claims nothing and Enqueue answers ErrBusy. Afterwards it lets
// go of the secrets of jobs fn ended (a restore interrupts every waiting job) and
// starts the worker if anything is waiting.
func (r *Runner) Exclusive(fn func() error) error {
	r.mu.Lock()
	switch {
	case r.closed:
		r.mu.Unlock()
		return ErrClosed
	case r.running != nil || r.claiming:
		r.mu.Unlock()
		return ErrBusy
	}
	r.exclusive++
	r.mu.Unlock()
	defer func() {
		r.forgetEnded()
		r.mu.Lock()
		r.exclusive--
		if r.exclusive == 0 {
			r.kickLocked()
		}
		r.mu.Unlock()
	}()
	return fn()
}

// forgetEnded drops the secrets of jobs that are no longer waiting or running in
// the database the server is now on, whatever ended them.
func (r *Runner) forgetEnded() {
	r.smu.Lock()
	held := make([]int64, 0, len(r.secrets))
	for id := range r.secrets {
		held = append(held, id)
	}
	r.smu.Unlock()
	var ended []int64
	for _, id := range held {
		var n int
		err := r.st.DB.QueryRow(`SELECT count(*) FROM jobs WHERE id = ? AND state IN ('queued', 'running')`, id).Scan(&n)
		if err == nil && n == 0 {
			ended = append(ended, id)
		}
	}
	r.forget(ended...)
}

// Ahead is how many jobs, anybody's, are waiting or running ahead of job id: the
// "2 jobs ahead" a waiting job shows. A number and not rows, so it tells a reader
// nothing about whose they are.
func (r *Runner) Ahead(id int64) (int, error) {
	var n int
	err := r.st.DB.QueryRow(`SELECT count(*) FROM jobs WHERE state IN ('queued', 'running') AND id < ?`, id).Scan(&n)
	return n, err
}
