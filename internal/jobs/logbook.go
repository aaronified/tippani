package jobs

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"runtime/debug"
	"sync"
	"time"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// The levels a line may carry. Open-ended vocabularies are validated here and not
// in a CHECK (0079 says why); a level nobody knows becomes info rather than
// refusing the line, because a log that drops what it cannot classify loses
// exactly the lines nobody expected.
const (
	LevelError   = "error"
	LevelWarn    = "warn"
	LevelInfo    = "info"
	LevelRequest = "request" // one per request, from the request logger
	LevelAsset   = "asset"   // a request for a file (a cover, a font, the SPA), hidden by default
	LevelTrace   = "trace"
)

var systemLevels = map[string]bool{
	LevelError: true, LevelWarn: true, LevelInfo: true,
	LevelRequest: true, LevelAsset: true, LevelTrace: true,
}

// A job's own lines say what it did and what went wrong; request and file lines
// belong to the system log.
var jobLevels = map[string]bool{LevelError: true, LevelWarn: true, LevelInfo: true}

func level(l string, known map[string]bool) string {
	if known[l] {
		return l
	}
	return LevelInfo
}

// THE BOUNDS, AND WHAT GOES FIRST WHEN THEY ARE REACHED. The buffer is what sits
// between a line being logged and its batch landing; it is only ever large when
// the database is slower than the lines, and then something has to give. What
// gives first is what matters least and arrives most: file and request lines, and
// traces. Then the ordinary info lines. A job's lines, an in-request job's row,
// and every warning and error are kept until nothing but them fills the buffer —
// and past that the newcomer is dropped, counted, and the next batch says how
// many went (TIP-LOG-003).
const (
	maxBufferBytes = 8 << 20
	maxBufferUnits = 16384
	// batchUnits is one transaction's worth. A batch holds SQLite's write lock
	// for as long as it takes, so it is sized to be short next to a reader's
	// save, not to be efficient.
	batchUnits = 500
	// entryOverhead is what an entry costs beyond its text, so a flood of empty
	// lines is still bounded by bytes.
	entryOverhead = 64
	// pruneEveryBatches is how many batches the drainer writes between prune
	// chunks while there is always another batch waiting.
	pruneEveryBatches = 4
)

// Drop classes, lowest dropped first.
const (
	classLow  = iota // system request, asset and trace lines
	classMid         // system info lines
	classHigh        // job lines, in-request rows, system warnings and errors
	classes
)

// BUSY, AND ONLY BUSY, IS RETRIED (busyRetry). Past the last attempt the batch is
// dropped and counted: a log that blocks the app while it waits would be worse
// than a log with a gap it admits to.
//
// THE PRUNE: thirty days, in chunks, with no timer. It runs when the drainer has
// just written and the last prune is over an hour old, and when PruneSoon is
// called (the Jobs tab opening). Each chunk is its own short transaction, run
// whenever the drainer has nothing to write and after every pruneEveryBatches
// batches besides: a prune of a month of request lines never holds the lock for
// longer than one chunk, and lines arriving faster than they are written — the
// flood the drop order is for, when the buffer is never empty — never starve it.
//
// Both sets of numbers live on the Logbook rather than in package variables, so
// the one test that shrinks the ceiling changes its own logbook and no other.
type tuning struct {
	busyBackoff, busyCeiling time.Duration
	busyAttempts             int
	retention, pruneEvery    time.Duration
	pruneChunk               int
	systemCeiling            int // system_logs rows past this lose their oldest
	// beforeWrite runs before every batch is written. A test seam and nothing
	// else: the one way to make the drainer panic mid-batch, which no input can.
	beforeWrite func()
}

func defaultTuning() tuning {
	return tuning{
		busyBackoff: busyBackoff, busyCeiling: busyCeiling, busyAttempts: busyAttempts,
		retention: 30 * 24 * time.Hour, pruneEvery: time.Hour,
		pruneChunk: 2000, systemCeiling: 1_000_000,
		beforeWrite: func() {},
	}
}

// stderr is where the logbook's own failures go. Never through olog: once the
// olog sink feeds the logbook, a drainer that logged its failure through olog
// would be writing into the log that just failed, and a failing database would
// feed itself one line per failure.
var stderr = log.New(os.Stderr, "", log.LstdFlags)

// Row is an in-request job's row, handed to the logbook whole when its request
// ends: the request did its work without a database write for its log, and the
// row and its lines land together in one transaction.
type Row struct {
	UserID   int64  // 0: no account (an unauthenticated route); stored as NULL
	Username string // the account's name when the request ran
	// Gen is the store generation UserID was read under. If the store has swapped
	// files since, the id may be somebody else's in the file the row lands in, so
	// the row is written with no owner.
	Gen      uint64
	Kind     string
	Subject  string
	State    string // succeeded or failed
	Error    string
	Created  time.Time
	Finished time.Time
}

// Line is one line of an in-request job's log.
type Line struct {
	At    time.Time
	Level string
	Text  string
}

type entryKind int

const (
	entrySystem entryKind = iota
	entryJob
	entryInRequest
)

// entry is one thing waiting to be written, already through the door.
type entry struct {
	kind  entryKind
	at    int64 // unix ms
	level string
	code  string
	text  string
	jobID int64
	// gen is, for a job's line, the store generation its job id was read under,
	// and genKnown whether that is known yet: a line logged before Attach is
	// stamped there. The drainer writes a job's line only into that generation's
	// file, where the id still means that job.
	gen      uint64
	genKnown bool
	row      Row
	// account is an in-request row's username as the request resolved it, before
	// the door cleaned it for keeping: the name the account check matches on.
	account string
	lines   []Line
	class   int
	size    int    // bytes against maxBufferBytes
	units   int    // entries against maxBufferUnits: one, or one per line plus the row
	seq     uint64 // arrival order, for Flush
	gone    bool   // evicted to make room; skipped by the drainer
}

// Logbook is the asynchronous, batched writer onto the store's log connection.
// It is made before the store is open, so the boot, migration and integrity lines
// are kept too: until Attach it only buffers.
//
// Nothing that logs waits on it. System, JobLine and InRequest take a mutex for
// the time it takes to append to a slice and return; the drainer does the
// writing, on its own goroutine, and only while there is something to write.
type Logbook struct {
	mu sync.Mutex
	st *store.Store

	buf        []*entry // FIFO; buf[head:] is waiting, gone entries included
	head       int
	goneN      int // gone entries in buf[head:], which compactLocked clears out
	bytes      int
	units      int
	classCount [classes]int
	seq        uint64

	// alive says a drainer goroutine exists. It is read and written under mu,
	// the same lock the buffer is under, and that is the whole of the
	// lost-wakeup guard: a drainer that finds the buffer empty clears alive and
	// exits in one critical section, so a line added a moment later either
	// lands before that section (and the drainer sees it) or after it (and sees
	// alive false, and starts a new drainer).
	alive bool

	inFlight    bool   // the drainer holds a batch it has not finished with
	inFlightMin uint64 // the oldest seq in that batch
	inFlightN   int    // its lines, counted as not kept if it is lost
	// The counts the batch's notes report. A batch that is lost puts them back,
	// so the next one still says what went.
	inFlightOverflow, inFlightFailed int

	overflow int // lines dropped for want of room, not yet reported
	failed   int // lines lost to a failed write, not yet reported

	// changed is closed and replaced whenever a batch finishes or an eviction
	// could have settled a Flush, which is what Flush waits on.
	changed chan struct{}

	lastPrune   time.Time
	pruneWanted bool
	sincePrune  int       // batches written since the last prune chunk, up to pruneEveryBatches
	prune       *pruneRun // the prune in progress, if any

	closed bool
	tune   tuning
}

// NewLogbook makes a logbook with no store: it buffers until Attach.
func NewLogbook() *Logbook {
	return &Logbook{changed: make(chan struct{}), tune: defaultTuning()}
}

// Attach gives the logbook its store, once the log tables exist, and starts
// writing what was buffered before it.
func (lb *Logbook) Attach(st *store.Store) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.st = st
	for _, e := range lb.buf[lb.head:] {
		lb.stampLocked(e)
	}
	lb.kickLocked()
}

// stampLocked gives a job's line with no generation yet the store's current one.
func (lb *Logbook) stampLocked(e *entry) {
	if e.kind == entryJob && !e.genKnown && lb.st != nil {
		e.gen, e.genKnown = lb.st.Generation(), true
	}
}

// System keeps one line of the app's own log. code is a TIP code when the line
// carries one, else "".
func (lb *Logbook) System(lvl, code, line string) {
	lvl = level(lvl, systemLevels)
	if !codeShape.MatchString(code) {
		code = ""
	}
	text := clean(lvl, line)
	class := classHigh
	switch lvl {
	case LevelRequest, LevelAsset, LevelTrace:
		class = classLow
	case LevelInfo:
		class = classMid
	}
	lb.add(&entry{
		kind: entrySystem, at: time.Now().UnixMilli(), level: lvl, code: code, text: text,
		class: class, size: len(text) + len(code) + entryOverhead, units: 1,
	})
}

// JobLine keeps one line of a queued job's log, for the job with that id in the
// database the server is on as it is called. A line for a job that database
// does not hold (pruned) is skipped when its batch is written, never failing the
// batch; so is a line whose database has been swapped for another since it was
// logged (a restore, a recovery, a factory reset), where the id may name another
// job: a reset's fresh file numbers its jobs from 1 again.
func (lb *Logbook) JobLine(jobID int64, lvl, line string) {
	lb.jobLine(jobID, lvl, line, 0, false)
}

// jobLineIn is JobLine for a job id read from generation gen's file. The runner's
// own lines use it: each knows which file it read its job's id from, which the
// moment the line is logged cannot say, since a swap can finish in between.
func (lb *Logbook) jobLineIn(gen uint64, jobID int64, lvl, line string) {
	lb.jobLine(jobID, lvl, line, gen, true)
}

func (lb *Logbook) jobLine(jobID int64, lvl, line string, gen uint64, genKnown bool) {
	lvl = level(lvl, jobLevels)
	text := clean(lvl, line)
	lb.add(&entry{
		kind: entryJob, at: time.Now().UnixMilli(), level: lvl, text: text, jobID: jobID,
		gen: gen, genKnown: genKnown,
		class: classHigh, size: len(text) + entryOverhead, units: 1,
	})
}

// InRequest keeps an in-request job: its row and its lines, written together.
func (lb *Logbook) InRequest(row Row, lines []Line) {
	account := row.Username
	row.Kind = kindOrRequest(row.Kind)
	row.Subject = cleanSubject(row.Subject)
	row.Username = cleanSubject(row.Username)
	if row.State != StateSucceeded {
		row.State = StateFailed
	}
	row.Error = clean(LevelError, row.Error)
	size := len(row.Subject) + len(row.Error) + len(row.Username) + entryOverhead
	kept := make([]Line, len(lines))
	for i, l := range lines {
		l.Level = level(l.Level, jobLevels)
		l.Text = clean(l.Level, l.Text)
		kept[i] = l
		size += len(l.Text) + entryOverhead
	}
	lb.add(&entry{
		kind: entryInRequest, at: row.Finished.UnixMilli(), row: row, account: account, lines: kept,
		class: classHigh, size: size, units: 1 + len(kept),
	})
}

// PruneSoon asks for a prune now rather than at the next hourly chance: the Jobs
// tab calls it when it opens, which is when a reader is about to look at what the
// thirty days hold. It returns at once; the drainer does the work.
func (lb *Logbook) PruneSoon() {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.pruneWanted = true
	lb.kickLocked()
}

// Flush waits until every line logged before it was called has been written (or
// counted as not kept), or until ctx ends, whichever is first. The job runner
// calls it before a job's finishing write, so a job's last lines are in the
// database before its state says it finished; the API calls it briefly before a
// read, so a poll sees what was logged just before it.
//
// It waits for the lines already logged, not for the buffer to be empty: under a
// steady stream of request lines the buffer is never empty, and a flush that
// waited for that would never return.
func (lb *Logbook) Flush(ctx context.Context) error {
	lb.mu.Lock()
	target := lb.seq
	for !lb.settledLocked(target) {
		ch := lb.changed
		lb.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return ctx.Err()
		}
		lb.mu.Lock()
	}
	lb.mu.Unlock()
	return nil
}

// Close flushes (bounded by ctx) and then stops keeping lines: anything logged
// afterwards goes to stdout and stderr only, and whatever the flush did not get
// to is let go, so a Flush after Close returns at once. Shutdown calls it before
// closing the store, so the last lines land and nothing afterwards finds a
// closed pool.
func (lb *Logbook) Close(ctx context.Context) error {
	err := lb.Flush(ctx)
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.closed = true
	lb.st = nil
	clear(lb.buf)
	lb.buf, lb.head, lb.goneN, lb.bytes, lb.units, lb.classCount = nil, 0, 0, 0, 0, [classes]int{}
	lb.pruneWanted, lb.prune = false, nil
	lb.signalLocked()
	return err
}

func (lb *Logbook) isClosed() bool {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	return lb.closed
}

// settledLocked reports whether every entry up to seq target is written or gone.
func (lb *Logbook) settledLocked(target uint64) bool {
	if lb.inFlight && lb.inFlightMin <= target {
		return false
	}
	for i := lb.head; i < len(lb.buf); i++ {
		if e := lb.buf[i]; !e.gone {
			return e.seq > target
		}
	}
	return true
}

func (lb *Logbook) signalLocked() {
	close(lb.changed)
	lb.changed = make(chan struct{})
}

// add buffers e, making room by the drop order when the buffer is full.
func (lb *Logbook) add(e *entry) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	if lb.closed {
		return
	}
	lb.stampLocked(e)
	for lb.bytes+e.size > maxBufferBytes || lb.units+e.units > maxBufferUnits {
		victim := lb.oldestBelowLocked(e.class)
		if victim == nil {
			lb.overflow += e.lineCount()
			return
		}
		lb.evictLocked(victim)
	}
	lb.seq++
	e.seq = lb.seq
	lb.buf = append(lb.buf, e)
	lb.bytes += e.size
	lb.units += e.units
	lb.classCount[e.class]++
	lb.kickLocked()
}

// oldestBelowLocked is the entry to drop to make room for one of class c: the
// oldest of the lowest class present that is below c, or nil when there is none
// and the newcomer is the one to go.
func (lb *Logbook) oldestBelowLocked(c int) *entry {
	for cl := classLow; cl < c; cl++ {
		if lb.classCount[cl] == 0 {
			continue
		}
		for i := lb.head; i < len(lb.buf); i++ {
			if e := lb.buf[i]; !e.gone && e.class == cl {
				return e
			}
		}
	}
	return nil
}

// evictLocked drops e to make room. Its text goes at once, not when the drainer
// passes it: while the drainer is stalled (waiting out a held lock, or not yet
// attached) every line that evicts another would otherwise keep the one it
// evicted in memory, and the 8 MB would be counted but not held to. And once
// evicted entries are half of what is waiting, the buffer is compacted, so the
// husks do not pile up either.
func (lb *Logbook) evictLocked(e *entry) {
	lb.overflow += e.lineCount()
	e.gone = true
	e.text, e.lines, e.row, e.account = "", nil, Row{}, ""
	lb.bytes -= e.size
	lb.units -= e.units
	lb.classCount[e.class]--
	lb.goneN++
	if lb.goneN > (len(lb.buf)-lb.head)/2 {
		lb.compactLocked()
	}
	lb.signalLocked()
}

// compactLocked removes the gone entries from what is waiting, in order.
func (lb *Logbook) compactLocked() {
	n := 0
	for _, e := range lb.buf[lb.head:] {
		if !e.gone {
			lb.buf[n] = e
			n++
		}
	}
	clear(lb.buf[n:])
	lb.buf, lb.head, lb.goneN = lb.buf[:n], 0, 0
}

func (e *entry) lineCount() int {
	if e.kind == entryInRequest {
		return 1 + len(e.lines)
	}
	return 1
}

// kickLocked starts the drainer if there is work, a store to write it to, and
// no drainer already.
func (lb *Logbook) kickLocked() {
	if lb.alive || lb.st == nil || lb.closed {
		return
	}
	if lb.head == len(lb.buf) && !lb.pruneWanted && lb.prune == nil {
		return
	}
	lb.alive = true
	go lb.drain()
}

// takeLocked takes the next batch off the front of the buffer: up to batchUnits,
// and always at least one entry, so an in-request job with more lines than that
// still goes, whole, in a batch of its own.
func (lb *Logbook) takeLocked() []*entry {
	var batch []*entry
	units := 0
	for lb.head < len(lb.buf) {
		e := lb.buf[lb.head]
		if !e.gone {
			if len(batch) > 0 && units+e.units > batchUnits {
				break
			}
			batch = append(batch, e)
			units += e.units
			lb.bytes -= e.size
			lb.units -= e.units
			lb.classCount[e.class]--
		} else {
			lb.goneN--
		}
		lb.buf[lb.head] = nil
		lb.head++
	}
	// Reclaim the slice's front once it is mostly spent.
	if lb.head == len(lb.buf) {
		lb.buf, lb.head = lb.buf[:0], 0
	} else if lb.head > len(lb.buf)/2 {
		n := copy(lb.buf, lb.buf[lb.head:])
		clear(lb.buf[n:])
		lb.buf, lb.head = lb.buf[:n], 0
	}
	return batch
}

// drain is the drainer: it writes batches until there are none, running prune
// chunks when there is nothing to write, and exits. A panic is caught, reported
// on stderr with its code, and the drainer starts again clean if work is left.
func (lb *Logbook) drain() {
	defer func() {
		p := recover()
		if p == nil {
			return
		}
		stderr.Printf("[error] %s the log writer stopped on an internal error and restarted: %v\n%s",
			olog.CodeLogPanic, p, debug.Stack())
		lb.mu.Lock()
		defer lb.mu.Unlock()
		if lb.inFlight {
			lb.overflow += lb.inFlightOverflow
			lb.failed += lb.inFlightFailed + lb.inFlightN
			lb.inFlight = false
		}
		lb.prune = nil
		lb.alive = false
		lb.signalLocked()
		lb.kickLocked()
	}()
	for {
		lb.mu.Lock()
		st := lb.st
		if st == nil || lb.closed {
			lb.alive = false
			lb.signalLocked()
			lb.mu.Unlock()
			return
		}
		if lb.sincePrune >= pruneEveryBatches {
			if run := lb.nextPruneLocked(); run != nil {
				lb.sincePrune = 0
				lb.mu.Unlock()
				lb.pruneStep(st, run)
				continue
			}
		}
		batch := lb.takeLocked()
		if len(batch) == 0 {
			run := lb.nextPruneLocked()
			if run == nil {
				lb.alive = false
				lb.signalLocked()
				lb.mu.Unlock()
				return
			}
			lb.sincePrune = 0
			lb.mu.Unlock()
			lb.pruneStep(st, run)
			continue
		}
		lb.sincePrune = min(lb.sincePrune+1, pruneEveryBatches)
		lb.inFlight, lb.inFlightMin, lb.inFlightN = true, batch[0].seq, linesIn(batch)
		lb.inFlightOverflow, lb.inFlightFailed = lb.overflow, lb.failed
		lb.overflow, lb.failed = 0, 0
		reports := notes(lb.inFlightOverflow, lb.inFlightFailed)
		lb.mu.Unlock()

		lb.tune.beforeWrite()
		err := lb.retrying(st, func(db *sql.DB) error {
			return writeBatch(db, st.Generation(), reports, batch)
		})

		lb.mu.Lock()
		if err != nil {
			stderr.Printf("[error] %s %d log line(s) not kept: %v", olog.CodeLogWrite, lb.inFlightN, err)
			lb.overflow += lb.inFlightOverflow
			lb.failed += lb.inFlightFailed + lb.inFlightN
		} else if time.Since(lb.lastPrune) > lb.tune.pruneEvery {
			lb.pruneWanted = true
		}
		lb.inFlight = false
		lb.signalLocked()
		lb.mu.Unlock()
	}
}

func linesIn(batch []*entry) int {
	n := 0
	for _, e := range batch {
		n += e.lineCount()
	}
	return n
}

// notes are the system lines that report what was not kept since the last batch
// that landed. They ride in the next batch, never alone: a write that keeps
// failing must not spin writing notes about itself.
func notes(overflow, failed int) []*entry {
	var out []*entry
	t := time.Now().UnixMilli()
	if overflow > 0 {
		out = append(out, &entry{kind: entrySystem, at: t, level: LevelWarn, code: string(olog.CodeLogDropped),
			text: notKept(overflow) + " (the log was writing slower than lines arrived)"})
	}
	if failed > 0 {
		out = append(out, &entry{kind: entrySystem, at: t, level: LevelWarn, code: string(olog.CodeLogWrite),
			text: notKept(failed) + " (writing them failed; the server's error output says why)"})
	}
	return out
}

func notKept(n int) string {
	if n == 1 {
		return "1 log line was not kept"
	}
	return fmt.Sprintf("%d log lines were not kept", n)
}

// retrying runs one write through the log pool, retrying while SQLite answers
// busy. The swap lock is let go between attempts (each is its own LogWrite), so
// a restore waiting to start is not held up by a batch waiting on an import.
func (lb *Logbook) retrying(st *store.Store, write func(db *sql.DB) error) error {
	return busyRetry(lb.tune.busyAttempts, lb.tune.busyBackoff, lb.tune.busyCeiling, lb.isClosed,
		func() error { return st.LogWrite(write) })
}

// How a write that finds SQLite's write lock held is retried, by the logbook's
// drainer and by the runner's claim and finishing write alike. Every attempt
// already waits busy_timeout (5 s) for the lock inside SQLite; the pause between
// attempts (50 ms doubling to 2 s, six attempts, about half a minute in all) lets
// whoever holds it — a long import, a sqlite3 shell, slow storage — finish.
const (
	busyBackoff  = 50 * time.Millisecond
	busyCeiling  = 2 * time.Second
	busyAttempts = 6
)

// busyRetry runs write until it succeeds, fails with anything but SQLite's busy,
// has been tried attempts times, or giveUp says there is no longer any point. It
// is the only pause the drainer and the worker ever take, and they take it only
// while somebody else holds the lock.
func busyRetry(attempts int, backoff, ceiling time.Duration, giveUp func() bool, write func() error) error {
	wait := backoff
	for attempt := 1; ; attempt++ {
		err := write()
		if err == nil || !store.IsBusy(err) || attempt >= attempts || giveUp() {
			return err
		}
		time.Sleep(wait)
		wait = min(wait*2, ceiling)
	}
}

// writeBatch writes notes and batch in one transaction. It runs inside LogWrite,
// so no swap can happen while it does, and gen is the generation of the file it
// is writing into.
func writeBatch(db *sql.DB, gen uint64, notes, batch []*entry) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	sys, err := tx.Prepare(`INSERT INTO system_logs (at, level, code, line) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer sys.Close()
	// A line for a job the file does not hold is skipped, not refused: the
	// foreign key would fail the whole batch, everybody's lines with it.
	job, err := tx.Prepare(`INSERT INTO job_logs (job_id, at, level, line)
		SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM jobs WHERE id = ?)`)
	if err != nil {
		return err
	}
	defer job.Close()
	for _, e := range notes {
		if _, err := sys.Exec(e.at, e.level, e.code, e.text); err != nil {
			return fmt.Errorf("system line: %w", err)
		}
	}
	for _, e := range batch {
		switch e.kind {
		case entrySystem:
			if _, err := sys.Exec(e.at, e.level, e.code, e.text); err != nil {
				return fmt.Errorf("system line: %w", err)
			}
		case entryJob:
			if e.gen != gen {
				// Its id was read from a file this one replaced, where the same
				// id may be a different job, so it is not written at all.
				continue
			}
			if _, err := job.Exec(e.jobID, e.at, e.level, e.text, e.jobID); err != nil {
				return fmt.Errorf("job %d line: %w", e.jobID, err)
			}
		case entryInRequest:
			if err := writeInRequest(tx, gen, e); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// writeInRequest writes an in-request job's row and then its lines.
//
// The owner is the account only if it is still there under the same id and
// name as the row lands. The generation catches a swap; this catches a delete in
// the same file, which 0079's trigger cannot, since the row did not exist yet to
// be cleared — and the row can land well after its request authenticated (the
// work page's cast-art request may run for 45 s, and a drainer waiting out a
// held lock takes half a minute more). users.id is reused, so without it a
// deleted reader's lookup would land in the history of whoever is given their
// id next. A reader who renamed themselves mid-request loses that one row to
// the admin's view, which is the safe way to be wrong.
func writeInRequest(tx *sql.Tx, gen uint64, e *entry) error {
	r := e.row
	var uid any
	if r.UserID != 0 && r.Gen == gen {
		uid = r.UserID
	}
	res, err := tx.Exec(`INSERT INTO jobs (user_id, username, kind, queued, subject, state, error,
		                                   created_at, started_at, finished_at)
		VALUES ((SELECT id FROM users WHERE id = ? AND username = ?), ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
		uid, e.account, r.Username, r.Kind, r.Subject, r.State, r.Error,
		r.Created.UnixMilli(), r.Created.UnixMilli(), r.Finished.UnixMilli())
	if err != nil {
		return fmt.Errorf("in-request job: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	for _, l := range e.lines {
		if _, err := tx.Exec(`INSERT INTO job_logs (job_id, at, level, line) VALUES (?, ?, ?, ?)`,
			id, l.At.UnixMilli(), l.Level, l.Text); err != nil {
			return fmt.Errorf("in-request job line: %w", err)
		}
	}
	return nil
}
