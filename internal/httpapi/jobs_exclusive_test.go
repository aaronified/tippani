package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tippani/internal/jobs"
)

// A RESTORE, A RESET, A SEARCH REBUILD AND AN UPDATE WAIT FOR A RUNNING JOB, AND
// NO JOB STARTS UNDER ONE OF THEM.
//
// Driven through the API as the admin's Server card and Updates card drive them,
// with a reader's job running on the queue as Settings › Jobs would show it.
//
// WHAT IT KNOWS, declared: what jobs_api_test.go's header declares (the queue set
// up as serve() sets it, the test's own kind that it holds running, the wire
// field names), and the update's Docker client stubbed as update_test.go stubs
// it (srv.newDocker), since nothing here may touch a real Engine; its pull is
// held open by the stub's hook, which is the only way to keep an update in its
// minutes-long middle on demand. And one test kind whose params check swaps the
// database files (Store.Swap with nothing to move, then rebindDB, as a restore
// does): the one way to land a swap between a request's sign-in and its reaching
// the queue, a window no press can hit on purpose.
//
// What each one guards, in a sentence a person would say: while a job runs, a
// restore (from the kept archive or an upload), a factory reset, a search
// rebuild and an update are each refused with the reason and change nothing, and
// each goes ahead once the job has ended; after a restore and after a reset, a
// job starts, stops and runs again as before; while an update is running, a job
// cannot be started, and can once it is done; a job asked for by a request that
// signed in before a swap is refused with the same reason, and goes ahead when
// asked again.

// busyBody fails unless rec is the refusal a job in the way gets.
func busyBody(t *testing.T, what string, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code != http.StatusConflict {
		t.Fatalf("%s while a job runs: %d %s, want 409", what, rec.Code, rec.Body)
	}
	m := shaped(t, what+"'s refusal", rec.Body.Bytes(), "error", "busy")
	if string(m["busy"]) != "true" || string(m["error"]) != `"A job is running. Stop it in Settings › Jobs, or wait for it to finish."` {
		t.Fatalf("%s's refusal: %s", what, rec.Body)
	}
}

func TestARestoreAResetARebuildAndAnUpdateWaitForARunningJob(t *testing.T) {
	srv := newTestServer(t)
	q := queueing(t, srv)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	admin.mustDo("POST", "/books", map[string]any{"title": "Kept", "author": "Someone"}, http.StatusCreated)
	backupNow(admin)
	archive := admin.mustDo("GET", "/admin/backup/download", nil, http.StatusOK).Body.Bytes()
	safetyBackup(t, admin)

	job := bob.mustStart("test.hold", map[string]any{"tag": "b"})
	bob.waitJob(job.ID, "running")

	busyBody(t, "a search rebuild", admin.do("POST", "/admin/search/reindex", nil))
	busyBody(t, "an update", admin.do("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}))
	busyBody(t, "a restore", admin.do("POST", "/admin/restore", map[string]string{"password": testPw}))
	busyBody(t, "an uploaded restore", admin.restoreUpload("/admin/restore/upload", pwUpload(), archive))
	busyBody(t, "a factory reset", admin.do("POST", "/admin/reset", map[string]string{"confirm": "RESET"}))
	if len(fake.pulls()) != 0 {
		t.Fatalf("a refused update pulled %v", fake.pulls())
	}
	if j := bob.job(job.ID); j.State != "running" {
		t.Fatalf("bob's job after the refusals: %s", j.State)
	}
	if !strings.Contains(admin.mustDo("GET", "/books", nil, http.StatusOK).Body.String(), "Kept") {
		t.Fatal("the library changed under a refused restore or reset")
	}

	// A job that is only waiting does not stand in the way.
	waiting := bob.mustStart("test.hold", map[string]any{"tag": "w"})
	q.let()
	bob.waitJob(job.ID, "succeeded")
	bob.waitJob(waiting.ID, "running")
	busyBody(t, "a search rebuild", admin.do("POST", "/admin/search/reindex", nil))
	bob.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", waiting.ID), nil, http.StatusOK)
	bob.waitJob(waiting.ID, "stopped")

	admin.mustDo("POST", "/admin/search/reindex", nil, http.StatusOK)
	admin.mustDo("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}, http.StatusOK)
	if len(fake.pulls()) != 1 {
		t.Fatalf("the update once nothing ran pulled %v", fake.pulls())
	}
	admin.mustDo("POST", "/admin/restore", map[string]string{"password": testPw}, http.StatusOK)
	// The restore signed everybody out; the admin is in the archive.
	again := &testClient{t: t, h: h}
	again.cookie = cookieOf(t, again.mustDo("POST", "/auth/login", map[string]string{"username": "alice", "password": testPw}, http.StatusOK))
	// Signed in on the restored database, a job starts and stops as it did
	// before: the swap is behind this request, not under it.
	startsAndStops(t, again)
	safetyBackup(t, again)
	again.mustDo("POST", "/admin/reset", map[string]string{"confirm": "RESET"}, http.StatusOK)
	// And on the empty database a factory reset leaves, once somebody signs up.
	startsAndStops(t, signupAdmin(t, h))
}

// startsAndStops starts a held job as c, stops it, and runs it again: the three
// presses a request carries its account's generation into.
func startsAndStops(t *testing.T, c *testClient) {
	t.Helper()
	j := c.mustStart("test.hold", map[string]any{"tag": "after a swap"})
	c.waitJob(j.ID, "running")
	c.mustDo("POST", fmt.Sprintf("/jobs/%d/stop", j.ID), nil, http.StatusOK)
	c.waitJob(j.ID, "stopped")
	again := decode[struct {
		Job wireJob `json:"job"`
	}](t, c.mustDo("POST", fmt.Sprintf("/jobs/%d/rerun", j.ID), nil, http.StatusAccepted)).Job
	c.waitJob(again.ID, "running")
	c.mustDo("POST", "/jobs/stop-all", nil, http.StatusOK)
	c.waitJob(again.ID, "stopped")
}

// A request that signed in on one database and reaches the queue after a swap
// has replaced it is refused as the queue refuses anything under a restore, and
// changes nothing; asked again, it goes ahead.
func TestAJobAskedForAcrossASwapIsRefusedAndGoesAheadWhenAskedAgain(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	swapped := false
	srv.addJobKind(queuedKind{name: "test.swapped", validate: func(s *Server, raw json.RawMessage, v jobs.Owner) (jobInput, error) {
		if !swapped {
			swapped = true
			// The restore's own swap, with nothing to move, and the rebinding
			// it does after it.
			if err := s.Store.Swap(func() error { return nil }, nil, nil); err != nil {
				return jobInput{}, err
			}
			s.rebindDB()
		}
		return testParams(s, raw, v)
	}, run: func(*Server, context.Context, *jobs.Job) error { return nil }})
	h := srv.Handler()
	admin := signupAdmin(t, h)

	rec := admin.startJob("test.swapped", map[string]any{"tag": "across"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("a job asked for across a swap: %d %s, want 409", rec.Code, rec.Body)
	}
	if m := shaped(t, "the refusal", rec.Body.Bytes(), "error", "busy"); string(m["busy"]) != "true" {
		t.Fatalf("the refusal: %s", rec.Body)
	}
	for _, view := range []string{"current", "past"} {
		if list := admin.jobs("view=" + view + "&kind=test.swapped"); len(list.Jobs) != 0 {
			t.Fatalf("a refused start left a job in %s jobs: %+v", view, list.Jobs)
		}
	}
	admin.waitJob(admin.mustStart("test.swapped", map[string]any{"tag": "across"}).ID, "succeeded")
}

func TestNoJobStartsWhileAnUpdateHoldsTheQueue(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	inPull, release := make(chan struct{}), make(chan struct{})
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest",
		pullHook: func(context.Context) error {
			close(inPull)
			<-release
			return nil
		}}
	srv.newDocker = func() UpdateDocker { return fake }
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	applied := make(chan int, 1)
	go func() {
		applied <- admin.do("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}).Code
	}()
	select {
	case <-inPull:
	case <-time.After(20 * time.Second):
		t.Fatal("the update never began its pull")
	}
	rec := bob.startJob("test.lines", map[string]any{"tag": "during"})
	if rec.Code != http.StatusConflict {
		close(release)
		t.Fatalf("a job started during an update: %d %s, want 409", rec.Code, rec.Body)
	}
	if m := shaped(t, "the refusal", rec.Body.Bytes(), "error", "busy"); string(m["busy"]) != "true" {
		close(release)
		t.Fatalf("the refusal: %s", rec.Body)
	}
	close(release)
	if code := <-applied; code != http.StatusOK {
		t.Fatalf("the update: %d", code)
	}
	bob.waitJob(bob.mustStart("test.lines", map[string]any{"tag": "after"}).ID, "succeeded")
}
