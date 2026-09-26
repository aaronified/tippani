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
// `docker logs`. Every duration is the real one: no knob exists to shorten them.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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

func TestHealthzAnswers503WhenTheDatabaseIsClosed(t *testing.T) {
	srv := newTestServer(t)
	h := srv.Handler()
	logs := olog.CaptureForTest(t)
	if err := srv.Store.Close(); err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	rec := healthz(h)
	if rec.Code != http.StatusServiceUnavailable || !strings.HasPrefix(rec.Body.String(), "TIP-HEALTH-002") {
		t.Fatalf("a closed database: got %d %q, want 503 TIP-HEALTH-002", rec.Code, rec.Body)
	}
	if took := time.Since(start); took > time.Second {
		t.Fatalf("a closed database took %s to report; it should not wait", took)
	}
	if !strings.Contains(logs.String(), "[error] TIP-HEALTH-002 GET /healthz") {
		t.Fatalf("no TIP-HEALTH-002 line:\n%s", logs)
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
			var e struct{ Error string }
			_ = json.Unmarshal(a.rec.Body.Bytes(), &e)
			if !strings.Contains(e.Error, "changed nothing") {
				t.Fatalf("%s's 503 does not say it changed nothing: %q", a.name, a.rec.Body)
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

// A request that has been running past the server's write deadline is named once,
// with its id. The two requests stall on their bodies, the one way to keep a
// request running for a minute without holding the pool; a real server's
// ReadTimeout would end that, and this checks the naming, not the stall.
func TestARequestStillRunningPastTheWriteDeadlineIsNamedOnce(t *testing.T) {
	if testing.Short() {
		t.Skip("runs for a minute and a bit")
	}
	srv := newTestServer(t)
	h := srv.Handler()
	c := signupAdmin(t, h)
	bookID := newTestBook(t, c, "Invisible Cities")
	logs := olog.CaptureForTest(t)

	stalled := func() (*io.PipeWriter, chan int) {
		pr, pw := io.Pipe()
		done := make(chan int, 1)
		go func() {
			req := httptest.NewRequest("POST", "/api/annotations", pr).WithContext(context.Background())
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(c.cookie)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			done <- rec.Code
		}()
		go func() { _, _ = io.WriteString(pw, fmt.Sprintf(`{"book_id":%d,`, bookID)) }()
		return pw, done
	}
	stillRunning := regexp.MustCompile(`\[warn\] TIP-HTTP-003 POST /api/annotations still running after [0-9ms]+ \(from [^,]+, req (r\d+)\)`)
	count := func() int { return len(stillRunning.FindAllString(logs.String(), -1)) }

	aStart := time.Now()
	a, aDone := stalled()
	time.Sleep(5 * time.Second)
	b, bDone := stalled()

	time.Sleep(time.Until(aStart.Add(stuckAfter + time.Second)))
	if rec := healthz(h); rec.Code != http.StatusOK {
		t.Fatalf("/healthz: got %d; two requests stalled on their bodies hold no connection", rec.Code)
	}
	if n := count(); n != 1 {
		t.Fatalf("a minute and a second after A began: %d still-running lines, want 1 (A):\n%s", n, logs)
	}
	time.Sleep(time.Until(aStart.Add(5*time.Second + stuckAfter + time.Second)))
	c.mustDo("GET", "/auth/status", nil, http.StatusOK) // an arrival sweeps too
	if n := count(); n != 2 {
		t.Fatalf("after B passed the deadline and a request arrived: %d lines, want 2:\n%s", n, logs)
	}
	healthz(h)
	healthz(h)
	if n := count(); n != 2 {
		t.Fatalf("each request must be named once: %d lines after two more sweeps:\n%s", n, logs)
	}

	for i, p := range []*io.PipeWriter{a, b} {
		_, _ = io.WriteString(p, fmt.Sprintf(`"quote":"Cities, like dreams, are made of desires and fears (%d)."}`, i))
		_ = p.Close()
	}
	for i, d := range []chan int{aDone, bDone} {
		if code := <-d; code != http.StatusCreated {
			t.Fatalf("stalled request %d, once its body arrived: got %d, want 201", i, code)
		}
	}
	for _, m := range stillRunning.FindAllStringSubmatch(logs.String(), -1) {
		if !regexp.MustCompile(`POST /api/annotations \d{3} [^\n]* ` + m[1] + `\n`).MatchString(logs.String()) {
			t.Fatalf("the still-running line names %s, and no access line carries that id:\n%s", m[1], logs)
		}
	}
}
