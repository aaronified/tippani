package httpapi

// ISSUE #40: THE CONTAINER SAID HEALTHY AND SERVED NOTHING.
//
// These tests hold the pool full, the state #40 describes, and ask what an
// operator would ask: does /healthz go red, does an API request get an answer
// instead of queueing for ever, and does the log say what is stuck.
//
// WHAT THEY KNOW, declared because a test here may not know the code: the pool
// (srv.Store.DB), through store.HoldEveryConnectionForTest, because nothing a
// reader can do puts a live server into this state on purpose; the pool's
// WaitCount, only as a setup barrier ("the request is now queued"); and the log,
// through olog.CaptureForTest, because the log is what an operator reads in
// `docker logs`. Also srv.Store.Close(), to put the server into the closed state
// a failed reopen leaves; a raw srv.Store.DB.Begin(), to hold SQLite's write
// lock; and the stuckAfter constant, so the minute-long test times itself
// against the real deadline. Nothing a reader can do reaches any of these states.
// Every duration is the real one: no knob exists to shorten them.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"tippani/internal/olog"
	"tippani/internal/store"
)

func healthz(h http.Handler) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	return rec
}

func TestHealthzAnswers503WhenNoConnectionComesFree(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	logs := olog.CaptureForTest(t)

	if rec := healthz(h); rec.Code != http.StatusOK || rec.Body.Len() != 0 {
		t.Fatalf("an idle server: got %d %q, want 200 and no body", rec.Code, rec.Body)
	}

	held := store.HoldEveryConnectionForTest(t, srv.Store.DB)
	max := srv.Store.DB.Stats().MaxOpenConnections
	start := time.Now()
	rec := healthz(h)
	if took := time.Since(start); took > 3*time.Second {
		t.Fatalf("/healthz took %s with the pool held; the healthcheck gives up at 3s", took)
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("/healthz with no connection to give: got %d, want 503 (this is issue #40: healthy while serving nothing)", rec.Code)
	}
	if body := rec.Body.String(); !strings.HasPrefix(body, "TIP-HEALTH-001") || !strings.Contains(body, fmt.Sprintf("%d of %d in use", max, max)) {
		t.Fatalf("the 503 does not say why: %q", body)
	}
	if !strings.Contains(logs.String(), "[error] TIP-HEALTH-001 GET /healthz") {
		t.Fatalf("a failed health check left no line in the log:\n%s", logs)
	}

	store.ReleaseForTest(held)
	if rec := healthz(h); rec.Code != http.StatusOK {
		t.Fatalf("with the pool free again: got %d, want 200", rec.Code)
	}
	if !strings.Contains(logs.String(), "healthy again after 1 failed check") {
		t.Fatalf("the first green after a red one did not say so:\n%s", logs)
	}
}

func TestHealthzStaysGreenWhileAWriterHoldsTheLock(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	// _txlock=immediate: this BEGIN takes SQLite's write lock and keeps it.
	tx, err := srv.Store.DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	start := time.Now()
	if rec := healthz(h); rec.Code != http.StatusOK {
		t.Fatalf("a writer holding the lock turned the health check red: %d %q", rec.Code, rec.Body)
	}
	if took := time.Since(start); took > time.Second {
		t.Fatalf("/healthz queued behind the writer for %s; the probe must not take the write lock", took)
	}
}

func TestHealthzWaitsOutABriefQueueForAConnection(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	held := store.HoldEveryConnectionForTest(t, srv.Store.DB)
	go func() {
		time.Sleep(500 * time.Millisecond)
		store.ReleaseForTest(held[:1])
	}()
	start := time.Now()
	rec := healthz(h)
	if rec.Code != http.StatusOK {
		t.Fatalf("a connection came free after 500ms, inside the budget: got %d %q", rec.Code, rec.Body)
	}
	if took := time.Since(start); took < 400*time.Millisecond {
		t.Fatalf("answered in %s, before a connection was free: the probe did not wait for one", took)
	}
}

func TestAnAPIRequestIsRefusedWhenNoConnectionComesFree(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	anon := &testClient{t: t, h: h}
	logs := olog.CaptureForTest(t)
	held := store.HoldEveryConnectionForTest(t, srv.Store.DB)

	type answer struct {
		name string
		rec  *httptest.ResponseRecorder
		took time.Duration
	}
	answers := make(chan answer, 2)
	ask := func(name string, cl *testClient, method, path string, body any) {
		start := time.Now()
		rec := cl.do(method, path, body)
		answers <- answer{name, rec, time.Since(start)}
	}
	go ask("a signed-in reader's /auth/me", c, "GET", "/auth/me", nil)
	go ask("a sign-in", anon, "POST", "/auth/login", map[string]string{"username": "alice", "password": "supersecret"})

	deadline := time.After(20 * time.Second)
	for i := 0; i < 2; i++ {
		select {
		case a := <-answers:
			if a.rec.Code != http.StatusServiceUnavailable {
				t.Fatalf("%s with the pool held: got %d %q, want 503", a.name, a.rec.Code, a.rec.Body)
			}
			if a.took < 9*time.Second {
				t.Fatalf("%s gave up after %s, before its wait for a connection was over", a.name, a.took)
			}
			var e struct{ Error, Code string }
			_ = json.Unmarshal(a.rec.Body.Bytes(), &e)
			if !strings.Contains(e.Error, "changed nothing") {
				t.Fatalf("%s's 503 does not say it changed nothing: %q", a.name, a.rec.Body)
			}
			// The code is how the SPA tells this refusal from another 503 and shows
			// its busy screen, rather than matching the English.
			if e.Code != "TIP-HTTP-002" {
				t.Fatalf("%s's 503 carries code %q, want TIP-HTTP-002: %q", a.name, e.Code, a.rec.Body)
			}
		case <-deadline:
			t.Fatal("a request with no connection to be had was still waiting after 20s: it queues for ever, which is issue #40")
		}
	}
	got := logs.String()
	for _, want := range []string{"[error] TIP-HTTP-002 GET /api/auth/me", "in use", "GET /api/auth/me 503"} {
		if !strings.Contains(got, want) {
			t.Fatalf("the log does not say %q:\n%s", want, got)
		}
	}

	store.ReleaseForTest(held)
	c.mustDo("GET", "/auth/me", nil, http.StatusOK) // still signed in
}

// A client that gives up while its request waits at the door is still refused
// there, rather than let through into a handler that would wait for ever.
func TestARequestWhoseClientLeavesMidWaitIsStillRefused(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	store.HoldEveryConnectionForTest(t, srv.Store.DB)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req := httptest.NewRequest("GET", "/api/auth/me", nil).WithContext(ctx)
	req.AddCookie(c.cookie)
	waits := srv.Store.DB.Stats().WaitCount
	done := make(chan int, 1)
	go func() {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		done <- rec.Code
	}()
	for i := 0; srv.Store.DB.Stats().WaitCount == waits; i++ {
		if i > 400 {
			t.Fatal("the request never queued for a connection")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel() // the client gives up while it waits
	select {
	case code := <-done:
		if code != http.StatusServiceUnavailable {
			t.Fatalf("a request whose client left mid-wait: got %d, want 503 at the door", code)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("a request whose client left mid-wait slipped past the door and is waiting for ever in a handler")
	}
}

func TestAHungRequestIsNamedInTheLogWhileItHangs(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	logs := olog.CaptureForTest(t)
	held := store.HoldEveryConnectionForTest(t, srv.Store.DB)

	waits := srv.Store.DB.Stats().WaitCount
	done := make(chan int, 1)
	go func() { done <- c.do("GET", "/auth/me", nil).Code }()
	for i := 0; srv.Store.DB.Stats().WaitCount == waits; i++ {
		if i > 400 {
			t.Fatal("the request never queued for a connection")
		}
		time.Sleep(5 * time.Millisecond)
	}

	if rec := healthz(h); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("/healthz while a request is queued on a held pool: got %d, want 503", rec.Code)
	}
	select {
	case code := <-done:
		t.Fatalf("the queued request answered %d while the pool was still held", code)
	default:
	}
	line := regexp.MustCompile(`\[error\] TIP-HEALTH-001 [^\n]*`).FindString(logs.String())
	rid := regexp.MustCompile(`GET /api/auth/me \d+s \(req (r\d+)\)`).FindStringSubmatch(line)
	if rid == nil {
		t.Fatalf("the failed health check does not name the request that is waiting: %q", line)
	}

	store.ReleaseForTest(held)
	select {
	case code := <-done:
		if code != http.StatusOK {
			t.Fatalf("the queued request, once a connection came free: got %d, want 200", code)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the queued request did not answer after the pool was released")
	}
	if !regexp.MustCompile(`GET /api/auth/me 200 [^\n]* alice ` + rid[1] + `\n`).MatchString(logs.String()) {
		t.Fatalf("the access line does not carry the id the health check named (%s):\n%s", rid[1], logs)
	}
	if rec := healthz(h); rec.Code != http.StatusOK {
		t.Fatalf("/healthz after the release: got %d, want 200", rec.Code)
	}
}

func TestAStuckRequestWritesTheGoroutineStacks(t *testing.T) {
	var out bytes.Buffer
	old := stuckDump
	stuckDump = &out
	t.Cleanup(func() { stuckDump = old })
	stuckDumpMu.Lock()
	stuckDumpLast = time.Time{}
	stuckDumpMu.Unlock()

	f := &flightTable{reqs: map[string]*flight{
		"r1": {method: "POST", path: "/api/sources/scan", since: time.Now().Add(-2 * stuckAfter)},
	}}
	f.reportOverdue(time.Now())
	if !strings.Contains(out.String(), "[stuck] goroutine stacks") || !strings.Contains(out.String(), "goroutine ") {
		t.Fatalf("a stuck request wrote no stacks:\n%.300s", out.String())
	}

	// A second stuck request soon after does not write a second dump.
	out.Reset()
	f.reqs["r2"] = &flight{method: "POST", path: "/api/sources/scan", since: time.Now().Add(-2 * stuckAfter)}
	f.reportOverdue(time.Now())
	if out.Len() != 0 {
		t.Fatalf("a second dump was written within the interval:\n%.300s", out.String())
	}
}
