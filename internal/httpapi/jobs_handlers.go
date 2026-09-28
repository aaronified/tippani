package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/olog"
)

// THE JOBS API — what Settings › Jobs, the phone's Jobs tile and every screen
// that starts a job read and press. The wire shapes are fixed (the SPA is built
// against them): a job is jobView, times are unix milliseconds or null, and a
// refusal is {error} with the fields its status adds.
//
// WHO SEES WHAT. A reader sees their own jobs and nobody else's: another
// reader's job is 404, never 403, as every other row in the app is. An admin
// sees everybody's, each with the name it was started under, and may stop any
// of them (an admin's Stop all stops every reader's jobs too, and the screen's
// confirm says so). Running a job again and reading what it found stay the
// owner's alone, even for an admin: a rerun is queued as whoever presses it, and
// a result is somebody's library.
//
// THE ROWS ARE READ ON THE LIBRARY POOL, like every other read. The queue writes
// a queued job's row there too, synchronously, so a job is in the table by the
// time POST /jobs answers; the logbook writes lines and in-request jobs in
// batches, so the reads that show a log — a job's poll, its Markdown export, the
// system log — wait up to 200 ms for what was logged before they asked
// (flushWait). The list of past jobs does not (handleListJobs says why).

// jobsBusyMessage is what a job refused by a restore, a reset, a search rebuild
// or an update in progress is told, and — the runner answers them alike — a job
// whose request began on a database a restore has since replaced.
const jobsBusyMessage = "A restore, a reset, a search rebuild or an update is running. Start this again when it has finished."

// viewer is who a jobs request is for, as the runner takes them: the account
// requireAuth resolved, and the store generation it read before resolving it.
func viewer(r *http.Request) jobs.Owner {
	gen, _ := r.Context().Value(ctxGen).(uint64)
	return jobs.Owner{UserID: userID(r), Username: username(r), IsAdmin: isAdmin(r), Gen: gen}
}

// flushWait gives the logbook up to 200 ms to write what was logged before this
// request asked, so a poll sees the line logged just before it and a job's own
// request's lines. Past the budget the read goes ahead with what is there.
func (s *Server) flushWait(r *http.Request) {
	if s.Logbook == nil {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 200*time.Millisecond)
	defer cancel()
	_ = s.Logbook.Flush(ctx)
}

// jobView is a job as the API answers it (the wire contract, D0).
type jobView struct {
	ID      int64  `json:"id"`
	Kind    string `json:"kind"`
	Queued  bool   `json:"queued"` // ran through the queue; false: ran in its request
	Subject string `json:"subject"`
	State   string `json:"state"`
	// Params are what the job was asked to do, less the lists it was given
	// (jobParamsShown). Nothing secret is ever in them.
	Params json.RawMessage `json:"params"`
	// Counts are what the job's kind counts of its result (queuedKind.counts),
	// never the result itself, which GET /jobs/{id}/result reads.
	Counts   json.RawMessage `json:"counts"`
	Error    string          `json:"error"`
	Total    int             `json:"total"`
	Done     int             `json:"done"`
	Ahead    int             `json:"ahead"`    // jobs anybody's, waiting or running ahead of this one
	Username string          `json:"username"` // "" unless the viewer is an admin
	Own      bool            `json:"own"`      // the viewer started it
	// Rerunnable says the viewer may run it again: their own, of a kind that
	// reruns, finished, and not a success that running again would only repeat.
	Rerunnable bool   `json:"rerunnable"`
	Applied    bool   `json:"applied"` // a re-verify whose review has been applied
	RerunOf    *int64 `json:"rerun_of"`
	FromJob    *int64 `json:"from_job"`
	CreatedAt  int64  `json:"created_at"`
	StartedAt  *int64 `json:"started_at"`
	FinishedAt *int64 `json:"finished_at"`
}

// jobRow is a jobs row as the API reads it.
type jobRow struct {
	id                                     int64
	uid                                    sql.NullInt64
	username, kind, subject, state, errMsg string
	queued                                 bool
	params, counts                         string
	total, done                            int
	rerunOf, fromJob                       sql.NullInt64
	created                                int64
	started, finished                      sql.NullInt64
}

// jobColumns is every column jobRow reads. result is not one of them: a
// re-verify's is every field of up to five hundred works, and the counts a list
// shows were made from it when the job stored it (0079 says why, and why result
// is the row's last column).
const jobColumns = `id, user_id, username, kind, queued, subject, state, ` + jobParamsShown + `, error, total, done,
	rerun_of, from_job, created_at, started_at, finished_at, counts`

// jobParamsShown is the params a job's JSON carries: the stored object without
// its top-level arrays.
//
// THE LISTS A JOB WAS GIVEN ARE NOT SHOWN, because they are what makes params
// large and nothing on a screen reads them. A five-hundred-item apply's params
// are its items — every field of every work, some four megabytes — and Current
// jobs is read every two seconds while anything runs, a job at a time for as
// many as are queued. What the screens read is the scalars (a re-verify's
// fills_only, a covers pass's missing_only), and the size of a list is the job's
// total. The stored params are untouched: the job reads them, and a rerun queues
// them again.
//
// DROPPED IN THE QUERY, NOT AFTER IT, so the lists never leave the database:
// read into Go first, four megabytes would be copied out of SQLite and decoded
// only to be thrown away, on every poll. A row whose params are not an object
// (a hand-made archive's) is read as it is, and rawObject decides what it shows.
// The CASE keeps true, false and null as JSON (json_each reads them as 1, 0 and
// NULL) and an object as an object (rather than as a string of one).
const jobParamsShown = `CASE WHEN NOT json_valid(params) THEN params
	WHEN json_type(params) <> 'object' THEN params
	ELSE (SELECT json_group_object(key, CASE type WHEN 'object' THEN json(value)
	        WHEN 'true' THEN json('true') WHEN 'false' THEN json('false') WHEN 'null' THEN json('null')
	        ELSE value END)
	      FROM json_each(params) WHERE type <> 'array') END`

func scanJob(sc interface{ Scan(...any) error }) (jobRow, error) {
	var j jobRow
	err := sc.Scan(&j.id, &j.uid, &j.username, &j.kind, &j.queued, &j.subject, &j.state, &j.params, &j.errMsg,
		&j.total, &j.done, &j.rerunOf, &j.fromJob, &j.created, &j.started, &j.finished, &j.counts)
	return j, err
}

// visibleTo is the SQL that limits jobs to what v may see, and its arguments.
func visibleTo(v jobs.Owner) (string, []any) {
	if v.IsAdmin {
		return "1 = 1", nil
	}
	return "user_id = ?", []any{v.UserID}
}

// ownedBy is whether v started the job. A user_id on a row always names the
// account that made it: 0079's trigger clears it on every delete, so a reused
// id never inherits somebody else's jobs.
func (j jobRow) ownedBy(v jobs.Owner) bool { return j.uid.Valid && j.uid.Int64 == v.UserID }

func finished(state string) bool { return state != jobs.StateQueued && state != jobs.StateRunning }

// visibleJob reads job id if v may see it. A job v may not see is not found.
func (s *Server) visibleJob(id int64, v jobs.Owner) (jobRow, bool, error) {
	scope, args := visibleTo(v)
	row, err := scanJob(s.Store.DB.QueryRow(`SELECT `+jobColumns+` FROM jobs WHERE id = ? AND `+scope,
		append([]any{id}, args...)...))
	if errors.Is(err, sql.ErrNoRows) {
		return jobRow{}, false, nil
	}
	return row, err == nil, err
}

// jobViews turns rows into what the API answers, for v. It reads, once for the
// lot, which jobs are waiting or running anywhere (for ahead) and which of these
// have been applied.
func (s *Server) jobViews(rows []jobRow, v jobs.Owner) ([]jobView, error) {
	active, err := s.activeJobIDs()
	if err != nil {
		return nil, err
	}
	applied, err := s.appliedChecks(rows)
	if err != nil {
		return nil, err
	}
	out := make([]jobView, 0, len(rows))
	for _, j := range rows {
		out = append(out, s.jobViewOf(j, v, active, applied))
	}
	return out, nil
}

func (s *Server) jobViewOf(j jobRow, v jobs.Owner, active []int64, applied map[int64]bool) jobView {
	own := j.ownedBy(v)
	view := jobView{
		ID: j.id, Kind: j.kind, Queued: j.queued, Subject: j.subject, State: j.state,
		Params: rawObject(j.params), Counts: rawObject(j.counts), Error: j.errMsg,
		Total: j.total, Done: j.done, Own: own, Applied: applied[j.id],
		RerunOf: nullInt(j.rerunOf), FromJob: nullInt(j.fromJob),
		CreatedAt: j.created, StartedAt: nullInt(j.started), FinishedAt: nullInt(j.finished),
	}
	if v.IsAdmin {
		view.Username = j.username
	}
	if !finished(j.state) {
		// A number, not rows: it says how long the wait is and nothing about
		// whose jobs make it up.
		view.Ahead, _ = slices.BinarySearch(active, j.id)
	}
	// An admin's kind asks the viewer as they are now: a former admin's own backup
	// is not offered a Rerun that would only answer 403 (absent, not disabled).
	if k, ok := s.startableKind(j.kind); ok && own && j.queued && k.rerunnable && finished(j.state) &&
		(!k.adminOnly || v.IsAdmin) {
		view.Rerunnable = j.state != jobs.StateSucceeded || k.againAfterSuccess
	}
	return view
}

// rawObject is a stored JSON object as the answer carries it: {} when the row
// holds nothing readable (a row that never passed the queue: a hand-made
// archive's).
func rawObject(s string) json.RawMessage {
	if s == "" || !json.Valid([]byte(s)) {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(s)
}

func nullInt(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	return &n.Int64
}

// activeJobIDs is every job waiting or running, anybody's, in order.
func (s *Server) activeJobIDs() ([]int64, error) {
	rows, err := s.Store.DB.Query(`SELECT id FROM jobs WHERE state IN ('queued', 'running') ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// appliedChecks is which of rows an apply names as the check it came from, and is
// applying or has applied: a re-verify's apply is the only job that names one
// (from_job, which only its validate accepts). Past jobs offers Review only for a
// check that is not applied.
//
// AN APPLY THAT WAITS, RUNS OR SUCCEEDED COUNTS; ONE THAT WAS STOPPED, FAILED OR
// WAS INTERRUPTED DOES NOT. Counting every apply that named the check took Review
// away from a check whose apply was stopped before it started, or failed before
// it wrote anything, though nothing had been applied. Offering Review again after
// one that ended part-way is safe: the review reads every field as it is now and
// marks what the apply wrote as changed (reviewReverify), so nothing it wrote is
// ticked a second time. A waiting apply counts, because Review then would only
// queue a second apply of the same check behind it.
func (s *Server) appliedChecks(rows []jobRow) (map[int64]bool, error) {
	var ids []any
	for _, j := range rows {
		ids = append(ids, j.id)
	}
	out := map[int64]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	q := `SELECT DISTINCT from_job FROM jobs WHERE from_job IN (` + placeholders(len(ids)) + `)
		AND state IN ('queued', 'running', 'succeeded')`
	res, err := s.Store.DB.Query(q, ids...)
	if err != nil {
		return nil, err
	}
	defer res.Close()
	for res.Next() {
		var id int64
		if err := res.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, res.Err()
}

// writeJob answers with job id as v sees it, under status.
func (s *Server) writeJob(w http.ResponseWriter, r *http.Request, status int, id int64, v jobs.Owner) {
	row, ok, err := s.visibleJob(id, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job", err)
		return
	}
	if !ok {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	views, err := s.jobViews([]jobRow{row}, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the queue", err)
		return
	}
	writeJSON(w, status, map[string]any{"job": views[0]})
}

// writeJobRefusal answers one of the runner's refusals with its status and body.
// Anything else is a failure of the server's own, and a 500.
func (s *Server) writeJobRefusal(w http.ResponseWriter, r *http.Request, err error) {
	var dup *jobs.ErrDuplicate
	switch {
	case errors.As(err, &dup):
		// The same press twice: the screen is told which job it already is, and
		// shows that one rather than a second.
		writeErrDetail(w, http.StatusConflict, "That job is already running or waiting.", map[string]any{"job_id": dup.ID})
	case errors.Is(err, jobs.ErrBusy), errors.Is(err, jobs.ErrStale):
		writeErrDetail(w, http.StatusConflict, jobsBusyMessage, map[string]any{"busy": true})
	case errors.Is(err, jobs.ErrLimit):
		limit := 0
		if s.Jobs != nil {
			limit = s.Jobs.PerOwner()
		}
		writeErrDetail(w, http.StatusTooManyRequests,
			fmt.Sprintf("You already have %d jobs running or waiting. Wait for one to finish, or stop one, then start this again.", limit),
			map[string]any{"limit": limit})
	case errors.Is(err, jobs.ErrAdminOnly):
		writeErr(w, http.StatusForbidden, "only an admin can start this kind of job")
	case errors.Is(err, jobs.ErrNotFound):
		writeErr(w, http.StatusNotFound, "no such job")
	case errors.Is(err, jobs.ErrNotRerunnable):
		writeErr(w, http.StatusConflict, "this job cannot be run again")
	case errors.Is(err, jobs.ErrUnknownKind):
		writeErr(w, http.StatusBadRequest, "no such kind of job")
	case errors.Is(err, jobs.ErrNoOwner):
		writeErr(w, http.StatusBadRequest, "your account changed while this job was being started; sign in again and start it again")
	case errors.Is(err, jobs.ErrClosed):
		writeErr(w, http.StatusServiceUnavailable, "the server is shutting down; start this again when it is back")
	default:
		codedError(w, r, olog.CodeJobRecord, "queue the job", err)
	}
}

// noQueue answers a request that needs the queue on a server that has none (a
// test server, the daily-deck command's): nothing can be started or stopped.
func noQueue(w http.ResponseWriter) {
	writeErr(w, http.StatusServiceUnavailable, "this server runs no jobs")
}

// handleStartJob: POST /jobs {kind, params} → 202 {job}. The kind's validate
// reads the params; the queue refuses with its reasons (writeJobRefusal).
func (s *Server) handleStartJob(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxJobBody)
	var req struct {
		Kind   string          `json:"kind"`
		Params json.RawMessage `json:"params"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if isMaxBytes(err) {
			writeErr(w, http.StatusRequestEntityTooLarge, "that job is too large to start in one go")
			return
		}
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	k, ok := s.startableKind(req.Kind)
	if !ok {
		writeErr(w, http.StatusBadRequest, "no such kind of job")
		return
	}
	v := viewer(r)
	// Before the params are read: a reader is not told what an admin's job
	// would have accepted, nor made to type the admin's password to learn it is
	// not theirs to start.
	if k.adminOnly && !v.IsAdmin {
		s.writeJobRefusal(w, r, jobs.ErrAdminOnly)
		return
	}
	in, err := k.validate(s, req.Params, v)
	if err != nil {
		if ref, ok := asRefusal(err); ok {
			writeErr(w, ref.status, ref.msg)
			return
		}
		codedError(w, r, olog.CodeJobRead, "check the job's params", err)
		return
	}
	id, err := s.Jobs.Enqueue(v, k.name, in.subject, in.params, in.total, in.secret)
	if err != nil {
		s.writeJobRefusal(w, r, err)
		return
	}
	s.writeJob(w, r, http.StatusAccepted, id, v)
}

// The page sizes GET /jobs answers with, and the retention its past view keeps
// to: a job older than thirty days is gone at the next prune, and the list says
// so now rather than when the prune lands.
const (
	jobsPageDefault = 50
	jobsPageMax     = 200
	jobsRetention   = 30 * 24 * time.Hour
)

var jobStates = map[string]bool{
	jobs.StateQueued: true, jobs.StateRunning: true, jobs.StateSucceeded: true,
	jobs.StateFailed: true, jobs.StateStopped: true, jobs.StateInterrupted: true,
}

// listParam is a comma-separated query value as its parts: "a,b" and a repeated
// name alike.
func listParam(vals []string) []string {
	var out []string
	for _, v := range vals {
		for _, p := range strings.Split(v, ",") {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
	}
	return out
}

// pageParams reads before (an id; 0 for the first page) and limit.
func pageParams(q map[string][]string, def, most int) (before int64, limit int, msg string) {
	limit = def
	if s := strings.TrimSpace(first(q["before"])); s != "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n < 0 {
			return 0, 0, "before must be an id"
		}
		before = n
	}
	if s := strings.TrimSpace(first(q["limit"])); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 {
			return 0, 0, "limit must be a positive number"
		}
		limit = min(n, most)
	}
	return before, limit, ""
}

func first(vals []string) string {
	if len(vals) == 0 {
		return ""
	}
	return vals[0]
}

// handleListJobs: GET /jobs?view=current|past&state=&kind=&before=&limit=&prune=1
// → {jobs, running, waiting, more}.
//
// current is the queue: jobs that ran through it and are waiting or running, in
// the order they run, ALL OF THEM, with more always false. past is every job that
// has ended — queued ones and the ones that ran in their request (a lookup, an
// import) — newest first, thirty days of them, a page at a time (before: the
// smallest id of the last page). running and waiting count the queue within what
// the viewer may see, whichever view.
//
// THE QUEUE IS NOT PAGED because its pages could not be followed: it runs oldest
// first, and before means "ids below this one", which is the page before, not the
// next. A queue cut at its limit answered more, and the next page was empty while
// jobs waited past the cut. It is small enough to answer whole: an account has at
// most PerOwner (five) waiting or running, so a reader's is five rows and an
// admin's five for each account.
func (s *Server) handleListJobs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	view := q.Get("view")
	if view == "" {
		view = "current"
	}
	if view != "current" && view != "past" {
		writeErr(w, http.StatusBadRequest, "view must be current or past")
		return
	}
	states := listParam(q["state"])
	for _, st := range states {
		if !jobStates[st] {
			writeErr(w, http.StatusBadRequest, "unknown state "+strconv.Quote(st))
			return
		}
	}
	kinds := listParam(q["kind"])
	before, limit, msg := pageParams(q, jobsPageDefault, jobsPageMax)
	if msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	// The Jobs tab's first read when it opens: the moment somebody is about to
	// look at what thirty days hold, so the prune that keeps it thirty runs now
	// rather than at the next hour's chance. It returns at once.
	if q.Get("prune") == "1" && s.Logbook != nil {
		s.Logbook.PruneSoon()
	}
	v := viewer(r)
	scope, args := visibleTo(v)
	where := []string{scope}
	order := "id ASC"
	if view == "current" {
		where = append(where, `queued = 1 AND state IN ('queued', 'running')`)
		before = 0
	} else {
		// NO WAIT FOR THE LOG WRITER HERE, unlike a job's poll. What ran in a
		// request lands in the logbook's next batch, milliseconds after the
		// request ends, and nobody opens Settings › Jobs faster than that. A
		// queued job's row is written as it happens. The list is read again
		// when a job ends or somebody presses something. The wait would cost its
		// whole 200 ms on every read while the log writer is held up.
		where = append(where, `state NOT IN ('queued', 'running') AND created_at >= ?`)
		args = append(args, time.Now().Add(-jobsRetention).UnixMilli())
		order = "id DESC"
	}
	if len(states) > 0 {
		where = append(where, `state IN (`+placeholders(len(states))+`)`)
		for _, st := range states {
			args = append(args, st)
		}
	}
	if len(kinds) > 0 {
		where = append(where, `kind IN (`+placeholders(len(kinds))+`)`)
		for _, k := range kinds {
			args = append(args, k)
		}
	}
	if before > 0 {
		where = append(where, `id < ?`)
		args = append(args, before)
	}
	// A page asks for one row past it, to know whether there is more; the queue
	// asks for all of it (LIMIT -1 is SQLite's "no limit").
	whole := view == "current"
	fetch := limit + 1
	if whole {
		fetch = -1
	}
	rows, err := s.Store.DB.Query(`SELECT `+jobColumns+` FROM jobs WHERE `+strings.Join(where, " AND ")+
		` ORDER BY `+order+` LIMIT ?`, append(args, fetch)...)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "list jobs", err)
		return
	}
	var list []jobRow
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			rows.Close()
			codedError(w, r, olog.CodeJobRead, "read a job", err)
			return
		}
		list = append(list, j)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		codedError(w, r, olog.CodeJobRead, "list jobs", err)
		return
	}
	more := !whole && len(list) > limit
	if more {
		list = list[:limit]
	}
	views, err := s.jobViews(list, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the queue", err)
		return
	}
	running, waiting, err := s.queueCounts(v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "count the queue", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": views, "running": running, "waiting": waiting, "more": more})
}

// queueCounts is how many queued jobs v may see are running and waiting.
func (s *Server) queueCounts(v jobs.Owner) (running, waiting int, err error) {
	scope, args := visibleTo(v)
	err = s.Store.DB.QueryRow(`SELECT COALESCE(SUM(state = 'running'), 0), COALESCE(SUM(state = 'queued'), 0)
		FROM jobs WHERE queued = 1 AND state IN ('queued', 'running') AND `+scope, args...).Scan(&running, &waiting)
	return running, waiting, err
}

// handleJobsSummary: GET /jobs/summary → {running: Job|null, waiting} — the
// phone's Jobs tile and the restore and reset prompts, which say a job is
// running before step one. Scoped like the list: a reader's running job and
// waiting count are their own.
func (s *Server) handleJobsSummary(w http.ResponseWriter, r *http.Request) {
	v := viewer(r)
	scope, args := visibleTo(v)
	row, err := scanJob(s.Store.DB.QueryRow(`SELECT `+jobColumns+` FROM jobs
		WHERE queued = 1 AND state = 'running' AND `+scope+` ORDER BY id LIMIT 1`, args...))
	var running any
	switch {
	case errors.Is(err, sql.ErrNoRows):
	case err != nil:
		codedError(w, r, olog.CodeJobRead, "read the running job", err)
		return
	default:
		views, err := s.jobViews([]jobRow{row}, v)
		if err != nil {
			codedError(w, r, olog.CodeJobRead, "read the queue", err)
			return
		}
		running = views[0]
	}
	_, waiting, err := s.queueCounts(v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "count the queue", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"running": running, "waiting": waiting})
}

// jobLinesPage is the most log lines one poll carries; more says there are more.
const jobLinesPage = 500

// jobLine is one line of a job's log, as the API answers it.
type jobLine struct {
	ID    int64  `json:"id"`
	At    int64  `json:"at"`
	Level string `json:"level"`
	Line  string `json:"line"`
}

// handleGetJob: GET /jobs/{id}?log_after=N → {job, lines, more}. One poll for a
// job's state and the lines it logged after line N, waiting up to 200 ms for
// what was logged before the poll.
func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	var after int64
	if a := strings.TrimSpace(r.URL.Query().Get("log_after")); a != "" {
		n, err := strconv.ParseInt(a, 10, 64)
		if err != nil || n < 0 {
			writeErr(w, http.StatusBadRequest, "log_after must be a line id")
			return
		}
		after = n
	}
	v := viewer(r)
	s.flushWait(r)
	row, found, err := s.visibleJob(id, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job", err)
		return
	}
	if !found {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	rows, err := s.Store.DB.Query(`SELECT id, at, level, line FROM job_logs WHERE job_id = ? AND id > ?
		ORDER BY id LIMIT ?`, id, after, jobLinesPage+1)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job's log", err)
		return
	}
	lines := []jobLine{}
	for rows.Next() {
		var l jobLine
		if err := rows.Scan(&l.ID, &l.At, &l.Level, &l.Line); err != nil {
			rows.Close()
			codedError(w, r, olog.CodeJobRead, "read the job's log", err)
			return
		}
		lines = append(lines, l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job's log", err)
		return
	}
	more := len(lines) > jobLinesPage
	if more {
		lines = lines[:jobLinesPage]
	}
	views, err := s.jobViews([]jobRow{row}, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the queue", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"job": views[0], "lines": lines, "more": more})
}

// handleJobResult: GET /jobs/{id}/result → {kind, result}, for the job's owner
// alone — an admin included, since a result is somebody's library. A job that
// stored nothing answers result null. A kind with a review (a re-verify) shapes
// the answer from what the database holds now.
func (s *Server) handleJobResult(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	v := viewer(r)
	var kind, result string
	err := s.Store.DB.QueryRow(`SELECT kind, result FROM jobs WHERE id = ? AND user_id = ?`, id, v.UserID).Scan(&kind, &result)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "no such job")
		return
	case err != nil:
		codedError(w, r, olog.CodeJobRead, "read the job's result", err)
		return
	}
	var answer any
	if result != "" && json.Valid([]byte(result)) {
		answer = json.RawMessage(result)
		if k, ok := s.startableKind(kind); ok && k.review != nil {
			if answer, err = k.review(s, v.UserID, json.RawMessage(result)); err != nil {
				codedError(w, r, olog.CodeJobRead, "review the job's result", err)
				return
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"kind": kind, "result": answer})
}

// handleJobLogMarkdown: GET /jobs/{id}/log.md — the job's whole log as a
// Markdown download, for its owner or an admin (jobs_markdown.go says what is in
// it and why no line can leave its block).
func (s *Server) handleJobLogMarkdown(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	v := viewer(r)
	// Waited for, as a poll waits: the export is the file somebody is handed to
	// read a failure from, and one that stops short of the job's last line is
	// the one read where the next poll having it is no answer.
	s.flushWait(r)
	row, found, err := s.visibleJob(id, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job", err)
		return
	}
	if !found {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	// The block holds the lines up to the newest one now, and the fence is
	// measured over exactly those: a running job's next line cannot land in the
	// block unmeasured. gen is the database all of it is read from.
	gen := s.Store.Generation()
	var upTo int64
	var longest int
	err = s.Store.DB.QueryRow(`SELECT COALESCE(MAX(id), 0) FROM job_logs WHERE job_id = ?`, id).Scan(&upTo)
	if err == nil {
		longest, err = s.longestIn(gen, `SELECT id, at, level, '', line FROM job_logs WHERE job_id = ? AND id <= ?
			AND (instr(line, '`+"`"+`') > 0 OR instr(level, '`+"`"+`') > 0)`, id, upTo)
	}
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job's log", err)
		return
	}
	title := jobs.Title(row.kind, jobs.OneLine(row.subject), row.total)
	about := []string{row.kind, row.state}
	if row.errMsg != "" {
		about[1] = row.state + " " + codeSpan(row.errMsg)
	}
	if row.total > 0 {
		about = append(about, fmt.Sprintf("%d of %d", row.done, row.total))
	}
	if row.username != "" {
		about = append(about, "for "+codeSpan(row.username))
	}
	if row.started.Valid {
		about = append(about, "started "+utc(row.started.Int64))
	} else {
		about = append(about, "created "+utc(row.created))
	}
	if row.finished.Valid {
		about = append(about, "finished "+utc(row.finished.Int64))
	}
	about = append(about, "the job's whole log, times in UTC")
	err = writeMarkdownExport(w, mdExport{
		filename: fmt.Sprintf("tippani-job-%d.md", id),
		heading:  fmt.Sprintf("Job #%d — %s", id, codeSpan(title)),
		about:    aboutLine(about...),
		longest:  longest,
		lines: func(emit func(string) error) error {
			return s.eachExportLine(gen, emit, `SELECT id, at, level, '', line FROM job_logs WHERE job_id = ? AND id <= ?`, id, upTo)
		},
	})
	if err != nil {
		olog.Warnf(olog.CodeJobRead, "[jobs] the log of job #%d was not all sent%s: %v", id, reqSuffix(r), err)
	}
}

// longestIn is the longest backtick run in the export lines q selects from
// generation gen's database (see eachExportLine for its shape).
func (s *Server) longestIn(gen uint64, q string, args ...any) (int, error) {
	longest := 0
	err := s.eachExportLine(gen, func(line string) error {
		longest = max(longest, longestBackticks(line))
		return nil
	}, q, args...)
	if afterFencePass != nil {
		afterFencePass()
	}
	return longest, err
}

// afterFencePass, when set, runs as an export's fence pass ends, before its line
// pass reads anything. A test seam and nothing else: the one way to land a swap
// between an export's first reads and its lines, a window of microseconds that
// nothing a person does holds open, and the one a line pass that read the
// generation for itself would miss.
var afterFencePass func()

// exportBatch is how many lines an export reads before it writes them.
const exportBatch = 2000

// errExportSwapped ends an export whose database was swapped part-way.
var errExportSwapped = errors.New("the database was replaced (a restore or a reset) while the export was written")

// eachExportLine emits, in id order, each line q selects — its columns id, at,
// level, code, line, and its WHERE the last clause, with no ORDER BY — as
// exportLine makes it.
//
// A BATCH AT A TIME, EACH READ TO THE END AND CLOSED BEFORE ANY OF IT IS SENT.
// emit writes to the network, and a cursor held open across a write holds one of
// the library pool's four connections for as long as the client takes to read:
// four phones asleep mid-download and every request in the app waits for a
// connection, and the cursor's read snapshot keeps the WAL from checkpointing
// meanwhile. Keyed by id, so each batch is its own short query that starts
// where the last one ended.
//
// gen is the store generation the export began on, read before its first read
// (the newest id, the fence's pass). A batch read from any other generation is
// not sent, and the export ends with a line saying so: after a reset the ids
// below the export's last one name other lines, and a restore could have been
// of anything, so the rest would not be the log the fence was measured over.
func (s *Server) eachExportLine(gen uint64, emit func(string) error, q string, args ...any) error {
	var after int64
	for {
		type row struct {
			id                int64
			at                int64
			level, code, line string
		}
		batch := make([]row, 0, exportBatch)
		rows, err := s.Store.DB.Query(q+` AND id > ? ORDER BY id LIMIT ?`, append(slices.Clone(args), after, exportBatch)...)
		if err != nil {
			return err
		}
		for rows.Next() {
			var l row
			if err := rows.Scan(&l.id, &l.at, &l.level, &l.code, &l.line); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, l)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		if s.Store.Generation() != gen {
			if err := emit("… the export stops here: " + errExportSwapped.Error()); err != nil {
				return err
			}
			return errExportSwapped
		}
		for _, l := range batch {
			if err := emit(exportLine(l.at, l.level, l.code, l.line)); err != nil {
				return err
			}
		}
		if len(batch) < exportBatch {
			return nil
		}
		after = batch[len(batch)-1].id
	}
}

// handleStopJob: POST /jobs/{id}/stop → {job}. A job is stopped at once: a
// waiting one before it starts, a running one cancelled, its item in hand left
// untouched (job_stop.go), so the job reads stopped a moment after this answers;
// one that has ended is left as it ended. A reader may stop their own, an admin
// anybody's.
func (s *Server) handleStopJob(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	v := viewer(r)
	if err := s.Jobs.Stop(id, v); err != nil {
		s.writeJobRefusal(w, r, err)
		return
	}
	s.writeJob(w, r, http.StatusOK, id, v)
}

// handleStopAllJobs: POST /jobs/stop-all → {stopping, stopped_waiting}: every
// job the viewer may see — a reader's own, an admin's everybody's.
func (s *Server) handleStopAllJobs(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	stopping, stoppedWaiting, err := s.Jobs.StopAll(viewer(r))
	if err != nil {
		s.writeJobRefusal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stopping": stopping, "stopped_waiting": stoppedWaiting})
}

// handleRerunJob: POST /jobs/{id}/rerun → 202 {job}: the job queued again, as a
// new job of the caller's, with rerun_of pointing back. The owner's alone. A kind
// whose secret nothing kept (a backup's password) takes it again in the body,
// {password | passphrase}, and it is checked before anything queues.
func (s *Server) handleRerunJob(w http.ResponseWriter, r *http.Request) {
	if s.Jobs == nil {
		noQueue(w)
		return
	}
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthBody)
	body, err := readOptionalBody(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	v := viewer(r)
	row, found, err := s.visibleJob(id, v)
	if err != nil {
		codedError(w, r, olog.CodeJobRead, "read the job", err)
		return
	}
	// Somebody else's job does not exist for this, an admin's view of it
	// notwithstanding: a rerun is queued as whoever presses it.
	if !found || !row.ownedBy(v) {
		writeErr(w, http.StatusNotFound, "no such job")
		return
	}
	k, known := s.startableKind(row.kind)
	if !known {
		s.writeJobRefusal(w, r, jobs.ErrNotRerunnable)
		return
	}
	// Asked now, not as it was when the job first ran: an admin who has since
	// stepped down cannot run an admin's job again.
	if k.adminOnly && !v.IsAdmin {
		s.writeJobRefusal(w, r, jobs.ErrAdminOnly)
		return
	}
	if !s.jobViewOf(row, v, nil, nil).Rerunnable {
		s.writeJobRefusal(w, r, jobs.ErrNotRerunnable)
		return
	}
	var secret any
	if k.secret != nil {
		if secret, err = k.secret(s, body, v); err != nil {
			if ref, ok := asRefusal(err); ok {
				writeErr(w, ref.status, ref.msg)
				return
			}
			codedError(w, r, olog.CodeJobRead, "check the rerun's credential", err)
			return
		}
	}
	newID, err := s.Jobs.Rerun(id, v, secret)
	if err != nil {
		s.writeJobRefusal(w, r, err)
		return
	}
	s.writeJob(w, r, http.StatusAccepted, newID, v)
}

// readOptionalBody is a request's JSON body, or nothing when it has none: a
// rerun of most kinds is a bare POST.
func readOptionalBody(r *http.Request) (json.RawMessage, error) {
	var body json.RawMessage
	err := json.NewDecoder(r.Body).Decode(&body)
	if errors.Is(err, io.EOF) {
		return nil, nil
	}
	return body, err
}
