package httpapi

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync/atomic"
	"testing"
	"time"
	"tippani/internal/jobs"
	"tippani/internal/metadata"
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
//     that logs lines, one that fails, one that takes a moment to let go once it
//     is stopped, one that will not stop until let go, and one that says when it
//     has been stopped and lets go only when the test lets it, so a press can
//     land while a delete waits on it. A real kind's run
//     goes to the suppliers, and nothing a person does holds a job mid-item on
//     demand;
//   - the six built-in kinds' rules — who may start them, their validators, their
//     counts and the re-verify's review — reached through builtinJobKinds and
//     registered under a test name with a run of the test's (realKind), which
//     stores a result in the shape the kind's own run stores it, because those
//     rules are what is under test and the runs are not;
//   - how long deleting an account waits for a job that will not stop
//     (ownerJobWait), shortened in the one test that waits it out, so that test
//     takes a fifth of a second and not ten;
//   - the wire field names, which are the contract the SPA is built to: a test of
//     a contract has to name the fields it holds the server to;
//   - one test closes the queue as shutdown closes it (srv.Jobs.Close), since no
//     request shuts the server down;
//   - three tests write a row straight into the journal: a job finished 31 days
//     ago, which no request can make; a re-verify check whose from_job the apply
//     names, a kind only its own run makes; and a log line that never passed the
//     logbook's door, as a hand-made archive's journal carried over by a restore
//     would hold one.
//
// What each one guards, in a sentence a person would say: a job reads the same
// on every screen that shows it, field for field; each kind's counts are the ones
// its screens read, and a count's text keeps no key; a re-verify's review opened
// after the library moved shows each field as it is now and marks what changed
// since the check; one job runs at a time and the rest wait in the order
// started, each saying how many are ahead of it, anybody's counted and nobody's
// shown; a reader sees their own jobs only, their Jobs tile included, and an
// admin sees everybody's under the name each was started as; an admin can stop a
// reader's job and a reader cannot stop another's; Stop all stops what the one
// pressing it may see; only a job's owner can run it again, and an admin's kind
// asks again whether they are still an admin, and offers a former admin no
// Rerun of one; a check reads applied only while its apply waits or runs, or once
// it has succeeded; a sixth job and the same job twice
// are refused with the reason and the number or the job; every kind's params are
// held to its cap and its checks, and a backup's password is checked before
// anything queues and kept out of the job; a finished job's log downloads as
// Markdown whose block no line can leave; past jobs hold what ran in a request
// and thirty days of it; deleting a reader stops their jobs, waits for the one
// running to let go, refuses while it will not, starts nothing they ask for
// meanwhile, and keeps the jobs for the admin; a server shutting down starts
// nothing. (That a Stop is instant and leaves every item whole or untouched, in
// every kind, is stop_kill_switch_test.go's.)

// testQueue is the server's queue with the test's kinds on it.
type testQueue struct {
	t       *testing.T
	srv     *Server
	lb      *jobs.Logbook
	release chan struct{}
	done    chan struct{}
}

// queueing gives srv a queue as serve() does, and the test's kinds. A server
// newTestServer made has its queue already, and the kinds join that one.
func queueing(t *testing.T, srv *Server) *testQueue {
	t.Helper()
	lb := keeping(t, srv)
	if srv.Jobs == nil {
		srv.Jobs = jobs.NewRunner(srv.Store, lb, jobs.Options{})
		srv.RegisterJobKinds()
	}
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
// Stop between waits as a real kind checks between items. It holds nothing on
// the wire, so a Stop reaches it at its next check, a few milliseconds on.
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
				j.Log(jobs.LevelInfo, "stopped between waits")
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
	Carried    bool           `json:"carried"`
	Applied    bool           `json:"applied"`
	RerunOf    *int64         `json:"rerun_of"`
	FromJob    *int64         `json:"from_job"`
	CreatedAt  int64          `json:"created_at"`
	StartedAt  *int64         `json:"started_at"`
	FinishedAt *int64         `json:"finished_at"`
}

// jobFields is the wire contract's job, every field.
var jobFields = []string{"id", "kind", "queued", "subject", "state", "params", "counts", "error", "total", "done",
	"ahead", "username", "own", "rerunnable", "carried", "applied", "rerun_of", "from_job", "created_at", "started_at", "finished_at"}

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

// jobEnded polls a job, as its screen does, until it has ended, whichever way it
// ended.
func (c *testClient) jobEnded(id int64) wireJob {
	c.t.Helper()
	deadline := time.Now().Add(60 * time.Second)
	for {
		j := c.job(id)
		if j.State != "queued" && j.State != "running" {
			return j
		}
		if time.Now().After(deadline) {
			c.t.Fatalf("job %d is still %s", id, j.State)
		}
		time.Sleep(5 * time.Millisecond)
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
	if !slices.Contains(text, "alice pressed Stop") {
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
	// Not offered, in the job's poll or in his past jobs: a Rerun he may not press
	// is not drawn.
	for _, id := range []int64{adm.ID, backup.ID} {
		if bob.job(id).Rerunnable {
			t.Fatalf("a former admin is offered a rerun of his admin's job %d", id)
		}
	}
	for _, j := range bob.jobs("view=past").Jobs {
		if (j.ID == adm.ID || j.ID == backup.ID) && j.Rerunnable {
			t.Fatalf("a former admin's past jobs offer a rerun of %d", j.ID)
		}
	}
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

	// fill: 2000 works, counted once each, in order. The lists themselves are
	// not in the job's JSON (jobs_contract_test.go says why); the count is.
	refused(bob, "test.fill", map[string]any{"book_ids": upTo(1500), "movie_ids": upTo(501)}, 400, "at most 2000")
	refused(bob, "test.fill", map[string]any{"book_ids": []int64{0}}, 400, "positive")
	refused(bob, "test.fill", map[string]any{}, 400, "nothing to fill")
	fill := bob.mustStart("test.fill", map[string]any{"book_ids": []int64{3, 1, 3}, "movie_ids": upTo(1998)})
	if fill.Total != 2000 {
		t.Fatalf("the fill: total %d, want 1 and 3 once each and 1998 films", fill.Total)
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
	// The two spellings of Le Guin are one person: 400 + 99 + 1.
	rv := bob.mustStart("test.reverify", map[string]any{"book_ids": upTo(400), "movie_ids": upTo(99), "people": people, "fills_only": true})
	if rv.Total != 500 || rv.Params["fills_only"] != true {
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
	refused(bob, "test.reverify-apply", map[string]any{"items": []any{item, map[string]any{"type": "book", "id": 2, "set": "year"}}},
		400, "item 2 could not be read")
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
	// An apply that ended before it finished leaves the check to review again;
	// one waiting to run, or one that succeeded, does not.
	stop(bob, apply)
	if bob.job(bobsCheck).Applied {
		t.Fatal("a check reads applied after its apply was stopped part-way")
	}
	ahead := bob.mustStart("test.fill", map[string]any{"book_ids": []int64{7}})
	bob.waitJob(ahead.ID, "running")
	waitingApply := bob.mustStart("test.reverify-apply", map[string]any{"items": many[:1], "from_job": bobsCheck})
	if !bob.job(bobsCheck).Applied {
		t.Fatal("a check whose apply is waiting to run does not read applied")
	}
	stop(bob, waitingApply)
	if bob.job(bobsCheck).Applied {
		t.Fatal("a check reads applied after its apply was stopped before it started")
	}
	stop(bob, ahead)
	applied := bob.mustStart("test.reverify-apply", map[string]any{"items": many[:1], "from_job": bobsCheck})
	bob.waitJob(applied.ID, "running")
	q.let()
	bob.waitJob(applied.ID, "succeeded")
	if !bob.job(bobsCheck).Applied {
		t.Fatal("a check does not read applied after its apply succeeded")
	}

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

// Deleting a reader stops their jobs before the account goes — the waiting one
// before it starts, the running one at once, and the delete waits for it to let
// go — and the admin still has both, stopped, with their logs.
func TestDeletingAReaderStopsTheirJobs(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	// A job that takes a moment to let go once it is stopped, as a run finishing a
	// database write it had begun does.
	srv.addJobKind(queuedKind{name: "test.slowstop", validate: testParams, run: func(_ *Server, _ context.Context, j *jobs.Job) error {
		for !j.Stopping() {
			time.Sleep(5 * time.Millisecond)
		}
		time.Sleep(300 * time.Millisecond)
		j.Log(jobs.LevelInfo, "finished the item in hand")
		return nil
	}})
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	carol := addUser(t, h, alice, "carol")

	running := bob.mustStart("test.slowstop", map[string]any{"tag": "running"})
	bob.waitJob(running.ID, "running")
	waiting := bob.mustStart("test.hold", map[string]any{"tag": "waiting"})
	others := carol.mustStart("test.hold", map[string]any{"tag": "carol's"})

	alice.mustDo("DELETE", fmt.Sprintf("/admin/users/%d", accountID(t, alice, "bob")), nil, http.StatusOK)
	// Read once, straight after the delete answered: by then the job has let go,
	// not only been stopped.
	for _, id := range []int64{running.ID, waiting.ID} {
		if j := alice.job(id); j.State != "stopped" || j.Username != "bob" || j.Own {
			t.Fatalf("a deleted reader's job as the admin sees it once the delete has answered: %+v", j)
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

// A reader whose running job will not let go of its item in time is not deleted:
// the admin is told the job has been asked to stop and to press again, and the
// account is still there until it has. Pressed again once the job has ended, the
// delete goes ahead.
func TestDeletingAReaderWhoseJobWillNotStopWaitsForIt(t *testing.T) {
	old := ownerJobWait
	ownerJobWait = 200 * time.Millisecond
	t.Cleanup(func() { ownerJobWait = old })
	srv := newTestServer(t)
	q := queueing(t, srv)
	letGo := make(chan struct{})
	srv.addJobKind(queuedKind{name: "test.stubborn", validate: testParams, run: func(_ *Server, _ context.Context, j *jobs.Job) error {
		select {
		case <-letGo:
		case <-q.done:
		}
		return nil
	}})
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := accountID(t, alice, "bob")

	job := bob.mustStart("test.stubborn", map[string]any{"tag": "stubborn"})
	bob.waitJob(job.ID, "running")
	rec := alice.do("DELETE", fmt.Sprintf("/admin/users/%d", bobID), nil)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "has been stopped") {
		t.Fatalf("deleting a reader whose job will not stop: %d %s, want 409", rec.Code, rec.Body)
	}
	if accountID(t, alice, "bob") != bobID {
		t.Fatal("the account went although its job was still running")
	}
	if j := bob.job(job.ID); j.State != "running" {
		t.Fatalf("the job after the refused delete: %s, want still running", j.State)
	}
	// Still a reader, so still one who can start a job, which waits its turn.
	after := bob.mustStart("test.lines", map[string]any{"tag": "after the refused delete"})
	close(letGo)
	// It never asked whether it had been stopped, and the item it would not let
	// go of was all it had, so it ends having done everything: succeeded, not
	// stopped (the runner's finish says why).
	bob.waitJob(job.ID, "succeeded")
	bob.waitJob(after.ID, "succeeded")
	alice.mustDo("DELETE", fmt.Sprintf("/admin/users/%d", bobID), nil, http.StatusOK)
}

// A job the reader being deleted asks for while the delete waits on their running
// one is refused — their session still works until the account goes — and
// nothing runs for them once it has: the admin has their one job, stopped, and no
// other.
func TestAJobAskedForWhileTheAccountIsBeingDeletedIsRefused(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	// A job that says when it has been asked to stop and then finishes its item
	// only when the test lets it, so the job asked for lands inside the delete.
	asked, finish := make(chan struct{}), make(chan struct{})
	srv.addJobKind(queuedKind{name: "test.asked", validate: testParams, run: func(_ *Server, _ context.Context, j *jobs.Job) error {
		for !j.Stopping() {
			select {
			case <-q.done:
				return nil
			case <-time.After(5 * time.Millisecond):
			}
		}
		close(asked)
		select {
		case <-finish:
		case <-q.done:
		}
		return nil
	}})
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	bobID := accountID(t, alice, "bob")
	running := bob.mustStart("test.asked", map[string]any{"tag": "running"})
	bob.waitJob(running.ID, "running")

	deleted := make(chan int, 1)
	go func() { deleted <- alice.do("DELETE", fmt.Sprintf("/admin/users/%d", bobID), nil).Code }()
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the delete never asked bob's job to stop")
	}
	rec := bob.startJob("test.lines", map[string]any{"tag": "asked for during the delete"})
	close(finish)
	if code := <-deleted; code != http.StatusOK {
		t.Fatalf("the delete: %d", code)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a job bob asked for while his account was being deleted: %d %s, want 400", rec.Code, rec.Body)
	}
	if j := alice.job(running.ID); j.State != "stopped" || j.Username != "bob" {
		t.Fatalf("bob's running job once the delete answered: %+v", j)
	}
	for _, view := range []string{"current", "past"} {
		for _, j := range alice.jobs("view=" + view).Jobs {
			if j.ID != running.ID {
				t.Fatalf("a job in the admin's %s jobs besides bob's one: %+v", view, j)
			}
		}
	}
}

// WHAT EACH JOB IS ABOUT, AS PAST JOBS NAMES IT.
//
// A lookup a reader makes is kept as a job in its request, and the row names what
// was looked up — the title, the ISBN, the name the reader typed — so that "Book
// lookup · Dune" can be told from "Book lookup · Emma" in Settings › Jobs. A
// queued job about one work or one person is named after it; one about several
// is named after nothing, and the screen counts them.
//
// Every request goes through the handler as the screens send it, with the
// server offline (TIPPANI_OFFLINE), so every lookup's outward call is refused and
// logged — which is what keeps a lookup as a job at all — and nothing reaches a
// supplier. Past jobs is read as the Jobs tab reads it (GET /jobs?view=past).
//
// WHAT IT KNOWS, declared because a test here may not know the code: the logbook
// and the outbound hook are given to the server as serve() gives them (the
// queue's logbook, outbound.SetObserver), and the log is flushed before Past jobs
// is read (flushed), since a request's job lands in the logbook's next batch; the
// film's cast is fetched from a TheTVDB stub (suicideSquad) before the server
// goes offline; and the job kinds' names and the wire fields of a job, which are
// the contract Settings › Jobs is built to.
//
// What it guards, in a sentence a person would say: each lookup I make is kept
// under what I looked up, and a job about one thing is kept under that thing —
// when the thing is mine: a job given another reader's id is kept under nothing,
// and my Past jobs never names what is theirs.
func TestEachJobIsKeptUnderWhatItIsAbout(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	outbound.SetObserver(q.lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	h := srv.Handler()
	alice := signupAdmin(t, h)
	film := suicideSquad(t, srv, alice)
	var waller int64
	for _, row := range castOf(t, alice, "/movies/"+itoa(film)+"/cast").Cast {
		if row.Character == "Amanda Waller" {
			waller = row.ID
		}
	}
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	emma := createdID(t, alice, "/books", map[string]any{"title": "Emma", "author": "Jane Austen"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	leGuin := recordID(t, alice, "Ursula K. Le Guin")
	t.Setenv(outbound.EnvVar, "1")

	// The lookups a reader makes, one at a time, each answered however a
	// refused supplier makes it answer.
	for _, req := range []struct {
		path string
		body any
	}{
		{"/books/lookup", map[string]any{"title": "Dune", "isbn": duneISBN}},
		{"/books/lookup", map[string]any{"isbn": messiahISBN}},
		{"/movies/lookup", map[string]any{"title": "Suicide Squad"}},
		{"/images/search", map[string]any{"kind": "portrait", "name": "Viola Davis", "title": "Suicide Squad"}},
		{"/images/search", map[string]any{"kind": "cover", "title": "Emma", "isbn": messiahISBN}},
		{"/people/portrait", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}},
		{"/people/lookup", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}},
		{"/metadata/reverify", map[string]any{"book_ids": []int64{dune}}},
		{"/cast/" + itoa(waller) + "/image", nil},
		{"/movies/" + itoa(film) + "/cast/imdb", map[string]any{"imdb": "https://www.imdb.com/title/tt1386697/"}},
		{"/people/id/" + itoa(leGuin) + "/fetch", nil},
		{"/people/id/" + itoa(leGuin) + "/signature/fetch", nil},
		{"/movies/" + itoa(film) + "/cast/art", map[string]any{"names": []string{"Viola Davis"}}},
	} {
		alice.do("POST", req.path, req.body)
	}
	// The queued ones, each waited out before the next, as five at once is a
	// reader's limit.
	for _, start := range []struct {
		kind   string
		params map[string]any
	}{
		{"fill", map[string]any{"book_ids": []int64{dune}}},
		{"fill", map[string]any{"book_ids": []int64{dune, emma}}},
		{"people", map[string]any{"ids": []int64{leGuin}}},
		{"reverify", map[string]any{"people": []map[string]string{{"kind": "author", "name": "Ursula K. Le Guin"}}}},
		{"reverify", map[string]any{"book_ids": []int64{dune}, "movie_ids": []int64{film}}},
		{"covers", map[string]any{"missing_only": true}},
	} {
		j := alice.mustStart(start.kind, start.params)
		alice.waitJob(j.ID, "succeeded")
	}
	flushed(t, q.lb)

	kept := map[string][]string{}
	for _, j := range alice.jobs("view=past&limit=200").Jobs {
		kept[j.Kind] = append(kept[j.Kind], j.Subject)
	}
	for _, want := range []struct{ kind, subject string }{
		{"lookup.book", "Dune"},
		{"lookup.book", messiahISBN},
		{"lookup.movie", "Suicide Squad"},
		{"lookup.images", "Viola Davis"},
		{"lookup.images", "Emma"},
		{"lookup.portrait", "Ursula K. Le Guin"},
		{"lookup.links", "Ursula K. Le Guin"},
		{"lookup.reverify", "Dune"},
		{"lookup.cast-image", "Amanda Waller"},
		{"lookup.cast-imdb", "tt1386697"},
		{"lookup.cast-tvdb", "Suicide Squad"},
		{"lookup.person", "Ursula K. Le Guin"},
		{"lookup.signature", "Ursula K. Le Guin"},
		{"lookup.cast-art", "Suicide Squad"},
		{"fill", "Dune"},
		{"fill", ""},
		{"people", "Ursula K. Le Guin"},
		{"reverify", "Ursula K. Le Guin"},
		{"reverify", ""},
		{"covers", ""},
	} {
		if !slices.Contains(kept[want.kind], want.subject) {
			t.Errorf("no %s job kept under %q; the %s jobs are under %q", want.kind, want.subject, want.kind, kept[want.kind])
		}
	}
	// Two works, and neither is named: the screen says "2 works" itself.
	if fills := kept["fill"]; len(fills) != 2 || slices.Contains(fills, "Emma") {
		t.Errorf("the fill jobs are under %q", fills)
	}
	if t.Failed() {
		var all []string
		for k, v := range kept {
			all = append(all, fmt.Sprintf("%s=%q", k, v))
		}
		slices.Sort(all)
		t.Log("every job kept:\n" + strings.Join(all, "\n"))
	}
}

// ANOTHER READER'S WORK IS NOT NAMED. Bob, holding the ids of alice's book, film
// and author (a stale link, a guessed number), starts a fill of each work, a
// check of the book and a fetch of the author. Each job is his to see, and each
// is kept under nothing: a job's subject is what Past jobs shows, and a title
// read without asking whose it is would tell him what alice has.
func TestAJobGivenAnotherReadersIDIsNotNamedAfterWhatItFound(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"})
	arrival := createdID(t, alice, "/movies", map[string]any{"title": "Arrival", "media_type": "movie"})
	alice.mustDo("PUT", "/people", map[string]any{"kind": "author", "name": "Ursula K. Le Guin"}, http.StatusOK)
	leGuin := recordID(t, alice, "Ursula K. Le Guin")

	for _, start := range []struct {
		kind   string
		params map[string]any
	}{
		{"fill", map[string]any{"book_ids": []int64{dune}}},
		{"fill", map[string]any{"movie_ids": []int64{arrival}}},
		{"reverify", map[string]any{"book_ids": []int64{dune}}},
		{"people", map[string]any{"ids": []int64{leGuin}}},
	} {
		j := bob.mustStart(start.kind, start.params)
		if j.Subject != "" {
			t.Errorf("bob's %s of alice's id is kept under %q", start.kind, j.Subject)
		}
		bob.waitJob(j.ID, "succeeded")
	}
	past := bob.jobs("view=past&limit=50").Jobs
	if len(past) != 4 {
		t.Fatalf("bob's Past jobs: %d, want his four", len(past))
	}
	for _, j := range past {
		if j.Subject != "" {
			t.Errorf("bob's Past jobs shows his %s as %q", j.Kind, j.Subject)
		}
	}
}

// THE JOBS LIST, AS THE SCREENS READ IT (the wire contract's addendum).
//
// Settings › Jobs pages Past jobs by the smallest id it has, newest first; the
// Metadata and People screens ask Current jobs for one kind, to show a run
// already under way rather than start another; and Current jobs is read every
// two seconds while anything runs, so a job's JSON carries its params without
// the lists it was given. Everything is driven through the API as the screens
// drive it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the queue
// is given to the server as serve() gives it, with the test's kinds (queueing,
// jobs_api_test.go), and the fill kind's rules run under a test name with a run
// that holds (realKind), so its job can be read while it waits; the book
// supplier's seam (srv.searchBooks, duneSupplier) for the one real fill; the
// wire fields, which are the contract; and the table of the kinds a request is
// kept under (jobKinds) and the kinds a person can start (builtinJobKinds),
// held to the contract's list of the names the screens have words for, because
// a kind is data that no request lists.
//
// What each one guards, in a sentence a person would say: Past jobs pages from
// the newest, a page at a time, with nothing twice and nothing missed; asking
// Current jobs for one kind shows only that kind, each marked as mine or not; a
// job's JSON carries what it was asked in a word and not the lists it was given,
// wherever it is shown, and running it again still runs it over those lists;
// and every kind the server keeps a job under is one the screens can name.

func TestPastJobsPageFromTheNewestWithNothingTwice(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	var made []int64
	for i := 0; i < 5; i++ {
		made = append(made, alice.waitJob(alice.mustStart("test.lines", map[string]any{"tag": fmt.Sprint(i)}).ID, "succeeded").ID)
	}
	slices.Reverse(made)

	var seen []int64
	query := "view=past&kind=test.lines&limit=2"
	for page := 0; ; page++ {
		got := alice.jobs(query)
		ids := jobIDs(got.Jobs)
		if page > 3 || len(ids) == 0 {
			t.Fatalf("page %d: %v (more %t)", page, ids, got.More)
		}
		seen = append(seen, ids...)
		if !got.More {
			break
		}
		// The next page starts below the smallest id this one has.
		query = fmt.Sprintf("view=past&kind=test.lines&limit=2&before=%d", ids[len(ids)-1])
	}
	if !slices.Equal(seen, made) {
		t.Fatalf("paged past jobs %v, want every one newest first, once: %v", seen, made)
	}
}

func TestAJobsJSONCarriesNoListItWasGivenAndARerunStillRunsOverThem(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	srv.addJobKind(realKind(t, "fill", "test.fill", q.hold))
	duneSupplier(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)

	noLists := func(where string, j wireJob) {
		t.Helper()
		for k, v := range j.Params {
			if _, isList := v.([]any); isList {
				t.Errorf("%s: job #%d's params carry the list %s", where, j.ID, k)
			}
		}
	}
	held := alice.mustStart("test.fill", map[string]any{"book_ids": []int64{1, 2, 3}, "movie_ids": []int64{4}})
	alice.waitJob(held.ID, "running")
	check := alice.mustStart("reverify", map[string]any{"book_ids": []int64{9}, "fills_only": true})
	noLists("POST /jobs", held)
	noLists("POST /jobs", check)
	noLists("GET /jobs/{id}", alice.job(held.ID))
	for _, j := range alice.jobs("view=current").Jobs {
		noLists("GET /jobs?view=current", j)
	}
	summary := decode[struct {
		Running wireJob `json:"running"`
	}](t, alice.mustDo("GET", "/jobs/summary", nil, http.StatusOK))
	noLists("GET /jobs/summary", summary.Running)
	// What the screens read of params is still there, and the size of a list is
	// the job's total.
	if held.Total != 4 || check.Params["fills_only"] != true {
		t.Fatalf("the fill's total %d and the check's params %v", held.Total, check.Params)
	}
	q.let()
	alice.waitJob(check.ID, "succeeded")

	// Run again, a job still runs over the lists it was given: a fill of Dune,
	// its year taken away after, fills it again.
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	fill := alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": []int64{dune}}).ID, "succeeded")
	year := func() int {
		return decode[struct {
			Year int `json:"published_year"`
		}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)).Year
	}
	alice.mustDo("PUT", fmt.Sprintf("/books/%d", dune), map[string]any{"title": "Dune", "author": "Frank Herbert",
		"isbn": duneISBN, "published_year": 0, "pages": 0}, http.StatusOK)
	if year() != 0 {
		t.Fatalf("Dune's year after it was taken away: %d", year())
	}
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, alice.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", fill.ID), nil, http.StatusAccepted)).Job
	alice.waitJob(again.ID, "succeeded")
	if year() != 1965 {
		t.Fatalf("Dune's year after the fill ran again: %d, want it filled again", year())
	}
}

// contractKinds is the addendum's list of the kinds the screens have words for;
// a job of any other kind shows as "Job".
var contractKinds = []string{
	"fill", "covers", "people", "reverify", "reverify-apply", "backup", "backup.safety", "import", "import.approve", "library.scan", "restore",
	"reset", "update.check", "update.apply", "metadata.test", "notify.test", "notify.daily", "signin.oidc",
	"work.save", "person.save", "character.save", "request", "lookup.book", "lookup.movie", "lookup.images",
	"lookup.portrait", "lookup.links", "lookup.person", "lookup.reverify", "lookup.cast-image",
	"lookup.cast-imdb", "lookup.cast-tvdb", "lookup.cast-art", "lookup.signature",
}

func TestEveryKindTheServerKeepsAJobUnderIsOneTheScreensCanName(t *testing.T) {
	for pattern, kind := range jobKinds {
		if !slices.Contains(contractKinds, kind) {
			t.Errorf("%s is kept as %q, which no screen has words for", pattern, kind)
		}
	}
	for _, k := range builtinJobKinds {
		if !slices.Contains(contractKinds, k.name) {
			t.Errorf("the queued kind %q is not one the screens have words for", k.name)
		}
		if k.run == nil {
			t.Errorf("the queued kind %q has no run, so POST /jobs refuses it", k.name)
		}
	}
}

// AN ADMIN BACKS UP AND RESTORES, AND THE SERVER'S JOB HISTORY STAYS THE SERVER'S:
// the archive they download carries none of it, and the restore keeps what the
// server had, including what happened after the archive was made.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the journal
// tables' names and columns (jobs, job_logs, system_logs). It writes its rows
// through srv.Store.DB because no request can make them: one is a job reading
// running when the restore comes, which a server with a queue never lets happen
// (the restore waits for a running job to end), so this server stops its queue
// once the two archives are made — each is a queued job, as every backup is — and
// the row is written as a crash would leave it; and the marker it looks for has
// to sit in a job's subject, one of that job's lines and a request line, which
// keeps no value a request carries. It
// reads the tables inside each archive, opened with plaintextOf (this package's
// way of opening a sealed archive the way a person with the password would),
// because the claim is about the file the admin downloaded and nothing but
// opening it can show what its tables hold. What the server kept is read back
// through the API, as the reader and the admin see it once signed in again. The
// backups, the download, the safety copy and the restore are driven through the
// API as an admin drives them. The owner rules the carry-over applies are tested
// one by one in internal/store; this is the path they run on.
//
// And for the waiting job a Stop reached before its row could say so: the
// journey tier's seam TIPPANI_JOBS_HOLD (with TIPPANI_OFFLINE, which it needs),
// so the job is still waiting when the restore comes, since offline it would have
// run in milliseconds; and a write of the test's own on srv.Store.DB holding
// SQLite's lock while Stop is pressed, as a running import's transaction holds it,
// which is what leaves the Stop in the queue's memory with its row still owed.

// A string nothing else in a library contains, so finding it in an archive's
// bytes means a journal row rode along.
const archiveMarker = "Wv-archive-journal-marker-5540"

func TestABackupLeavesTheJobHistoryBehindAndARestoreKeepsTheServersOwn(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	addUser(t, h, admin, "bob")
	var bobID int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'bob'`).Scan(&bobID); err != nil {
		t.Fatal(err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := srv.Store.DB.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	// Written at today's time, so the thirty days the API shows still hold them.
	now := time.Now().UnixMilli()
	exec(`INSERT INTO jobs (id, user_id, username, kind, subject, state, created_at, finished_at)
		VALUES (31, 1, 'alice', 'fill', ?, 'succeeded', ?, ?)`, archiveMarker+" subject", now, now)
	exec(`INSERT INTO job_logs (id, job_id, at, level, line) VALUES (501, 31, ?, 'info', ?)`, now, archiveMarker+" job line")
	exec(`INSERT INTO system_logs (id, at, level, line) VALUES (601, ?, 'request', ?)`, now, archiveMarker+" request line")

	// The kept archive, as the Server card's Download hands it over.
	backupNow(admin)
	kept := admin.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()
	assertNoJournal(t, "the kept backup", plaintextOf(t, kept, testPw))

	// The safety copy the restore insists on first is an archive too.
	safety := takeSafetyCopy(t, admin, map[string]string{"passphrase": "safety-copy-1"})
	assertNoJournal(t, "the safety copy", plaintextOf(t, safety, "safety-copy-1"))

	// After the archives: bob starts a job that is still running when the restore
	// comes (the header's "this server stops its queue").
	unqueued(t, srv)
	const running = 132
	exec(`INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at)
		VALUES (?, ?, 'bob', 'covers', 'running', ?, ?)`, running, bobID, now, now)

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)

	// The restore signed everybody out; both are in the archive.
	signIn := func(name string) *testClient {
		c := &testClient{t: t, h: h}
		c.cookie = cookieOf(t, c.mustDo("POST", "/auth/login", map[string]string{"username": name, "password": testPw}, http.StatusOK))
		return c
	}
	alice, bob := signIn("alice"), signIn("bob")

	// The restore kept the server's history, not the archive's empty one — both
	// jobs, the one made after the archive included, under their own ids.
	type poll struct {
		Job   wireJob `json:"job"`
		Lines []struct {
			ID   int64  `json:"id"`
			Line string `json:"line"`
		} `json:"lines"`
	}
	// Four: the two written above, and the backup and the safety copy that made
	// the archives.
	if all := alice.jobs("view=past"); len(all.Jobs) != 4 || !slices.Contains(jobIDs(all.Jobs), 31) || !slices.Contains(jobIDs(all.Jobs), running) {
		t.Fatalf("past jobs after the restore: %v, want the server's four", jobIDs(all.Jobs))
	}
	finished := decode[poll](t, alice.mustDo("GET", "/jobs/31", nil, http.StatusOK))
	if j := finished.Job; j.State != "succeeded" || !j.Own {
		t.Fatalf("alice's finished job after the restore: %+v", j)
	}
	if l := finished.Lines; len(l) != 1 || l[0].ID != 501 || l[0].Line != archiveMarker+" job line" {
		t.Fatalf("alice's job's log after the restore: %+v, want its one line under its id", l)
	}
	// Bob is in the archive under the same id and name, so the job stays his; it
	// was running, and nothing resumes on its own.
	if j := bob.job(running); j.State != "interrupted" || !j.Own {
		t.Fatalf("bob's running job after the restore: %+v, want interrupted and still his", j)
	}
	carried := false
	for _, l := range alice.logs(url.Values{"all": {"1"}}).Lines {
		carried = carried || (l.ID == 601 && l.Line == archiveMarker+" request line")
	}
	if !carried {
		t.Fatal("the system log's line did not come through the restore under its id")
	}
}

// A WAITING JOB A STOP STOPPED READS STOPPED AFTER A RESTORE, NOT INTERRUPTED, when
// the Stop answered before its row could say so. The reader was told stopped —
// the press's own answer, and every read of the queue after it — and a restore
// that carried the row on as it was, still waiting, turned it into a job the
// restore interrupted.
//
// Mutation: the swap's write of the held rows (internal/jobs writeHeldBeforeSwap)
// made to do nothing: red, the job reads interrupted.
func TestAWaitingJobAStopStoppedReadsStoppedAfterARestore(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	backupNow(admin)
	safetyBackup(t, admin)

	t.Setenv(outbound.EnvVar, "1")
	t.Setenv(jobs.HoldEnv, "1")
	w := admin.mustStart("test.hold", map[string]any{"tag": "waiting"})
	tx, err := srv.Store.DB.Begin() // _txlock=immediate: the lock is taken here
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', 'somebody else')`, time.Now().UnixMilli()); err != nil {
		t.Fatal(err)
	}
	pressed := time.Now().UnixMilli()
	stopped := decode[struct {
		Job wireJob `json:"job"`
	}](t, admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", w.ID), nil, http.StatusOK)).Job
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	if stopped.State != "stopped" {
		t.Fatalf("the Stop's own answer reads the job %s", stopped.State)
	}
	var row string
	if err := srv.Store.DB.QueryRow(`SELECT state FROM jobs WHERE id = ?`, w.ID).Scan(&row); err != nil || row != "queued" {
		t.Fatalf("the stopped job's row reads %q (%v) before the restore; the test needs it still owed", row, err)
	}
	// Its line written before the restore: a line still in the buffer when the
	// files are swapped is not this test's subject.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Logbook.Flush(ctx); err != nil {
		t.Fatal(err)
	}

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))

	got := again.job(w.ID)
	if got.State != "stopped" {
		t.Fatalf("after the restore the job its Stop stopped reads %s", got.State)
	}
	if got.FinishedAt == nil || *got.FinishedAt < pressed || *got.FinishedAt > pressed+5000 {
		t.Fatalf("it reads stopped at %v, want the moment of the press (%d)", got.FinishedAt, pressed)
	}
	if got.StartedAt != nil {
		t.Fatalf("the stopped job was started: %+v", got)
	}
	saying(t, jobLines(again, w.ID), "alice stopped it before it started")
}

// A JOB A RESTORE CARRIED OVER IS HISTORY: IT IS READ, AND NOTHING ACTS ON IT AGAIN.
// Its params name the replaced library's rows by id — the works a fill was
// given, the records a people fetch, the fields an apply writes, the staged
// quotes and batch bound an approval took — and in the restored library the same
// ids can be other rows. So after the restore none of the jobs from before it is
// offered Run again, or run again when asked, whatever its kind; a check's
// findings are not reviewed against the restored rows, nor applied in its name;
// an import stopped before the restore lets go of its upload, which nothing can
// run again; and a job made after the restore is its own, offered Run again as
// any is. Before the restore every one of them was offered Run again, which is
// what makes the after half mean something.
//
// Beyond the header: a finished job of each of the other kinds is written into
// the journal as its run leaves it (interrupted, or succeeded for the check,
// with the findings its run stores), since a real run of each goes to the
// suppliers; the import is a real upload, stopped while it waited behind the
// test's own job (queueing).
//
// Mutation: the carry's mark (store.CarriedThroughKey) not written: red, every
// job from before the restore is offered Run again.
func TestAJobARestoreCarriedOverIsNotRunAgainOrReviewed(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	book := decode[struct {
		ID int64 `json:"id"`
	}](t, admin.mustDo("POST", "/books", map[string]any{"title": "Dune", "author": "Frank Herbert"}, http.StatusCreated)).ID
	backupNow(admin)
	safetyBackup(t, admin)
	uid := accountID(t, admin, "alice")

	now := time.Now().UnixMilli()
	write := func(kind, state, params, result, counts string) int64 {
		t.Helper()
		var id int64
		if err := srv.Store.DB.QueryRow(`INSERT INTO jobs (user_id, username, kind, state, params, result, counts, created_at, started_at, finished_at)
			VALUES (?, 'alice', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`, uid, kind, state, params, result, counts, now, now, now).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	item := fmt.Sprintf(`{"type":"book","id":%d,"set":{"description":"A desert planet."}}`, book)
	before := map[string]int64{
		"fill":           write("fill", "interrupted", fmt.Sprintf(`{"book_ids":[%d],"movie_ids":[]}`, book), "", "{}"),
		"covers":         write("covers", "interrupted", `{"missing_only":false}`, "", "{}"),
		"people":         write("people", "interrupted", `{"ids":[1]}`, "", "{}"),
		"reverify-apply": write("reverify-apply", "interrupted", `{"items":[`+item+`]}`, "", "{}"),
		"backup":         write("backup", "interrupted", `{}`, "", "{}"),
		"import.approve": write("import.approve", "interrupted", `{"all":true,"through":1}`, "", "{}"),
		"reverify": write("reverify", "succeeded", fmt.Sprintf(`{"book_ids":[%d],"movie_ids":[],"people":[],"fills_only":false}`, book),
			fmt.Sprintf(`[{"type":"book","id":%d,"title":"Dune","status":"ok","diffs":[{"field":"description","stored":"","fresh":"A desert planet."}]}]`, book),
			`{"items":1,"changes":1}`),
	}
	// The import: waiting behind the test's own job, stopped there, its upload kept.
	ahead := admin.mustStart("test.hold", map[string]any{"tag": "ahead"})
	admin.waitJob(ahead.ID, "running")
	imp := queuedJob(t, admin.uploadOnly("/import/markdown", "sandworm.md", []byte(stagedBookMD)))
	admin.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", imp.ID), nil, http.StatusOK)
	q.let()
	admin.waitJob(ahead.ID, "succeeded")
	before["import"] = imp.ID

	for kind, id := range before {
		if j := admin.job(id); !j.Rerunnable || j.Carried {
			t.Fatalf("before the restore, the %s job is %+v; the test needs it offered Run again", kind, j)
		}
	}
	admin.mustDo("GET", fmt.Sprintf("/jobs/%d/result", before["reverify"]), nil, http.StatusOK)
	if left := spooled(t, srv); len(left) != 1 {
		t.Fatalf("the spool before the restore: %v, want the stopped import's upload", left)
	}

	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))

	for kind, id := range before {
		j := again.job(id)
		if !j.Own || !j.Carried || j.Rerunnable {
			t.Errorf("after the restore, the %s job from before it is %+v; want still alice's, carried, and not offered Run again", kind, j)
		}
		// A backup's rerun asks for the password again; the answer is the same.
		if rec := again.do("POST", fmt.Sprintf("/jobs/%d/rerun", id), map[string]any{"password": testPw}); rec.Code != http.StatusConflict {
			t.Errorf("Run again on the %s job from before the restore: %d %s, want 409", kind, rec.Code, rec.Body)
		}
	}
	if rec := again.do("GET", fmt.Sprintf("/jobs/%d/result", before["reverify"]), nil); rec.Code != http.StatusConflict ||
		!bytes.Contains(rec.Body.Bytes(), []byte("before the library was restored")) {
		t.Fatalf("the review of a check from before the restore: %d %s, want it refused", rec.Code, rec.Body)
	}
	if rec := again.startJob("reverify-apply", map[string]any{"items": []json.RawMessage{json.RawMessage(item)}, "from_job": before["reverify"]}); rec.Code != http.StatusBadRequest {
		t.Fatalf("an apply in the name of a check from before the restore: %d %s, want 400", rec.Code, rec.Body)
	}
	if left := spooled(t, srv); len(left) != 0 {
		t.Fatalf("the spool after the restore: %v, want the carried import's upload gone", left)
	}

	// A job made after the restore is offered Run again as any is.
	after := again.jobEnded(again.mustStart("test.fail", map[string]any{"tag": "after"}).ID)
	if after.Carried || !after.Rerunnable {
		t.Fatalf("a job made after the restore: %+v, want its own and offered Run again", after)
	}
	again.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", after.ID), nil, http.StatusAccepted)
}

// assertNoJournal opens the database inside a plaintext archive and checks that
// no journal row, and no byte of one, came along.
func assertNoJournal(t *testing.T, what string, plain []byte) {
	t.Helper()
	gz, err := gzip.NewReader(bytes.NewReader(plain))
	if err != nil {
		t.Fatalf("%s: gunzip: %v", what, err)
	}
	tr := tar.NewReader(gz)
	var dbBytes []byte
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("%s: tar: %v", what, err)
		}
		if hdr.Name == "tippani.db" {
			if dbBytes, err = io.ReadAll(tr); err != nil {
				t.Fatal(err)
			}
		}
	}
	if dbBytes == nil {
		t.Fatalf("%s: no tippani.db in the archive", what)
	}
	if bytes.Contains(dbBytes, []byte(archiveMarker)) {
		t.Fatalf("%s: the archive's database holds journal text", what)
	}
	path := filepath.Join(t.TempDir(), "tippani.db")
	if err := os.WriteFile(path, dbBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite", "file:"+path+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"jobs", "job_logs", "system_logs"} {
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil || n != 0 {
			t.Fatalf("%s: %s holds %d row(s) (%v)", what, table, n, err)
		}
	}
}

// AN ADMIN DELETES A READER, AND THE READER'S JOBS STAY — AS THE ADMIN'S.
//
// Driven the way a reader and an admin drive it: each starts a job through the
// jobs API, and the account is made, deleted and restored from the bin through
// the API.
//
// WHAT IT KNOWS, declared because a test here may not know the code: what
// jobs_api_test.go's header declares (the queue set up as serve() sets it, the
// test's own kinds, the wire field names), and the `jobs` table's name and its
// user_id and username columns, which it reads through srv.Store.DB. The claim is
// that the job belongs to nobody, and the wire cannot say that: an admin sees a
// job owned by nobody and one owned by another reader alike, as not hers, under
// the name it was started as. That it is not handed back when the account is is
// said on the wire too, and read there.
//
// The other delete path, `tippani user del`, has its own test in cmd/tippani; the
// trigger both rely on is 0079's, tested at the statement in internal/store.

func TestAnAdminDeletingAReaderLeavesTheirJobsToTheAdmin(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	bobsJob := bob.waitJob(bob.mustStart("test.lines", map[string]any{"tag": "bob's"}).ID, "succeeded")
	alicesJob := admin.waitJob(admin.mustStart("test.lines", map[string]any{"tag": "alice's"}).ID, "succeeded")
	aliceID := accountID(t, admin, "alice")

	admin.mustDo("DELETE", "/admin/users/"+itoa(accountID(t, admin, "bob")), nil, http.StatusOK)

	owner := func(id int64) (uid *int64, name string) {
		t.Helper()
		if err := srv.Store.DB.QueryRow(`SELECT user_id, username FROM jobs WHERE id = ?`, id).Scan(&uid, &name); err != nil {
			t.Fatalf("job %d after the delete: %v", id, err)
		}
		return uid, name
	}
	if uid, name := owner(bobsJob.ID); uid != nil || name != "bob" {
		t.Fatalf("bob's job after his account went: owned=%v username=%q, want no owner and his name kept", uid != nil, name)
	}
	if uid, _ := owner(alicesJob.ID); uid == nil || *uid != aliceID {
		t.Fatal("deleting bob changed the owner of alice's job")
	}
	// The admin still has it, with its log, under his name.
	if j := admin.job(bobsJob.ID); j.Username != "bob" || j.Own || j.State != "succeeded" {
		t.Fatalf("bob's job as the admin sees it after the delete: %+v", j)
	}

	// Putting the account back from the bin brings bob back under his old id, and
	// must not fail over the history it never took with it (the job table is not
	// in the account's snapshot, so there is no row to collide with) — nor hand the
	// job back: once let go, a job's owner is the admin.
	bin := binOf(t, admin).Trash
	if len(bin) != 1 || bin[0].Kind != "account" {
		t.Fatalf("admin's bin: %+v", bin)
	}
	restore(t, admin, bin[0].ID, http.StatusOK)
	if uid, _ := owner(bobsJob.ID); uid != nil {
		t.Fatalf("restoring bob's account re-attached his old job to id %d", *uid)
	}
	back := &testClient{t: t, h: h}
	back.cookie = cookieOf(t, back.mustDo("POST", "/auth/login", map[string]string{"username": "bob", "password": testPw}, http.StatusOK))
	back.mustDo("GET", fmt.Sprintf("/jobs/%d", bobsJob.ID), nil, http.StatusNotFound)
	if past := back.jobs("view=past"); len(past.Jobs) != 0 {
		t.Fatalf("bob, back from the bin, has jobs: %+v", past.Jobs)
	}
}

// WHAT AN ADMIN DOES TO THE WHOLE SERVER IS KEPT AS A JOB: a backup through the
// API, which queues as the Server card's does, and a safety copy, which queues
// too, and, though they run in their request, an update, a restore (the
// first-run one too) and a factory reset, each found afterwards in Past jobs.
//
// Driven through the API as the Server and Updates cards drive them, and read
// back through GET /jobs as Settings › Jobs reads it.
//
// WHAT IT KNOWS, declared: what jobs_api_test.go's header declares (the queue and
// its logbook set up as serve() sets them, the wire field names), and the
// update's Docker client stubbed as update_test.go stubs it (srv.newDocker).
//
// What each one guards, in a sentence a person would say: each of those is in
// Past jobs afterwards, as queued or as having run in its request, named after
// what it was about; a restore's and a reset's belong to nobody, since the account that
// pressed them belonged to the database they replaced, and an admin still sees
// them; a restore keeps the jobs from before it, and a reset keeps nothing but
// its own.

// pastJob waits for a job of kind to be in c's past jobs, as the list is read
// again until it shows, and returns the newest.
func pastJob(c *testClient, kind string) wireJob {
	c.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		if list := c.jobs("view=past&kind=" + kind).Jobs; len(list) > 0 {
			return list[0]
		}
		if time.Now().After(deadline) {
			c.t.Fatalf("no %s in past jobs", kind)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func jobKindsOf(list []wireJob) []string {
	var out []string
	for _, j := range list {
		out = append(out, j.Kind)
	}
	slices.Sort(out)
	return out
}

func TestWhatAnAdminDoesToTheWholeServerIsKeptAsAJob(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }
	h := srv.Handler()
	admin := signupAdmin(t, h)

	backupNow(admin)
	kept := decode[struct {
		Backup struct {
			Name string `json:"name"`
		} `json:"backup"`
	}](t, admin.mustDo("GET", "/admin/backup", nil, http.StatusOK)).Backup.Name
	safetyBackup(t, admin)

	// The API's backup is the Server card's job, queued like it, and the safety
	// copy is queued too.
	for _, kind := range []string{"backup", "backup.safety"} {
		j := pastJob(admin, kind)
		if !j.Queued || !j.Own || j.State != "succeeded" || j.Subject != "" || j.Username != "alice" {
			t.Fatalf("the %s in past jobs: %+v", kind, j)
		}
	}

	admin.mustDo("POST", "/admin/restore", map[string]string{"password": testPw}, http.StatusOK)
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))
	restore := pastJob(again, "restore")
	if restore.Queued || restore.Own || restore.Username != "alice" || restore.Subject != kept || restore.State != "succeeded" {
		t.Fatalf("the restore in past jobs: %+v, want alice's, belonging to nobody now, from %s", restore, kept)
	}
	// The history from before it is still there, and still hers: she is in the
	// archive under the same id and name.
	if j := pastJob(again, "backup"); !j.Own {
		t.Fatalf("the backup from before the restore: %+v", j)
	}

	safetyBackup(t, again)
	again.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
	fresh := signupAdmin(t, h)
	reset := pastJob(fresh, "reset")
	if reset.Own || reset.Username != "alice" || reset.State != "succeeded" {
		t.Fatalf("the reset in past jobs: %+v", reset)
	}
	if got := jobKindsOf(fresh.jobs("view=past").Jobs); !slices.Equal(got, []string{"reset"}) {
		t.Fatalf("past jobs after a factory reset: %v, want the reset alone", got)
	}

	// The update last, since a launched one shuts the queue until the server is
	// replaced, and a restore or a reset after it would be refused.
	fresh.mustDo("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}, http.StatusOK)
	if j := pastJob(fresh, "update.apply"); j.Queued || !j.Own || j.State != "succeeded" || j.Subject != fake.image || j.Username != "alice" {
		t.Fatalf("the update in past jobs: %+v", j)
	}
}

func TestTheFirstRunRestoreIsKeptAsAJob(t *testing.T) {
	old := newTestServer(t)
	oh := old.Handler()
	oldAdmin := signupAdmin(t, oh)
	backupNow(oldAdmin)
	archive := oldAdmin.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()

	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	anon := &testClient{t: t, h: h}
	if rec := anon.restoreUpload("/auth/restore/upload", pwUpload(), archive); rec.Code != http.StatusOK {
		t.Fatalf("the first-run restore: %d %s", rec.Code, rec.Body)
	}
	admin := &testClient{t: t, h: h}
	admin.cookie = cookieOf(t, admin.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))
	j := pastJob(admin, "restore")
	if j.Queued || j.Own || j.Username != "" || j.Subject != "backup"+backupExt || j.State != "succeeded" {
		t.Fatalf("the first-run restore in past jobs: %+v", j)
	}
	if n := len(admin.jobs(fmt.Sprintf("view=past&kind=%s", "restore")).Jobs); n != 1 {
		t.Fatalf("%d restores kept, want 1", n)
	}
}

// FILL GAPS, AS A JOB: a selection's Fill gaps, started as the screens start it
// (POST /jobs {kind: "fill"}), watched as Settings › Jobs watches it, and the
// library read back as its pages read it.
//
// WHAT IT KNOWS, declared because a test here may not know the code:
//   - the queue is given to the server as serve() gives it (queueing,
//     jobs_api_test.go), since no request starts the server;
//   - the book supplier is the server's seam (srv.searchBooks), because a test
//     may not reach Google Books or Open Library; one test holds it until its
//     request is cancelled, as a supplier that never answers would be, so that
//     Stop is pressed with a work in hand;
//   - Pushover is a stub of its API (newFakePushover), for the same reason, and
//     one test holds its answer, so that Stop is pressed after the last work;
//   - the job's wire fields, and the names of its counts, which are the contract
//     the screens are built to: the SPA's jobs.js reads counts by those names
//     (COUNT_KEYS and jobOutcome), so a count spelled otherwise is a count the
//     screen shows as nothing.
//
// What each one guards, in a sentence a person would say: a fill fills only what
// is missing, says in its log what it did to each work, and counts fields filled,
// works that failed and works that need a Look up apart, under the names the
// screens read; Stop ends it at once, what it had filled stays filled, and the
// work in hand is left untouched, and a Stop pressed once its last work is
// written leaves it finished, not stopped; and a long fill tells the phone when
// it reaches its end, not when it is stopped.

// duneSupplier is a book supplier that knows every ISBN it is asked about as
// Frank Herbert's Dune, 1965, 412 pages, and knows nothing by title alone.
const duneISBN, messiahISBN = "9780441013593", "9780441172696"

func duneSupplier(srv *Server) {
	srv.searchBooks = func(_ context.Context, isbn, _, _, _ string) ([]metadata.BookCandidate, error) {
		if isbn == "" {
			return nil, nil
		}
		return []metadata.BookCandidate{{Source: "google", Title: "Dune", Author: "Frank Herbert",
			ISBN13: isbn, PublishedYear: 1965, Pages: 412}}, nil
	}
}

func createdID(t *testing.T, c *testClient, path string, body map[string]any) int64 {
	t.Helper()
	return decode[struct {
		ID int64 `json:"id"`
	}](t, c.mustDo("POST", path, body, http.StatusCreated)).ID
}

// logOf is a job's whole log as its pane reads it, one string per line.
func logOf(t *testing.T, c *testClient, id int64) []string {
	t.Helper()
	page := decode[struct {
		Lines []struct {
			Level string `json:"level"`
			Line  string `json:"line"`
		} `json:"lines"`
	}](t, c.mustDo("GET", fmt.Sprintf("/jobs/%d?log_after=0", id), nil, http.StatusOK))
	var out []string
	for _, l := range page.Lines {
		out = append(out, l.Level+" "+l.Line)
	}
	return out
}

// countsAre fails unless a job's counts are exactly want: the names the screens
// read, and nothing else under them.
func countsAre(t *testing.T, j wireJob, want map[string]any) {
	t.Helper()
	var got, names []string
	for k, v := range j.Counts {
		got = append(got, fmt.Sprintf("%s=%v", k, v))
	}
	for k, v := range want {
		names = append(names, fmt.Sprintf("%s=%v", k, v))
	}
	sort.Strings(got)
	sort.Strings(names)
	if !slices.Equal(got, names) {
		t.Fatalf("%s job #%d counts %v, want exactly %v", j.Kind, j.ID, got, names)
	}
}

func TestAFillJobFillsWhatIsMissingAndSaysWhatItDidToEachWork(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneSupplier(srv)
	h := srv.Handler()
	alice := signupAdmin(t, h)
	bob := addUser(t, h, alice, "bob")

	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	messiah := createdID(t, alice, "/books", map[string]any{"title": "Dune Messiah", "author": "Frank Herbert"})
	bobs := createdID(t, bob, "/books", map[string]any{"title": "Bob's book", "author": "Someone"})

	job := alice.waitJob(alice.mustStart("fill", map[string]any{"book_ids": []int64{dune, messiah, bobs}}).ID, "succeeded")
	if job.Done != 3 || job.Total != 3 {
		t.Fatalf("the fill's progress: %d of %d", job.Done, job.Total)
	}
	// Two fields on Dune; bob's book is not alice's to fill, which is a failure;
	// Dune Messiah has no ISBN to ask with, which is not.
	countsAre(t, job, map[string]any{"fields": float64(2), "failed": float64(1), "unpinned": float64(1)})

	log := strings.Join(logOf(t, alice, job.ID), "\n")
	for _, want := range []string{
		"info «Dune» — filled year, pages",
		"info «Dune Messiah» — unpinned, so there is nothing to ask",
		fmt.Sprintf("warn book #%d — not found", bobs),
	} {
		if !strings.Contains(log, want) {
			t.Errorf("the fill's log has no %q:\n%s", want, log)
		}
	}
	if strings.Contains(log, "Bob's book") {
		t.Errorf("alice's fill names bob's book:\n%s", log)
	}

	got := decode[struct {
		Year  int `json:"published_year"`
		Pages int `json:"pages"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK))
	if got.Year != 1965 || got.Pages != 412 {
		t.Fatalf("Dune after the fill: %+v", got)
	}
}

// A Stop pressed while the second work is being looked up ends the fill there:
// the first work keeps what it was filled with, and is counted; the second, whose
// lookup the Stop cut off, is left as it was and is counted nowhere.
func TestAFillJobStoppedWithAWorkInHandKeepsWhatItFilledAndLeavesThatWork(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	duneSupplier(srv)
	answer := srv.searchBooks
	asked := make(chan struct{}, 1)
	srv.searchBooks = func(ctx context.Context, isbn, title, author, key string) ([]metadata.BookCandidate, error) {
		if isbn == messiahISBN {
			asked <- struct{}{}
			<-ctx.Done() // the second work's supplier never answers
			return nil, ctx.Err()
		}
		return answer(ctx, isbn, title, author, key)
	}
	h := srv.Handler()
	alice := signupAdmin(t, h)
	first := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	second := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": messiahISBN})

	job := alice.mustStart("fill", map[string]any{"book_ids": []int64{first, second}})
	select {
	case <-asked:
	case <-time.After(20 * time.Second):
		t.Fatal("the fill never asked about the second work")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	stopped := alice.waitJob(job.ID, "stopped")
	if stopped.Done != 1 {
		t.Fatalf("stopped after %d of %d works, want the one finished before the Stop", stopped.Done, stopped.Total)
	}
	countsAre(t, stopped, map[string]any{"fields": float64(2), "failed": float64(0), "unpinned": float64(0)})

	year := func(id int64) int {
		return decode[struct {
			Year int `json:"published_year"`
		}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", id), nil, http.StatusOK)).Year
	}
	if year(first) != 1965 || year(second) != 0 {
		t.Fatalf("after the stop: the first book's year %d, the second's %d; want the first filled and the second untouched",
			year(first), year(second))
	}
	if log := strings.Join(logOf(t, alice, job.ID), "\n"); !strings.Contains(log, "«Dune» — left untouched") {
		t.Errorf("the fill's log does not say which work it left as it was:\n%s", log)
	}
}

// A STOP THAT LANDS ONCE THE LAST WORK IS WRITTEN HAS NOTHING LEFT TO STOP. A long
// fill tells the phone it has finished once its last work is written, and a Stop
// pressed while that message is on its way finds a fill that has done everything
// it was given: it succeeded, with every work filled and the message sent; it is
// not a stopped fill.
func TestAFillStoppedOnceItsLastWorkIsWrittenHasFinished(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	srv.PushoverToken = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
	duneSupplier(srv)
	sending, sent := make(chan struct{}, 1), make(chan struct{})
	var said atomic.Value
	pushover := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		said.Store(r.PostForm.Get("message"))
		sending <- struct{}{}
		<-sent // the message is on its way when the Stop is pressed
		_, _ = w.Write([]byte(`{"status":1}`))
	}))
	t.Cleanup(pushover.Close)
	srv.PushoverAPI = pushover.URL
	h := srv.Handler()
	alice := signupAdmin(t, h)
	alice.mustDo("PUT", "/auth/notifications", map[string]any{"pushover_user": testPushoverUser}, http.StatusOK)
	dune := createdID(t, alice, "/books", map[string]any{"title": "Dune", "author": "Frank Herbert", "isbn": duneISBN})
	ids := []int64{dune}
	for i := 1; i < notifyFetchMin; i++ {
		ids = append(ids, createdID(t, alice, "/books", map[string]any{"title": fmt.Sprintf("Book %02d", i), "author": "Someone"}))
	}

	job := alice.mustStart("fill", map[string]any{"book_ids": ids})
	select {
	case <-sending:
	case <-time.After(20 * time.Second):
		t.Fatal("the fill never told the phone it had finished")
	}
	alice.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", job.ID), nil, http.StatusOK)
	close(sent)
	done := alice.waitJob(job.ID, "succeeded")
	if done.Done != len(ids) || done.Total != len(ids) {
		t.Fatalf("the fill's progress: %d of %d", done.Done, done.Total)
	}
	countsAre(t, done, map[string]any{"fields": float64(2), "failed": float64(0), "unpinned": float64(len(ids) - 1)})
	if log := strings.Join(logOf(t, alice, job.ID), "\n"); strings.HasSuffix(log, "stopped") {
		t.Errorf("a fill that did every work ends its log saying it stopped:\n%s", log)
	}
	if got := said.Load(); got != fmt.Sprintf("2 fields filled across %d works.", len(ids)) {
		t.Errorf("the phone was told %q", got)
	}
	year := decode[struct {
		Year int `json:"published_year"`
	}](t, alice.mustDo("GET", fmt.Sprintf("/books/%d", dune), nil, http.StatusOK)).Year
	if year != 1965 {
		t.Fatalf("Dune's year after the fill: %d", year)
	}
}
