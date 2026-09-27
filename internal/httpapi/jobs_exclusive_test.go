package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/outbound"
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
// the queue, a window no press can hit on purpose. The test of a launched update
// shortens how long it keeps the queue shut (updateReplaceWait) to two seconds,
// since nothing replaces a test server and the wait is what it checks the end of;
// and it makes a job that waits with nothing running through the journey tier's
// seam, TIPPANI_JOBS_HOLD (jobs.HoldEnv, honoured offline only), because on a
// server whose jobs end in milliseconds no press leaves one waiting. The upload
// that stops arriving is a real socket to a real listener, which sends part of a
// body and then nothing, because the recorder the other requests use hands a
// handler its whole body at once; and the time an upload may send nothing
// (uploadIdle) is shortened to a second for it, so the test waits a second and
// not a minute.
//
// What each one guards, in a sentence a person would say: while a job runs, a
// restore (from the kept archive or an upload), a factory reset, a search
// rebuild and an update are each refused with the reason and change nothing, and
// each goes ahead once the job has ended; after a restore and after a reset, a
// job starts, stops and runs again as before; while an update is running, a job
// cannot be started, and can once it has failed; once an update has launched its
// recreater, nothing starts and a job left waiting stays waiting, until a server
// that was not replaced opens its queue again; a job asked for by a request that
// signed in before a swap is refused with the same reason, and goes ahead when
// asked again; an uploaded restore that stops arriving holds the queue only until
// it is given up.

// busyBody fails unless rec is the refusal a job in the way gets.
func busyBody(t *testing.T, what string, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code != http.StatusConflict {
		t.Fatalf("%s while a job runs: %d %s, want 409", what, rec.Code, rec.Body)
	}
	m := shaped(t, what+"'s refusal", rec.Body.Bytes(), "error", "busy")
	if string(m["busy"]) != "true" || string(m["error"]) != `"A job is running. Stop it in Settings → Jobs, or wait for it to finish."` {
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
	fresh := signupAdmin(t, h)
	startsAndStops(t, fresh)
	// The update last: once it has launched its recreater, the server is about
	// to be replaced and takes nothing more.
	fresh.mustDo("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}, http.StatusOK)
	if len(fake.pulls()) != 1 {
		t.Fatalf("the update once nothing ran pulled %v", fake.pulls())
	}
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

// While an update pulls, no job starts. This one's pull fails once it is let
// go, so nothing is coming to replace the server, and a job starts again at once.
func TestNoJobStartsWhileAnUpdateHoldsTheQueue(t *testing.T) {
	srv := newTestServer(t)
	queueing(t, srv)
	inPull, release := make(chan struct{}), make(chan struct{})
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest",
		pullHook: func(context.Context) error {
			close(inPull)
			<-release
			return errors.New("the registry answered 503")
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
	if code := <-applied; code != http.StatusInternalServerError {
		t.Fatalf("the update whose pull failed: %d, want 500", code)
	}
	bob.waitJob(bob.mustStart("test.lines", map[string]any{"tag": "after"}).ID, "succeeded")
}

// ONCE AN UPDATE HAS LAUNCHED ITS RECREATER, THE SERVER TAKES NOTHING MORE until
// it is replaced: a job pressed in the seconds before would start and be cut off
// mid-item. A press is told the server is shutting down, a second update and a
// search rebuild the same, and a job left waiting from before stays waiting. A
// server that is still here once the replacement's wait is up was not replaced,
// and its queue opens again: the next press starts, and the job left waiting
// runs first.
func TestAfterAnUpdateLaunchesNothingStartsUntilTheServerIsReplaced(t *testing.T) {
	old := updateReplaceWait
	updateReplaceWait = 2 * time.Second
	t.Cleanup(func() { updateReplaceWait = old })
	srv := newTestServer(t)
	queueing(t, srv)
	fake := &fakeDocker{avail: true, name: "tippani", image: "ghcr.io/aaronified/tippani:latest"}
	srv.newDocker = func() UpdateDocker { return fake }
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	// A job waiting with nothing running, which only the hold seam makes on a
	// server whose jobs end in milliseconds.
	t.Setenv(outbound.EnvVar, "1")
	t.Setenv(jobs.HoldEnv, "1")
	waiting := bob.mustStart("test.lines", map[string]any{"tag": "waiting"})
	time.Sleep(100 * time.Millisecond)
	if j := bob.job(waiting.ID); j.State != "queued" {
		t.Fatalf("with the queue held the job reads %s", j.State)
	}
	t.Setenv(jobs.HoldEnv, "")

	admin.mustDo("POST", "/admin/update/apply", map[string]string{"confirm": "UPDATE"}, http.StatusOK)
	launched := time.Now()
	rec := bob.startJob("test.lines", map[string]any{"tag": "pressed after the launch"})
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "shutting down") {
		t.Fatalf("a job pressed after the update launched: %d %s, want 503", rec.Code, rec.Body)
	}
	for _, try := range []struct{ what, path string }{
		{"a second update", "/admin/update/apply"}, {"a search rebuild", "/admin/search/reindex"},
	} {
		if rec := admin.do("POST", try.path, map[string]string{"confirm": "UPDATE"}); rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("%s after the update launched: %d %s, want 503", try.what, rec.Code, rec.Body)
		}
	}
	if len(fake.pulls()) != 1 {
		t.Fatalf("the refused second update pulled: %v", fake.pulls())
	}
	time.Sleep(200 * time.Millisecond)
	if j := bob.job(waiting.ID); j.State != "queued" {
		t.Fatalf("the job left waiting, after the update launched: %s, want still waiting", j.State)
	}
	if time.Since(launched) >= updateReplaceWait {
		t.Fatalf("the checks took %s, past the wait they were checking inside", time.Since(launched))
	}

	// Not replaced: once the wait is up, the queue takes jobs again, and the one
	// left waiting runs first.
	time.Sleep(time.Until(launched.Add(updateReplaceWait + 100*time.Millisecond)))
	after := bob.waitJob(bob.mustStart("test.lines", map[string]any{"tag": "after the wait"}).ID, "succeeded")
	if w := bob.job(waiting.ID); w.State != "succeeded" || w.StartedAt == nil || after.StartedAt == nil || *w.StartedAt > *after.StartedAt {
		t.Fatalf("the job left waiting, once the queue opened again: %+v (the press after it: %+v)", w, after)
	}
}

// An uploaded restore that stops arriving — the tab still open, the link dead —
// holds the queue only until it has sent nothing for a while: then the upload is
// given up, the admin's browser (if it is still there) is told so, and jobs start
// again.
func TestARestoreUploadThatStopsArrivingLetsGoOfTheQueue(t *testing.T) {
	old := uploadIdle
	uploadIdle = time.Second
	t.Cleanup(func() { uploadIdle = old })
	srv := newTestServer(t)
	queueing(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")
	safetyBackup(t, admin)
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	conn, err := net.Dial("tcp", ts.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	const boundary = "Wv-boundary"
	fmt.Fprintf(conn, "POST %s HTTP/1.1\r\nHost: tippani\r\nCookie: %s=%s\r\n"+
		"Content-Type: multipart/form-data; boundary=%s\r\nContent-Length: %d\r\nExpect: 100-continue\r\n\r\n",
		apiPath("/admin/restore/upload"), admin.cookie.Name, admin.cookie.Value, boundary, 10<<20)
	// The server asks for the body once the restore is under way, with the queue
	// held: from here the upload is what stands in every job's way.
	conn.SetReadDeadline(time.Now().Add(20 * time.Second))
	wire := bufio.NewReader(conn)
	if line, err := wire.ReadString('\n'); err != nil || !strings.HasPrefix(line, "HTTP/1.1 100") {
		t.Fatalf("the upload was not asked for its body: %q %v", line, err)
	}
	wire.ReadString('\n') // the blank line after the interim answer
	fmt.Fprintf(conn, "--%s\r\nContent-Disposition: form-data; name=\"password\"\r\n\r\n%s\r\n"+
		"--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"backup%s\"\r\n"+
		"Content-Type: application/octet-stream\r\n\r\n%s", boundary, testPw, boundary, backupExt, strings.Repeat("\x00", 8<<10))
	// And then nothing more.

	start := time.Now()
	rec := bob.startJob("test.lines", map[string]any{"tag": "during the upload"})
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), `"busy":true`) {
		t.Fatalf("a job started while a restore upload arrives: %d %s, want 409 busy", rec.Code, rec.Body)
	}
	// The upload is given up, and its browser is told why.
	if line, err := wire.ReadString('\n'); err != nil || !strings.HasPrefix(line, "HTTP/1.1 408") {
		t.Fatalf("the stalled upload was answered %q (%v), want 408", line, err)
	}
	t.Logf("the stalled upload was given up after %s", time.Since(start).Round(time.Millisecond))
	// And jobs start again.
	bob.waitJob(bob.mustStart("test.lines", map[string]any{"tag": "after the upload"}).ID, "succeeded")
}
