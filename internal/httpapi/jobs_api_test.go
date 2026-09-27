package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/outbound"
)

// WHAT A PERSON SEES OF THE QUEUE, THROUGH THE API THE SCREENS READ.
//
// Every request goes through the handler as a browser sends it, signed in as the
// reader or admin in the sentence, and every assertion is on what the API
// answers: the job as Settings › Jobs lists it, the lines its log pane shows,
// the file its Export downloads.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it (srv.Jobs, a
//     jobs.Runner on a logbook, and RegisterJobKinds), and the test adds kinds of
//     its own with addJobKind: a job the test holds running until it lets go, one
//     that logs lines, one that fails. A real kind's run goes to the suppliers,
//     and nothing a person does holds a job mid-item on demand;
//   - the six built-in kinds' validators, reached through builtinJobKinds and
//     registered under a test name with a run of the test's (realKind), because
//     their caps and their checks are what is under test and their runs are not;
//   - the wire field names, which are the contract the SPA is built to: a test of
//     a contract has to name the fields it holds the server to;
//   - one test closes the queue as shutdown closes it (srv.Jobs.Close), since no
//     request shuts the server down;
//   - three tests write a row straight into the journal: a job finished 31 days
//     ago, which no request can make; a re-verify check, a kind only its own run
//     makes; and a log line that never passed the logbook's door, as a hand-made
//     archive's journal carried over by a restore would hold one.
//
// What each one guards, in a sentence a person would say: a job reads the same
// on every screen that shows it, field for field; each kind's counts are the ones
// its screens read, and a count's text keeps no key; one job runs at a time and the
// rest wait in the order started, each saying how many are ahead of it, anybody's
// counted and nobody's shown; a reader sees their own jobs only, and an admin
// sees everybody's under the name each was started as; an admin can stop a
// reader's job and a reader cannot stop another's; Stop all stops what the one
// pressing it may see; only a job's owner can run it again, and an admin's kind
// asks again whether they are still an admin; a sixth job and the same job twice
// are refused with the reason and the number or the job; every kind's params are
// held to its cap and its checks, and a backup's password is checked before
// anything queues and kept out of the job; a finished job's log downloads as
// Markdown whose block no line can leave; past jobs hold what ran in a request
// and thirty days of it; deleting a reader stops their jobs and keeps them for
// the admin; a server shutting down starts nothing.

// testQueue is the server's queue with the test's kinds on it.
type testQueue struct {
	t       *testing.T
	srv     *Server
	lb      *jobs.Logbook
	release chan struct{}
	done    chan struct{}
}

// queueing gives srv a queue as serve() does, and the test's kinds.
func queueing(t *testing.T, srv *Server) *testQueue {
	t.Helper()
	lb := keeping(t, srv)
	srv.Jobs = jobs.NewRunner(srv.Store, lb, jobs.Options{})
	srv.RegisterJobKinds()
	q := &testQueue{t: t, srv: srv, lb: lb, release: make(chan struct{}), done: make(chan struct{})}
	t.Cleanup(func() {
		close(q.done)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Jobs.Close(ctx)
	})
	srv.addJobKind(queuedKind{name: "test.hold", rerunnable: true, againAfterSuccess: true, validate: testParams, run: q.hold})
	srv.addJobKind(queuedKind{name: "test.lines", rerunnable: true, validate: testParams, run: q.lines})
	srv.addJobKind(queuedKind{name: "test.fail", rerunnable: true, validate: testParams, run: q.fail})
	srv.addJobKind(queuedKind{name: "test.admin", adminOnly: true, rerunnable: true, againAfterSuccess: true,
		validate: testParams, run: q.quick})
	return q
}

// testParams is the test kinds' params: a tag that tells two jobs apart, an item
// count, and a subject.
func testParams(_ *Server, raw json.RawMessage, _ jobs.Owner) (jobInput, error) {
	var p struct {
		Tag     string `json:"tag"`
		N       int    `json:"n"`
		Subject string `json:"subject"`
	}
	if err := decodeParams(raw, &p); err != nil {
		return jobInput{}, err
	}
	return jobInput{params: map[string]any{"tag": p.Tag, "n": p.N}, subject: p.Subject, total: p.N}, nil
}

// hold runs until the test lets it go (let) or somebody stops it, checking for
// Stop between waits as a real kind checks between items.
func (q *testQueue) hold(_ *Server, _ context.Context, j *jobs.Job) error {
	j.Log(jobs.LevelInfo, "holding")
	for {
		select {
		case <-q.release:
			j.Progress(1, 1)
			return nil
		case <-q.done:
			return nil
		case <-time.After(5 * time.Millisecond):
			if j.Stopping() {
				j.Log(jobs.LevelInfo, "stopped after the item in hand")
				return nil
			}
		}
	}
}

// let finishes the held job that is running.
func (q *testQueue) let() {
	q.t.Helper()
	select {
	case q.release <- struct{}{}:
	case <-time.After(20 * time.Second):
		q.t.Fatal("no held job was running to let go")
	}
}

// lineWithBackticks and the others are what the lines kind logs.
const (
	lineWithBackticks = "the answer held ```a fenced block``` in it"
	lineWithBreak     = "one line\nand \x1b[31ma red\x1b[0m second"
)

func (q *testQueue) lines(_ *Server, _ context.Context, j *jobs.Job) error {
	j.Log(jobs.LevelInfo, "%s", "looked up the first")
	j.Log(jobs.LevelWarn, "%s", lineWithBackticks)
	j.Log(jobs.LevelInfo, "%s", lineWithBreak)
	j.Progress(3, 3)
	return j.SetResult(map[string]any{"fetched": 3, "failed": 1, "items": []map[string]int{{"a": 1}, {"b": 2}}, "note": "kept"})
}

func (q *testQueue) fail(_ *Server, _ context.Context, j *jobs.Job) error {
	return errors.New("the supplier said no")
}

func (q *testQueue) quick(_ *Server, _ context.Context, j *jobs.Job) error { return nil }

// realKind is a built-in kind's rules — who may start it, its validate, its
// secret — under a test name, with a run of the test's.
func realKind(t *testing.T, name, as string, run func(*Server, context.Context, *jobs.Job) error) queuedKind {
	t.Helper()
	for _, k := range builtinJobKinds {
		if k.name == name {
			k.name, k.run = as, run
			return k
		}
	}
	t.Fatalf("no built-in kind %q", name)
	return queuedKind{}
}

// wireJob is a job as the API answers it.
type wireJob struct {
	ID         int64          `json:"id"`
	Kind       string         `json:"kind"`
	Queued     bool           `json:"queued"`
	Subject    string         `json:"subject"`
	State      string         `json:"state"`
	Params     map[string]any `json:"params"`
	Counts     map[string]any `json:"counts"`
	Error      string         `json:"error"`
	Total      int            `json:"total"`
	Done       int            `json:"done"`
	Ahead      int            `json:"ahead"`
	Username   string         `json:"username"`
	Own        bool           `json:"own"`
	Rerunnable bool           `json:"rerunnable"`
	Applied    bool           `json:"applied"`
	RerunOf    *int64         `json:"rerun_of"`
	FromJob    *int64         `json:"from_job"`
	CreatedAt  int64          `json:"created_at"`
	StartedAt  *int64         `json:"started_at"`
	FinishedAt *int64         `json:"finished_at"`
}

// jobFields is the wire contract's job, every field.
var jobFields = []string{"id", "kind", "queued", "subject", "state", "params", "counts", "error", "total", "done",
	"ahead", "username", "own", "rerunnable", "applied", "rerun_of", "from_job", "created_at", "started_at", "finished_at"}

func fieldsOf(m map[string]json.RawMessage) []string {
	var out []string
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// shaped fails unless raw is an object with exactly the fields want.
func shaped(t *testing.T, what string, raw json.RawMessage, want ...string) map[string]json.RawMessage {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("%s is not an object: %s", what, raw)
	}
	w := slices.Clone(want)
	sort.Strings(w)
	if got := fieldsOf(m); !slices.Equal(got, w) {
		t.Fatalf("%s has fields %v, want %v", what, got, w)
	}
	return m
}

func (c *testClient) startJob(kind string, params any) *httptest.ResponseRecorder {
	c.t.Helper()
	return c.do("POST", "/jobs", map[string]any{"kind": kind, "params": params})
}

// mustStart starts a job and fails the test unless it is accepted.
func (c *testClient) mustStart(kind string, params any) wireJob {
	c.t.Helper()
	rec := c.startJob(kind, params)
	if rec.Code != http.StatusAccepted {
		c.t.Fatalf("start %s: %d %s", kind, rec.Code, rec.Body)
	}
	return decode[struct {
		Job wireJob `json:"job"`
	}](c.t, rec).Job
}

func (c *testClient) job(id int64) wireJob {
	c.t.Helper()
	return decode[struct {
		Job wireJob `json:"job"`
	}](c.t, c.mustDo("GET", fmt.Sprintf("/jobs/%d", id), nil, http.StatusOK)).Job
}

// waitJob polls a job, as its screen does, until it reads state.
func (c *testClient) waitJob(id int64, state string) wireJob {
	c.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		j := c.job(id)
		if j.State == state {
			return j
		}
		if time.Now().After(deadline) {
			c.t.Fatalf("job %d is %s, never %s", id, j.State, state)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

type jobList struct {
	Jobs    []wireJob `json:"jobs"`
	Running int       `json:"running"`
	Waiting int       `json:"waiting"`
	More    bool      `json:"more"`
}

func (c *testClient) jobs(query string) jobList {
	c.t.Helper()
	return decode[jobList](c.t, c.mustDo("GET", "/jobs?"+query, nil, http.StatusOK))
}

// accountID is an account's id as the admin's Users list shows it.
func accountID(t *testing.T, admin *testClient, name string) int64 {
	t.Helper()
	list := decode[struct {
		Users []struct {
			ID       int64  `json:"id"`
			Username string `json:"username"`
		} `json:"users"`
	}](t, admin.mustDo("GET", "/admin/users", nil, http.StatusOK))
	for _, u := range list.Users {
		if u.Username == name {
			return u.ID
		}
	}
	t.Fatalf("no account %q in the admin's list", name)
	return 0
}

func jobIDs(list []wireJob) []int64 {
	out := []int64{}
	for _, j := range list {
		out = append(out, j.ID)
	}
	return out
}

func TestAJobReadsTheSameOnEveryScreenThatShowsIt(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	rec := admin.startJob("test.lines", map[string]any{"tag": "a", "n": 3, "subject": "Dune"})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("start: %d %s", rec.Code, rec.Body)
	}
	top := shaped(t, "POST /jobs", rec.Body.Bytes(), "job")
	shaped(t, "the started job", top["job"], jobFields...)
	started := decode[struct {
		Job wireJob `json:"job"`
	}](t, rec).Job
	if started.Kind != "test.lines" || !started.Queued || started.Subject != "Dune" || !started.Own ||
		started.Username != "alice" || started.CreatedAt == 0 || started.Params["tag"] != "a" {
		t.Fatalf("the started job: %+v", started)
	}

	done := admin.waitJob(started.ID, "succeeded")
	if done.Done != 3 || done.Total != 3 || done.StartedAt == nil || done.FinishedAt == nil || done.Ahead != 0 {
		t.Fatalf("the finished job: %+v", done)
	}
	// Counts are the kind's to make, and this one makes none: its result's
	// numbers are not read as counts on its behalf, nor its list's length.
	if len(done.Counts) != 0 {
		t.Fatalf("counts of a kind that counts nothing: %v", done.Counts)
	}
	if done.Rerunnable || done.Applied || done.RerunOf != nil || done.FromJob != nil {
		t.Fatalf("a finished job that reruns only when it did not succeed: %+v", done)
	}

	// One poll: the job and its log.
	poll := admin.mustDo("GET", fmt.Sprintf("/jobs/%d?log_after=0", started.ID), nil, http.StatusOK)
	m := shaped(t, "GET /jobs/{id}", poll.Body.Bytes(), "job", "lines", "more")
	shaped(t, "the polled job", m["job"], jobFields...)
	var lines []json.RawMessage
	json.Unmarshal(m["lines"], &lines)
	if len(lines) != 3 {
		t.Fatalf("the log: %s", m["lines"])
	}
	for _, l := range lines {
		shaped(t, "a log line", l, "id", "at", "level", "line")
	}
	type line struct {
		ID    int64  `json:"id"`
		Level string `json:"level"`
		Line  string `json:"line"`
	}
	all := decode[struct {
		Lines []line `json:"lines"`
		More  bool   `json:"more"`
	}](t, poll)
	if all.More || all.Lines[1].Level != "warn" || all.Lines[1].Line != lineWithBackticks {
		t.Fatalf("the log: %+v", all)
	}
	// The next poll carries only what came after the last line it had.
	next := decode[struct {
		Lines []line `json:"lines"`
	}](t, admin.mustDo("GET", fmt.Sprintf("/jobs/%d?log_after=%d", started.ID, all.Lines[1].ID), nil, http.StatusOK))
	if len(next.Lines) != 1 || next.Lines[0].ID != all.Lines[2].ID {
		t.Fatalf("after line %d: %+v", all.Lines[1].ID, next.Lines)
	}

	res := admin.mustDo("GET", fmt.Sprintf("/jobs/%d/result", started.ID), nil, http.StatusOK)
	rm := shaped(t, "GET /jobs/{id}/result", res.Body.Bytes(), "kind", "result")
	if string(rm["kind"]) != `"test.lines"` || !strings.Contains(string(rm["result"]), `"items":[{"a":1},{"b":2}]`) {
		t.Fatalf("the result: %s", res.Body)
	}

	for _, view := range []string{"view=past", "view=current"} {
		shaped(t, "GET /jobs?"+view, admin.mustDo("GET", "/jobs?"+view, nil, http.StatusOK).Body.Bytes(),
			"jobs", "running", "waiting", "more")
	}
	if past := admin.jobs("view=past"); !slices.Contains(jobIDs(past.Jobs), started.ID) {
		t.Fatalf("past jobs: %v", jobIDs(past.Jobs))
	}
	if cur := admin.jobs("view=current"); len(cur.Jobs) != 0 || cur.Running != 0 || cur.Waiting != 0 {
		t.Fatalf("current jobs with nothing running: %+v", cur)
	}
	sum := admin.mustDo("GET", "/jobs/summary", nil, http.StatusOK)
	if sm := shaped(t, "GET /jobs/summary", sum.Body.Bytes(), "running", "waiting"); string(sm["running"]) != "null" || string(sm["waiting"]) != "0" {
		t.Fatalf("the summary with nothing running: %s", sum.Body)
	}

	held := admin.mustStart("test.hold", map[string]any{"tag": "h"})
	admin.waitJob(held.ID, "running")
	sm := shaped(t, "GET /jobs/summary", admin.mustDo("GET", "/jobs/summary", nil, http.StatusOK).Body.Bytes(), "running", "waiting")
	shaped(t, "the summary's running job", sm["running"], jobFields...)

	stop := admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", held.ID), nil, http.StatusOK)
	shaped(t, "the stopped job", shaped(t, "POST /jobs/{id}/stop", stop.Body.Bytes(), "job")["job"], jobFields...)
	stopped := admin.waitJob(held.ID, "stopped")
	if !stopped.Rerunnable {
		t.Fatalf("a stopped job the viewer started is not offered a rerun: %+v", stopped)
	}
	all2 := admin.mustDo("POST", "/jobs/stop-all", nil, http.StatusOK)
	if am := shaped(t, "POST /jobs/stop-all", all2.Body.Bytes(), "stopping", "stopped_waiting"); string(am["stopping"]) != "0" {
		t.Fatalf("stop all with nothing running: %s", all2.Body)
	}

	rerun := admin.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", held.ID), nil, http.StatusAccepted)
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, rerun).Job
	shaped(t, "the rerun job", shaped(t, "POST /jobs/{id}/rerun", rerun.Body.Bytes(), "job")["job"], jobFields...)
	if again.ID == held.ID || again.RerunOf == nil || *again.RerunOf != held.ID || again.Params["tag"] != "h" {
		t.Fatalf("the rerun: %+v", again)
	}
	q.let()
	admin.waitJob(again.ID, "succeeded")
}

// Each kind's counts are the ones its screens read (the wire contract's table):
// the numbers, the people fetch's first error as text, a check's items and how
// many differ, an apply's written, skipped and failed, and nothing for a backup.
// Each kind's result is stored by a run of the test's, in the shape the kind's
// own run stores it; what is under test is what the job JSON makes of it.
func TestEachKindsCountsAreTheOnesItsScreensRead(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	storing := func(result any) func(*Server, context.Context, *jobs.Job) error {
		return func(_ *Server, _ context.Context, j *jobs.Job) error { return j.SetResult(result) }
	}
	book := func(id int, status string, diffs ...any) map[string]any {
		return map[string]any{"type": "book", "id": id, "title": "A Book", "status": status, "diffs": append([]any{}, diffs...)}
	}
	year := map[string]any{"field": "published_year", "stored": 0, "fresh": 1969}
	// A provider's error with its key in it, as a failed call reads.
	leaky := `Get "https://api.themoviedb.org/3/search/person?query=Le+Guin&api_key=Wv-SECRET": EOF`
	cases := []struct {
		kind   string
		params any
		result any
		want   string
	}{
		{"fill", map[string]any{"book_ids": []int{1}},
			map[string]any{"fields": 12, "failed": 2, "unpinned": 1, "lines": []string{"one", "two"}},
			"map[failed:2 fields:12 unpinned:1]"},
		{"covers", map[string]any{"missing_only": true},
			map[string]any{"fetched": 5, "enriched": 3, "failed": 1, "skipped": 0},
			"map[enriched:3 failed:1 fetched:5 skipped:0]"},
		{"people", map[string]any{"ids": []int{1, 2, 3, 4, 5}},
			map[string]any{"ok": 4, "failed": 1, "first_error": "not found", "people": []int{1, 2, 3, 4, 5}},
			"map[failed:1 first_error:not found ok:4]"},
		{"reverify", map[string]any{"book_ids": []int{1, 2, 3}},
			[]any{book(1, "ok", year), book(2, "ok"), book(3, "unpinned")},
			"map[changes:1 items:3]"},
		{"reverify-apply", map[string]any{"items": []any{map[string]any{"type": "book", "id": 1, "set": map[string]any{}}}},
			[]any{
				map[string]any{"type": "book", "id": 1, "ok": true},
				map[string]any{"type": "book", "id": 2, "ok": true, "note": "the cover could not be fetched"},
				map[string]any{"type": "movie", "id": 3, "ok": false, "error": "not found"},
			},
			"map[applied:2 failed:1 skipped:1]"},
		{"backup", map[string]any{"password": testPw},
			map[string]any{"name": "tippanibackup.tpbk", "size": 2048, "created_at": 1},
			"map[]"},
	}
	for _, c := range cases {
		srv.addJobKind(realKind(t, c.kind, "test."+c.kind, storing(c.result)))
	}
	// A second people fetch, whose first error carries a key: the count keeps
	// the error and not the key.
	srv.addJobKind(realKind(t, "people", "test.people-leaky", storing(map[string]any{"ok": 0, "failed": 1, "first_error": leaky})))
	h := srv.Handler()
	admin := signupAdmin(t, h)

	for _, c := range cases {
		j := admin.waitJob(admin.mustStart("test."+c.kind, c.params).ID, "succeeded")
		if got := fmt.Sprint(j.Counts); got != c.want {
			t.Errorf("%s: counts %s, want %s", c.kind, got, c.want)
		}
		// The list carries the same counts as the job's own poll.
		past := admin.jobs("view=past&kind=test." + c.kind).Jobs
		if len(past) != 1 || past[0].ID != j.ID || fmt.Sprint(past[0].Counts) != c.want {
			t.Errorf("%s in past jobs: %+v, want job %d with counts %s", c.kind, past, j.ID, c.want)
		}
	}
	j := admin.waitJob(admin.mustStart("test.people-leaky", map[string]any{"ids": []int{9}}).ID, "succeeded")
	if e, _ := j.Counts["first_error"].(string); !strings.Contains(e, "api.themoviedb.org") || strings.Contains(e, "Wv-SECRET") {
		t.Fatalf("a people fetch's first error in its counts: %q, want the call without its key", e)
	}
}

func TestJobsRunOneAtATimeInTheOrderStartedAndSayHowManyAreAhead(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	a := alice.mustStart("test.hold", map[string]any{"tag": "a"})
	alice.waitJob(a.ID, "running")
	b := bob.mustStart("test.hold", map[string]any{"tag": "b"})
	c := alice.mustStart("test.hold", map[string]any{"tag": "c"})

	// Bob sees his own job and how long his wait is, and not whose jobs make it.
	mine := bob.jobs("view=current")
	if !slices.Equal(jobIDs(mine.Jobs), []int64{b.ID}) || mine.Jobs[0].Ahead != 1 || mine.Jobs[0].State != "queued" ||
		mine.Running != 0 || mine.Waiting != 1 {
		t.Fatalf("bob's current jobs: %+v", mine)
	}
	// The admin sees the queue as it runs: one running, the rest in the order
	// they were started, each with its count ahead and its owner's name.
	all := alice.jobs("view=current")
	if !slices.Equal(jobIDs(all.Jobs), []int64{a.ID, b.ID, c.ID}) || all.Running != 1 || all.Waiting != 2 {
		t.Fatalf("the queue: %+v", all)
	}
	for i, want := range []struct {
		state, user string
		ahead       int
		own         bool
	}{{"running", "alice", 0, true}, {"queued", "bob", 1, false}, {"queued", "alice", 2, true}} {
		j := all.Jobs[i]
		if j.State != want.state || j.Username != want.user || j.Ahead != want.ahead || j.Own != want.own {
			t.Fatalf("job %d in the queue: %+v, want %+v", i, j, want)
		}
	}

	q.let()
	alice.waitJob(a.ID, "succeeded")
	if j := bob.waitJob(b.ID, "running"); j.Ahead != 0 {
		t.Fatalf("bob's running job: %+v", j)
	}
	if j := alice.job(c.ID); j.State != "queued" || j.Ahead != 1 {
		t.Fatalf("the last job once the first ended: %+v", j)
	}
	q.let()
	alice.waitJob(c.ID, "running")
	q.let()
	alice.waitJob(c.ID, "succeeded")
}

func TestAReaderSeesOnlyTheirOwnJobsAndAnAdminSeesEveryonesUnderTheirName(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")

	job := bob.mustStart("test.lines", map[string]any{"tag": "bob's"})
	bob.waitJob(job.ID, "succeeded")

	for _, try := range []struct{ method, path string }{
		{"GET", "/jobs/%d"}, {"GET", "/jobs/%d/result"}, {"GET", "/jobs/%d/log.md"},
		{"POST", "/jobs/%d/rerun"}, {"POST", "/jobs/%d/stop"},
	} {
		if rec := carol.do(try.method, fmt.Sprintf(try.path, job.ID), nil); rec.Code != http.StatusNotFound {
			t.Fatalf("carol %s %s on bob's job: %d %s, want 404", try.method, try.path, rec.Code, rec.Body)
		}
	}
	if past := carol.jobs("view=past"); len(past.Jobs) != 0 {
		t.Fatalf("carol's past jobs hold somebody else's: %+v", past.Jobs)
	}

	seen := alice.job(job.ID)
	if seen.Username != "bob" || seen.Own || seen.Rerunnable {
		t.Fatalf("bob's job as the admin sees it: %+v", seen)
	}
	if past := alice.jobs("view=past"); !slices.Contains(jobIDs(past.Jobs), job.ID) {
		t.Fatalf("the admin's past jobs: %v", jobIDs(past.Jobs))
	}
	alice.mustDo("GET", fmt.Sprintf("/jobs/%d/log.md", job.ID), nil, http.StatusOK)
	// What a job found and running it again stay the owner's, even for an admin.
	alice.mustDo("GET", fmt.Sprintf("/jobs/%d/result", job.ID), nil, http.StatusNotFound)
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", job.ID), nil, http.StatusNotFound)

	if own := bob.job(job.ID); own.Username != "" || !own.Own {
		t.Fatalf("bob's job as bob sees it: %+v", own)
	}
	bob.mustDo("GET", fmt.Sprintf("/jobs/%d/result", job.ID), nil, http.StatusOK)

	// While bob's job runs and another of his waits, carol's phone tile and her
	// current jobs hold nothing of his: no running job, no count.
	running := bob.mustStart("test.hold", map[string]any{"tag": "bob's running", "subject": "Bob's Library"})
	bob.waitJob(running.ID, "running")
	waiting := bob.mustStart("test.hold", map[string]any{"tag": "bob's waiting"})
	type summary struct {
		Running *wireJob `json:"running"`
		Waiting int      `json:"waiting"`
	}
	if s := decode[summary](t, carol.mustDo("GET", "/jobs/summary", nil, http.StatusOK)); s.Running != nil || s.Waiting != 0 {
		t.Fatalf("carol's summary while bob's jobs run and wait: %+v", s)
	}
	if cur := carol.jobs("view=current"); len(cur.Jobs) != 0 || cur.Running != 0 || cur.Waiting != 0 {
		t.Fatalf("carol's current jobs while bob's run and wait: %+v", cur)
	}
	// Bob's own, and the admin's view of everybody's, do hold them.
	if s := decode[summary](t, bob.mustDo("GET", "/jobs/summary", nil, http.StatusOK)); s.Running == nil || s.Running.ID != running.ID || s.Waiting != 1 {
		t.Fatalf("bob's summary: %+v", s)
	}
	if s := decode[summary](t, alice.mustDo("GET", "/jobs/summary", nil, http.StatusOK)); s.Running == nil || s.Running.ID != running.ID ||
		s.Running.Username != "bob" || s.Waiting != 1 {
		t.Fatalf("the admin's summary: %+v", s)
	}
	for _, j := range []wireJob{waiting, running} {
		bob.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", j.ID), nil, http.StatusOK)
		bob.waitJob(j.ID, "stopped")
	}
}

func TestAnAdminStopsAReadersJobAndAReaderCannotStopAnothers(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")

	job := bob.mustStart("test.hold", map[string]any{"tag": "b"})
	bob.waitJob(job.ID, "running")
	carol.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusNotFound)
	time.Sleep(50 * time.Millisecond)
	if j := bob.job(job.ID); j.State != "running" {
		t.Fatalf("bob's job after carol's refused stop: %s", j.State)
	}

	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	bob.waitJob(job.ID, "stopped")
	log := decode[struct {
		Lines []struct {
			Line string `json:"line"`
		} `json:"lines"`
	}](t, bob.mustDo("GET", fmt.Sprintf("/jobs/%d", job.ID), nil, http.StatusOK))
	var text []string
	for _, l := range log.Lines {
		text = append(text, l.Line)
	}
	if !slices.Contains(text, "alice asked it to stop; it stops after the item in hand") {
		t.Fatalf("bob's log does not say who stopped it: %q", text)
	}
}

func TestStopAllStopsWhatTheOnePressingItMaySee(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")

	a := alice.mustStart("test.hold", map[string]any{"tag": "a"})
	alice.waitJob(a.ID, "running")
	b1 := bob.mustStart("test.hold", map[string]any{"tag": "b1"})
	b2 := bob.mustStart("test.hold", map[string]any{"tag": "b2"})
	c := carol.mustStart("test.hold", map[string]any{"tag": "c"})

	type counts struct {
		Stopping       int `json:"stopping"`
		StoppedWaiting int `json:"stopped_waiting"`
	}
	if got := decode[counts](t, bob.mustDo("POST", "/jobs/stop-all", nil, http.StatusOK)); got != (counts{0, 2}) {
		t.Fatalf("bob's stop all: %+v, want his two waiting jobs", got)
	}
	for _, id := range []int64{b1.ID, b2.ID} {
		bob.waitJob(id, "stopped")
	}
	if carol.job(c.ID).State != "queued" || alice.job(a.ID).State != "running" {
		t.Fatalf("bob's stop all reached somebody else's job")
	}

	if got := decode[counts](t, alice.mustDo("POST", "/jobs/stop-all", nil, http.StatusOK)); got != (counts{1, 1}) {
		t.Fatalf("the admin's stop all: %+v, want her running job and carol's waiting one", got)
	}
	carol.waitJob(c.ID, "stopped")
	alice.waitJob(a.ID, "stopped")
}

func TestOnlyTheOwnerRunsAJobAgainAndAnAdminsKindAsksAgainWhoIsAdmin(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	srv.addJobKind(realKind(t, "backup", "test.backup", q.quick))
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	failed := bob.mustStart("test.fail", map[string]any{"tag": "f"})
	j := bob.waitJob(failed.ID, "failed")
	if j.Error != "the supplier said no" || !j.Rerunnable {
		t.Fatalf("bob's failed job: %+v", j)
	}
	if seen := alice.job(failed.ID); seen.Rerunnable {
		t.Fatalf("the admin is offered a rerun of bob's job: %+v", seen)
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", failed.ID), nil, http.StatusNotFound)
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, bob.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", failed.ID), nil, http.StatusAccepted)).Job
	if again.RerunOf == nil || *again.RerunOf != failed.ID || !again.Own {
		t.Fatalf("bob's rerun: %+v", again)
	}
	bob.waitJob(again.ID, "failed")

	// A success that running again would only repeat is not offered one.
	lines := bob.mustStart("test.lines", map[string]any{"tag": "l"})
	bob.waitJob(lines.ID, "succeeded")
	bob.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", lines.ID), nil, http.StatusConflict)

	// Bob is made an admin, runs an admin's job, and steps down.
	bobID := accountID(t, alice, "bob")
	alice.mustDo("PATCH", fmt.Sprintf("/admin/users/%d", bobID), map[string]bool{"is_admin": true}, http.StatusOK)
	adm := bob.mustStart("test.admin", map[string]any{"tag": "adm"})
	if j := bob.waitJob(adm.ID, "succeeded"); !j.Rerunnable {
		t.Fatalf("an admin's own succeeded admin job: %+v", j)
	}
	backup := bob.mustStart("test.backup", map[string]string{"password": testPw})
	bob.waitJob(backup.ID, "succeeded")
	bob.mustDo("PATCH", fmt.Sprintf("/admin/users/%d", bobID), map[string]bool{"is_admin": false}, http.StatusOK)
	if rec := bob.do("POST", fmt.Sprintf("/jobs/%d/rerun", adm.ID), nil); rec.Code != http.StatusForbidden {
		t.Fatalf("a former admin's rerun of an admin's job: %d %s, want 403", rec.Code, rec.Body)
	}
	// Refused for who he is before he is asked for anything: a backup's rerun
	// does not check a password he is not allowed to use.
	if rec := bob.do("POST", fmt.Sprintf("/jobs/%d/rerun", backup.ID), map[string]string{"password": "not-it-at-all"}); rec.Code != http.StatusForbidden {
		t.Fatalf("a former admin's backup rerun: %d %s, want 403", rec.Code, rec.Body)
	}
	if rec := bob.startJob("test.admin", map[string]any{"tag": "adm2"}); rec.Code != http.StatusForbidden {
		t.Fatalf("a reader starting an admin's job: %d %s, want 403", rec.Code, rec.Body)
	}
}

func TestASixthJobAndTheSameJobTwiceAreRefusedWithTheReason(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	var five []int64
	for i := range 5 {
		five = append(five, bob.mustStart("test.hold", map[string]any{"tag": fmt.Sprint(i)}).ID)
	}
	rec := bob.startJob("test.hold", map[string]any{"tag": "sixth"})
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("a sixth job: %d %s, want 429", rec.Code, rec.Body)
	}
	if m := shaped(t, "the 429", rec.Body.Bytes(), "error", "limit"); string(m["limit"]) != "5" {
		t.Fatalf("the 429: %s", rec.Body)
	}
	rec = bob.startJob("test.hold", map[string]any{"tag": "1"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("the same job again: %d %s, want 409", rec.Code, rec.Body)
	}
	if m := shaped(t, "the 409", rec.Body.Bytes(), "error", "job_id"); string(m["job_id"]) != fmt.Sprint(five[1]) {
		t.Fatalf("the 409 names %s, want job %d", m["job_id"], five[1])
	}
	// Somebody else's five are not bob's.
	alice.mustStart("test.hold", map[string]any{"tag": "1"})

	if rec := bob.startJob("no.such.kind", nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("a kind nobody knows: %d %s", rec.Code, rec.Body)
	}
}

func TestEveryKindsParamsAreHeldToItsCapAndItsChecks(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	for _, k := range []string{"fill", "people", "reverify", "reverify-apply", "covers", "backup"} {
		srv.addJobKind(realKind(t, k, "test."+k, q.hold))
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")

	upTo := func(n int) []int64 {
		out := make([]int64, n)
		for i := range out {
			out[i] = int64(i + 1)
		}
		return out
	}
	refused := func(c *testClient, kind string, params any, status int, says string) {
		t.Helper()
		rec := c.startJob(kind, params)
		if rec.Code != status || !strings.Contains(rec.Body.String(), says) {
			t.Fatalf("%s %v: %d %s, want %d saying %q", kind, params, rec.Code, rec.Body, status, says)
		}
	}
	stop := func(c *testClient, j wireJob) {
		t.Helper()
		c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", j.ID), nil, http.StatusOK)
		c.waitJob(j.ID, "stopped")
	}

	// fill: 2000 works, counted once each, in order.
	refused(bob, "test.fill", map[string]any{"book_ids": upTo(1500), "movie_ids": upTo(501)}, 400, "at most 2000")
	refused(bob, "test.fill", map[string]any{"book_ids": []int64{0}}, 400, "positive")
	refused(bob, "test.fill", map[string]any{}, 400, "nothing to fill")
	fill := bob.mustStart("test.fill", map[string]any{"book_ids": []int64{3, 1, 3}, "movie_ids": upTo(1998)})
	if fill.Total != 2000 || fmt.Sprint(fill.Params["book_ids"]) != "[1 3]" {
		t.Fatalf("the fill: total %d, params %v", fill.Total, fill.Params)
	}
	// The same selection in another order is the same job.
	rec := bob.startJob("test.fill", map[string]any{"movie_ids": upTo(1998), "book_ids": []int64{1, 3}})
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), fmt.Sprintf(`"job_id":%d`, fill.ID)) {
		t.Fatalf("the same fill again: %d %s", rec.Code, rec.Body)
	}
	stop(bob, fill)

	refused(bob, "test.people", map[string]any{"ids": upTo(2001)}, 400, "at most 2000")
	stop(bob, bob.mustStart("test.people", map[string]any{"ids": upTo(2000)}))

	people := []map[string]string{{"kind": "author", "name": " Ursula K. Le Guin "}, {"kind": "author", "name": "Ursula K. Le Guin"}}
	refused(bob, "test.reverify", map[string]any{"book_ids": upTo(400), "movie_ids": upTo(100), "people": people[:1]}, 400, "at most 500")
	rv := bob.mustStart("test.reverify", map[string]any{"book_ids": upTo(400), "movie_ids": upTo(99), "people": people, "fills_only": true})
	if rv.Total != 500 || fmt.Sprint(rv.Params["people"]) != "[map[kind:author name:Ursula K. Le Guin]]" || rv.Params["fills_only"] != true {
		t.Fatalf("the re-verify: total %d, params %v", rv.Total, rv.Params)
	}
	stop(bob, rv)

	// reverify-apply: 500 items, each saying what it is, from a check of the
	// reader's own. A check is only ever made by its own run, so the two checks
	// are written as that run would leave them.
	item := map[string]any{"type": "book", "id": 1, "set": map[string]any{"year": 1969}}
	many := make([]any, 501)
	for i := range many {
		many[i] = item
	}
	refused(bob, "test.reverify-apply", map[string]any{"items": many}, 400, "at most 500")
	refused(bob, "test.reverify-apply", map[string]any{"items": []any{map[string]any{"id": 1}}}, 400, "names its type")
	check := func(owner string) int64 {
		res, err := srv.Store.DB.Exec(`INSERT INTO jobs (user_id, username, kind, state, created_at, finished_at)
			VALUES (?, ?, 'reverify', 'succeeded', ?, ?)`, accountID(t, alice, owner), owner, time.Now().UnixMilli(), time.Now().UnixMilli())
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		return id
	}
	bobsCheck, carolsCheck := check("bob"), check("carol")
	refused(bob, "test.reverify-apply", map[string]any{"items": []any{item}, "from_job": carolsCheck}, 400, "not one of your re-verify checks")
	refused(bob, "test.reverify-apply", map[string]any{"items": []any{item}, "from_job": fill.ID}, 400, "not one of your re-verify checks")
	if bob.job(bobsCheck).Applied {
		t.Fatal("a check nothing was applied from reads applied")
	}
	apply := bob.mustStart("test.reverify-apply", map[string]any{"items": many[:500], "from_job": bobsCheck})
	if apply.Total != 500 || apply.FromJob == nil || *apply.FromJob != bobsCheck {
		t.Fatalf("the apply: %+v", apply)
	}
	if !bob.job(bobsCheck).Applied || carol.job(carolsCheck).Applied {
		t.Fatal("applied does not follow the apply that names the check")
	}
	stop(bob, apply)

	// covers: an admin's, counted over their own library.
	refused(bob, "test.covers", map[string]any{"missing_only": true}, 403, "admin")
	alice.mustDo("POST", "/books", map[string]any{"title": "Kept", "author": "Someone"}, 201)
	alice.mustDo("POST", "/books", map[string]any{"title": "Also kept", "author": "Someone"}, 201)
	bob.mustDo("POST", "/books", map[string]any{"title": "Bob's", "author": "Someone"}, 201)
	covers := alice.mustStart("test.covers", map[string]any{"missing_only": true})
	if covers.Total != 2 || covers.Params["missing_only"] != true {
		t.Fatalf("the covers pass: %+v", covers)
	}
	stop(alice, covers)

	// backup: the password is checked before anything queues, and kept out of
	// the job; running it again asks for it again.
	refused(bob, "test.backup", map[string]any{"password": testPw}, 403, "admin")
	refused(alice, "test.backup", map[string]any{"password": "not-it-at-all"}, 401, "not your password")
	refused(alice, "test.backup", map[string]any{"passphrase": "short"}, 400, "at least 10")
	refused(alice, "test.backup", map[string]any{}, 400, "confirm your password")
	backup := alice.startJob("test.backup", map[string]any{"password": testPw})
	if backup.Code != http.StatusAccepted || strings.Contains(backup.Body.String(), testPw) {
		t.Fatalf("the backup: %d %s", backup.Code, backup.Body)
	}
	bj := decode[struct {
		Job wireJob `json:"job"`
	}](t, backup).Job
	refused(alice, "test.backup", map[string]any{"passphrase": "another-phrase"}, 409, fmt.Sprintf(`"job_id":%d`, bj.ID))
	stop(alice, bj)
	for body, want := range map[string]int{`{"password":"not-it-at-all"}`: 401, `{}`: 400, "": 400} {
		rec := alice.doRaw("POST", fmt.Sprintf("/jobs/%d/rerun", bj.ID), strings.NewReader(body), "application/json")
		if rec.Code != want {
			t.Fatalf("a backup's rerun with %q: %d %s, want %d", body, rec.Code, rec.Body, want)
		}
	}
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", bj.ID), map[string]string{"password": testPw}, http.StatusAccepted)).Job
	stop(alice, again)
}

func TestAFinishedJobsLogDownloadsAsMarkdownNoLineCanLeave(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	job := bob.mustStart("test.lines", map[string]any{"tag": "md", "n": 3, "subject": "Dune\n\x1b[31mPart Two"})
	bob.waitJob(job.ID, "succeeded")
	rec := bob.mustDo("GET", fmt.Sprintf("/jobs/%d/log.md", job.ID), nil, http.StatusOK)
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Fatalf("content type %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); cd != fmt.Sprintf(`attachment; filename="tippani-job-%d.md"`, job.ID) {
		t.Fatalf("content disposition %q", cd)
	}
	body := rec.Body.String()
	if strings.ContainsAny(body, "\x1b\r") {
		t.Fatalf("the export carries a terminal escape or a carriage return:\n%q", body)
	}
	got := strings.Split(strings.TrimSuffix(body, "\n"), "\n")
	// A heading, the line about it, and one block: every log line one line of
	// its own inside a fence longer than the longest run of backticks in them.
	if len(got) != 9 {
		t.Fatalf("the export is %d lines, want 9:\n%s", len(got), body)
	}
	if want := fmt.Sprintf("# Job #%d — `test.lines: Dune⏎Part Two`", job.ID); got[0] != want {
		t.Fatalf("heading %q, want %q", got[0], want)
	}
	if got[1] != "" || !strings.HasPrefix(got[2], "Tippani `") || !strings.Contains(got[2], " UTC · test.lines · succeeded · 3 of 3 · for `bob`") || got[3] != "" {
		t.Fatalf("the line about the export: %q", got[1:4])
	}
	if got[4] != "````" || got[8] != "````" {
		t.Fatalf("the fence: %q and %q, want four backticks each (a line holds three)", got[4], got[8])
	}
	for i, want := range []string{"info     looked up the first", "warn     " + lineWithBackticks, "info     one line⏎and a red second"} {
		if !strings.HasSuffix(got[5+i], want) {
			t.Fatalf("block line %d: %q, want it to end %q", i, got[5+i], want)
		}
	}

	// A line that never passed the door — a break, an escape and five backticks
	// in it, as a hand-made archive's journal could carry — still leaves as one
	// line, inside a fence it cannot close.
	if _, err := srv.Store.DB.Exec(`INSERT INTO job_logs (job_id, at, level, line) VALUES (?, ?, 'info', ?)`,
		job.ID, time.Now().UnixMilli(), "raw\r\nline \x1b[2Jcleared ````` five"); err != nil {
		t.Fatal(err)
	}
	raw := strings.Split(strings.TrimSuffix(bob.mustDo("GET", fmt.Sprintf("/jobs/%d/log.md", job.ID), nil, http.StatusOK).Body.String(), "\n"), "\n")
	if len(raw) != 10 || raw[4] != "``````" || raw[9] != "``````" || !strings.HasSuffix(raw[8], "info     raw⏎line cleared ````` five") {
		t.Fatalf("the export with a raw line: %q", raw)
	}

	// A title that ends in a backtick keeps its code span whole.
	tick := bob.mustStart("test.lines", map[string]any{"tag": "tick", "subject": "the `quoted`"})
	bob.waitJob(tick.ID, "succeeded")
	head, _, _ := strings.Cut(bob.mustDo("GET", fmt.Sprintf("/jobs/%d/log.md", tick.ID), nil, http.StatusOK).Body.String(), "\n")
	if want := fmt.Sprintf("# Job #%d — `` test.lines: the `quoted` ``", tick.ID); head != want {
		t.Fatalf("heading %q, want %q", head, want)
	}
}

func TestPastJobsHoldWhatRanInARequestAndThirtyDaysOfIt(t *testing.T) {
	t.Setenv(outbound.EnvVar, "1")
	srv := newTestServer(t)
	q := queueing(t, srv)
	outbound.SetObserver(q.lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	// A lookup runs in its request, and is kept as a job when it ends. The
	// list is read again until it shows, as the screen reads it again.
	bob.do("POST", "/books/lookup", map[string]string{"title": "Dune"})
	var lookup *wireJob
	for deadline := time.Now().Add(20 * time.Second); lookup == nil && time.Now().Before(deadline); {
		past := bob.jobs("view=past")
		for i, j := range past.Jobs {
			if j.Kind == "lookup.book" {
				lookup = &past.Jobs[i]
			}
		}
	}
	if lookup == nil || lookup.Queued || !lookup.Own || lookup.Rerunnable {
		t.Fatalf("the lookup in bob's past jobs: %+v", lookup)
	}
	if cur := bob.jobs("view=current"); len(cur.Jobs) != 0 {
		t.Fatalf("a lookup in the queue: %+v", cur.Jobs)
	}

	// Thirty days: a job finished 31 days ago is gone from the list before the
	// prune gets to it; one finished 29 days ago is there.
	old := func(days int) int64 {
		at := time.Now().Add(-time.Duration(days) * 24 * time.Hour).UnixMilli()
		res, err := srv.Store.DB.Exec(`INSERT INTO jobs (user_id, username, kind, state, created_at, finished_at)
			VALUES (?, 'bob', 'fill', 'succeeded', ?, ?)`, accountID(t, alice, "bob"), at, at)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		return id
	}
	gone, kept := old(31), old(29)
	// Still there to open by its id, until a prune takes it.
	bob.mustDo("GET", fmt.Sprintf("/jobs/%d", gone), nil, http.StatusOK)
	list := jobIDs(bob.jobs("view=past&kind=fill&prune=1").Jobs)
	if slices.Contains(list, gone) || !slices.Contains(list, kept) {
		t.Fatalf("bob's past fills: %v, want %d and not %d", list, kept, gone)
	}
	// The tab's first read asked for the prune, and it takes the old job with
	// no timer: the last one ran with the server's first lines, under an hour
	// ago, so nothing else would have run one now.
	for deadline := time.Now().Add(20 * time.Second); bob.do("GET", fmt.Sprintf("/jobs/%d", gone), nil).Code != http.StatusNotFound; {
		if time.Now().After(deadline) {
			t.Fatalf("job %d, finished 31 days ago, was never pruned", gone)
		}
		time.Sleep(10 * time.Millisecond)
	}
	bob.mustDo("GET", fmt.Sprintf("/jobs/%d", kept), nil, http.StatusOK)
	// The state chips: the lookup under its own state, and nothing under one no
	// job of bob's is in.
	if list := jobIDs(bob.jobs("view=past&state=stopped," + lookup.State).Jobs); !slices.Contains(list, lookup.ID) || slices.Contains(list, kept) {
		t.Fatalf("stopped or %s: %v, want the lookup (%d) and not the fill", lookup.State, list, lookup.ID)
	}
	if list := jobIDs(bob.jobs("view=past&state=stopped,interrupted").Jobs); len(list) != 0 {
		t.Fatalf("stopped or interrupted: %v", list)
	}
	bob.mustDo("GET", "/jobs?view=past&state=done", nil, http.StatusBadRequest)
}

func TestAServerShuttingDownStartsNothing(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Jobs.Close(ctx)
	rec := alice.startJob("test.lines", map[string]any{"tag": "late"})
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("a job started as the server shuts down: %d %s, want 503", rec.Code, rec.Body)
	}
	shaped(t, "the 503", rec.Body.Bytes(), "error")
}

func TestAServerWithNoQueueStartsNothing(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	alice.mustDo("POST", "/jobs", map[string]any{"kind": "fill", "params": map[string]any{"book_ids": []int{1}}}, http.StatusServiceUnavailable)
	if list := alice.jobs("view=current"); len(list.Jobs) != 0 {
		t.Fatalf("jobs on a server with no queue: %+v", list)
	}
}

// Deleting a reader stops their jobs before the account goes — the waiting one at
// once, the running one after the item in hand — and the admin still has both,
// stopped, with their logs.
func TestDeletingAReaderStopsTheirJobs(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")

	running := bob.mustStart("test.hold", map[string]any{"tag": "running"})
	bob.waitJob(running.ID, "running")
	waiting := bob.mustStart("test.hold", map[string]any{"tag": "waiting"})
	others := carol.mustStart("test.hold", map[string]any{"tag": "carol's"})

	alice.mustDo("DELETE", fmt.Sprintf("/admin/users/%d", accountID(t, alice, "bob")), nil, http.StatusOK)
	for _, id := range []int64{running.ID, waiting.ID} {
		j := alice.waitJob(id, "stopped")
		if j.Username != "bob" || j.Own {
			t.Fatalf("a deleted reader's job, as the admin sees it: %+v", j)
		}
	}
	// Carol's job was never his, and runs once his has stopped.
	carol.waitJob(others.ID, "running")
	var text []string
	for _, l := range decode[struct {
		Lines []struct {
			Line string `json:"line"`
		} `json:"lines"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/jobs/%d", waiting.ID), nil, http.StatusOK)).Lines {
		text = append(text, l.Line)
	}
	if !slices.Contains(text, "stopped before it started: the account that started it is being deleted") {
		t.Fatalf("the waiting job's log does not say why it stopped: %q", text)
	}
}
