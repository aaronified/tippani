package main

// THE SERVER AS DOCKER RUNS IT, AND THE COMMANDS AN OPERATOR RUNS BESIDE IT. This
// test binary is started again as `tippani serve` against a data directory, sent
// SIGTERM the way `docker stop` sends it, and the database is read afterwards;
// `tippani user add` and `tippani notify daily` are run against the same directory
// while a server is live on it.
//
// WHAT IT KNOWS, declared because a test here may not know the code: that the test
// binary runs main() when TIPPANI_TEST_AS_BINARY=1 (TestMain, in
// healthcheck_test.go); the journal tables' names and columns (jobs, job_logs,
// system_logs), which it reads, and writes where a job has to exist that nothing
// yet queues — the endpoints that start and list jobs are a later stage of 3.1.0;
// TIPPANI_LOG_HOLD, the logbook's declared test seam (honoured only offline),
// which holds every line in memory until shutdown's last flush so that the
// shutdown's order decides whether any line is kept at all, every run; the users
// and notify_settings tables, to give the daily deck two more readers
// without signing each in to Pushover's settings screen; and annotations'
// created_at, which it moves back ten days, because the daily deck does not ask
// about a quote in its first week and nothing a reader does makes one older. The
// first reader, her quote and her Pushover settings are made through the API, as
// the app's own screens make them. Every server runs with TIPPANI_OFFLINE=1, so
// nothing here reaches the internet, and a lookup's or a message's call out is
// refused, which is how the tests see that it was recorded.
//
// What each one guards, in a sentence a person would say: when the container is
// stopped, the last lines it logged are kept, a job the previous run left is
// interrupted with its line, and the checkpoint runs after the log is closed, not
// before; the boot lines and a coded warning are kept at their levels, and a
// reader's lookup is kept as her job with the call it made; the command-line
// tools leave a live server's running job running, while the daily deck is kept
// as a job of its own with the call to Pushover it made; on a server terminating
// its own TLS, a failed handshake is kept with the request lines, not in the
// middle of the log; and a stop with the database locked by another program still
// ends inside Docker's grace. That last one holds SQLite's write lock through its
// own transaction on the library pool, from before the stop to after it, as a
// `sqlite3` shell left in a transaction would.

import (
	"bytes"
	"crypto/tls"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"tippani/internal/store"
)

// served is a `tippani serve` process on its own data directory.
type served struct {
	t      *testing.T
	cmd    *exec.Cmd
	addr   string
	base   string
	client *http.Client  // trusts the server's own self-signed certificate when it has one
	out    *bytes.Buffer // stdout and stderr together, as `docker logs` merges them
	exited chan error
}

func freeAddr(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().String()
}

// binaryEnv is the environment every run of the binary here gets: the data
// directory, offline, and none of the operator settings a developer's shell might
// carry into it.
func binaryEnv(dir string, extra ...string) []string {
	var env []string
	for _, kv := range os.Environ() {
		if !strings.HasPrefix(kv, "TIPPANI_") {
			env = append(env, kv)
		}
	}
	return append(append(env, "TIPPANI_TEST_AS_BINARY=1", "TIPPANI_DATA="+dir, "TIPPANI_OFFLINE=1"), extra...)
}

// serveOn starts `tippani serve` on dir, with extra settings on top of
// binaryEnv's; with TIPPANI_TLS_CERT among them it speaks https, as a server
// terminating its own TLS does.
func serveOn(t *testing.T, dir string, extra ...string) *served {
	t.Helper()
	addr := freeAddr(t)
	s := &served{t: t, addr: addr, base: "http://" + addr, client: &http.Client{},
		out: &bytes.Buffer{}, exited: make(chan error, 1)}
	for _, kv := range extra {
		if strings.HasPrefix(kv, "TIPPANI_TLS_CERT=") {
			s.base = "https://" + addr
			// Its own certificate, made by the test: identity is not what is
			// under test here.
			s.client.Transport = &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}
		}
	}
	s.cmd = exec.Command(os.Args[0], "serve")
	s.cmd.Env = binaryEnv(dir, append([]string{"TIPPANI_BIND=" + addr}, extra...)...)
	s.cmd.Stdout, s.cmd.Stderr = s.out, s.out
	if err := s.cmd.Start(); err != nil {
		t.Fatal(err)
	}
	go func() { s.exited <- s.cmd.Wait() }()
	t.Cleanup(func() {
		if s.cmd.ProcessState == nil {
			s.cmd.Process.Kill()
			<-s.exited
		}
	})
	deadline := time.Now().Add(30 * time.Second)
	for {
		if resp, err := s.client.Get(s.base + "/healthz"); err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return s
			}
		}
		select {
		case err := <-s.exited:
			t.Fatalf("the server exited before it was healthy: %v\n%s", err, s.out)
		default:
		}
		if time.Now().After(deadline) {
			t.Fatalf("the server was not healthy within 30s:\n%s", s.out)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func (s *served) get(path string) {
	s.t.Helper()
	resp, err := s.client.Get(s.base + path)
	if err != nil {
		s.t.Fatalf("GET %s: %v", path, err)
	}
	resp.Body.Close()
}

// send makes one API request with a JSON body, as the app's own screens do, and
// fails the test unless it is answered want. It returns the answer's body.
func (s *served) send(method, path string, body any, want int) []byte {
	s.t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		s.t.Fatal(err)
	}
	req, err := http.NewRequest(method, s.base+path, bytes.NewReader(b))
	if err != nil {
		s.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		s.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	got, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != want {
		s.t.Fatalf("%s %s: answered %d, want %d: %s", method, path, resp.StatusCode, want, got)
	}
	return got
}

// signUp makes the first account through the onboarding form, as a person does on
// a new install, and keeps its session for the requests after it.
func (s *served) signUp(name, password string) {
	s.t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		s.t.Fatal(err)
	}
	s.client.Jar = jar
	s.send("POST", "/api/auth/signup", map[string]string{"username": name, "password": password}, http.StatusOK)
}

// jobLines is the log of the newest job of kind, as level and text, in order.
func jobLines(t *testing.T, db *sql.DB, kind string) []string {
	t.Helper()
	rows, err := db.Query(`SELECT level || ' ' || line FROM job_logs
		WHERE job_id = (SELECT max(id) FROM jobs WHERE kind = ?) ORDER BY id`, kind)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var lines []string
	for rows.Next() {
		var l string
		if err := rows.Scan(&l); err != nil {
			t.Fatal(err)
		}
		lines = append(lines, l)
	}
	return lines
}

// stop sends SIGTERM, as `docker stop` does, and waits for a clean exit well
// inside Docker's ten-second grace.
func (s *served) stop() {
	s.t.Helper()
	if err := s.cmd.Process.Signal(syscall.SIGTERM); err != nil {
		s.t.Fatal(err)
	}
	select {
	case err := <-s.exited:
		if err != nil {
			s.t.Fatalf("the server did not exit cleanly on SIGTERM: %v\n%s", err, s.out)
		}
	case <-time.After(10 * time.Second):
		s.t.Fatalf("the server was still running 10s after SIGTERM, past Docker's grace:\n%s", s.out)
	}
}

func openData(t *testing.T, dir string) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(dir, "tippani.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	return st
}

func mustExec(t *testing.T, db *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := db.Exec(q, args...); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
}

func count(t *testing.T, db *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return n
}

func TestAStoppedServerKeepsItsLastLinesAndSettlesTheJobsItFound(t *testing.T) {
	dir := t.TempDir()
	// What a crashed earlier run left: a job still marked running.
	st := openData(t, dir)
	mustExec(t, st.DB, `INSERT INTO jobs (id, kind, state, created_at, started_at) VALUES (5, 'fill', 'running', 1, 2)`)
	st.Close()
	// Two translations that claim one language: the server warns, with a code.
	if err := os.MkdirAll(filepath.Join(dir, "Locales"), 0o700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"fr.txt", "FR.txt"} {
		if err := os.WriteFile(filepath.Join(dir, "Locales", name), []byte("nav.home = Accueil\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	// Every line this server logs is held in memory until shutdown's last flush
	// (TIPPANI_LOG_HOLD), so each line found kept below was written by that
	// flush: a shutdown that closed the log pool first would keep none of them.
	srv := serveOn(t, dir, "TIPPANI_LOG_HOLD=1")
	srv.get("/api/locales")
	srv.get("/api/auth/status?probe=Wv-kept-value")
	// A reader looks a book up. This server is offline, so the lookup's call out
	// is refused and the lookup fails, and the call is what its job's log shows.
	srv.signUp("alice", "a-long-password")
	srv.send("POST", "/api/books/lookup", map[string]string{"title": "Dune"}, http.StatusBadGateway)
	// A job still waiting when the container is stopped. Shutdown's first step
	// interrupts it and logs its line, which only the log's last flush can keep.
	live := openData(t, dir)
	mustExec(t, live.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (60, 'fill', 'queued', 3)`)
	// The hold is on: a server that has booted, served four requests and made a
	// lookup's job has written none of it yet.
	if n := count(t, live.DB, `SELECT count(*) FROM system_logs`) + count(t, live.DB, `SELECT count(*) FROM job_logs`); n != 0 {
		t.Fatalf("%d lines were written before the stop, so the log is not held and this test proves no order", n)
	}
	live.Close()
	srv.stop()
	terminal := srv.out.String()

	st = openData(t, dir)
	kept := func(level, like string) int {
		return count(t, st.DB, `SELECT count(*) FROM system_logs WHERE level = ? AND line LIKE ?`, level, like)
	}
	for _, c := range []struct{ what, level, like string }{
		{"a boot line written through package log", "info", "tippani listening on http://127.0.0.1:%"},
		// openStore's integrity pass, logged before the logbook had a store.
		{"a boot line written before the store was open", "info", "[fts] books_fts OK"},
		{"the request, with its query value left out", "request", "GET /api/auth/status?probe=… 200 %"},
		// The line logged the moment the signal arrived.
		{"the shutdown's first line", "info", "received terminated — shutting down gracefully"},
	} {
		if kept(c.level, c.like) != 1 {
			t.Errorf("%s is not kept once at %s (%q):\n%s", c.what, c.level, c.like, terminal)
		}
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE level = 'warn' AND code = 'TIP-LOCALE-001'
		AND line LIKE '[locale] % both resolve to language "fr"%'`); n < 1 {
		t.Errorf("the coded warning is not kept at warn with its code beside it:\n%s", terminal)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE instr(line, 'Wv-kept-value') > 0`); n != 0 {
		t.Errorf("a query value was kept")
	}

	// The job the last run left: interrupted by this run's boot, with its line.
	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = 5 AND state = 'interrupted' AND finished_at IS NOT NULL`); n != 1 {
		t.Errorf("the job the previous run left running was not settled at boot")
	}
	if n := count(t, st.DB, `SELECT count(*) FROM job_logs WHERE job_id = 5 AND line = 'the server restarted while this job was running'`); n != 1 {
		t.Errorf("the settled job does not say why it was interrupted")
	}

	// The lookup: kept as alice's job, failed as its request did, and its log is
	// the call it made, refused.
	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE kind = 'lookup.book' AND state = 'failed'
		AND error = 'HTTP 502' AND user_id = (SELECT id FROM users WHERE username = 'alice')`); n != 1 {
		t.Errorf("the book lookup was not kept as alice's job:\n%s", terminal)
	}
	if lines := jobLines(t, st.DB, "lookup.book"); len(lines) == 0 ||
		!strings.HasPrefix(lines[0], "warn GET www.googleapis.com/books/v1/volumes?") ||
		!strings.HasSuffix(lines[0], " → refused (offline)") {
		t.Errorf("the lookup's log does not show its call out, refused: %q", lines)
	}

	// The job waiting at the stop: interrupted by shutdown, with its line.
	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = 60 AND state = 'interrupted'`); n != 1 {
		t.Errorf("the job waiting when the server stopped was not interrupted")
	}
	if n := count(t, st.DB, `SELECT count(*) FROM job_logs WHERE job_id = 60 AND line = 'the server stopped before this job started'`); n != 1 {
		t.Errorf("the job interrupted at the stop lost its line, so the log's pool closed before its last flush:\n%s", terminal)
	}

	// The checkpoint ran, and ran after the log was closed: its line is on the
	// terminal and not in the kept log, and nothing tried to write a line into
	// the closed log pool (which would say so with a TIP-LOG code).
	if !strings.Contains(terminal, "wal checkpointed into main database — clean shutdown") {
		t.Errorf("the shutdown did not checkpoint cleanly:\n%s", terminal)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line LIKE 'wal checkpointed%'`); n != 0 {
		t.Errorf("the checkpoint's line was kept, so the log was still open when the checkpoint ran")
	}
	if strings.Contains(terminal, "TIP-LOG-") {
		t.Errorf("the log failed to write during shutdown:\n%s", terminal)
	}
}

func TestTheCommandLineLeavesALiveServersRunningJobRunning(t *testing.T) {
	dir := t.TempDir()
	srv := serveOn(t, dir)
	// alice sets the server up, saves a quote and turns Pushover on; the daily
	// deck is on unless she turns it off.
	srv.signUp("alice", "a-long-password")
	var book struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(srv.send("POST", "/api/books", map[string]any{"title": "Meditations"}, http.StatusCreated), &book); err != nil {
		t.Fatal(err)
	}
	srv.send("POST", "/api/annotations", map[string]any{"book_id": book.ID,
		"quote": "You have power over your mind, not outside events. Realize this, and you will find strength."}, http.StatusCreated)
	srv.send("PUT", "/api/auth/notifications", map[string]any{"pushover_user": "ualice", "app_token": "tapp"}, http.StatusOK)

	st := openData(t, dir)
	var alice int64
	if err := st.DB.QueryRow(`SELECT id FROM users WHERE username = 'alice'`).Scan(&alice); err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{
		// bob wants the daily deck too and has nothing to be asked about; mitra
		// has no Pushover at all.
		`INSERT INTO users (id, username, password_hash, is_admin) VALUES (2, 'bob', 'x', 0), (3, 'mitra', 'x', 0)`,
		`INSERT INTO notify_settings (user_id, pushover_user, app_token) VALUES (2, 'ubob', 'tapp')`,
	} {
		mustExec(t, st.DB, q)
	}
	// The live server's own job, started after it booted: running now.
	mustExec(t, st.DB, `INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at)
		VALUES (90, ?, 'alice', 'covers', 'running', 1, 2)`, alice)

	run := func(stdin string, wantOK bool, args ...string) string {
		t.Helper()
		cmd := exec.Command(os.Args[0], args...)
		cmd.Env = binaryEnv(dir)
		cmd.Stdin = strings.NewReader(stdin)
		out, err := cmd.CombinedOutput()
		if (err == nil) != wantOK {
			t.Fatalf("tippani %s: %v (want it to succeed: %t)\n%s", strings.Join(args, " "), err, wantOK, out)
		}
		return string(out)
	}
	run("a-long-password\n", true, "user", "add", "carol")
	// The first morning: alice's quote is in its first week, which the daily
	// deck does not ask about, so nothing is due for anybody.
	deck := run("", true, "notify", "daily")

	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = 90 AND state = 'running' AND finished_at IS NULL`); n != 1 {
		t.Fatalf("a command-line tool settled the live server's running job under it")
	}
	var owner sql.NullInt64
	var state string
	if err := st.DB.QueryRow(`SELECT user_id, state FROM jobs WHERE kind = 'notify.daily'`).Scan(&owner, &state); err != nil {
		t.Fatalf("the daily deck was not kept as a job: %v\n%s", err, deck)
	}
	if owner.Valid || state != "succeeded" {
		t.Errorf("the daily deck's job: owner %v, %s — want no owner (the operator's cron started it), succeeded", owner, state)
	}
	want := []string{"info alice: not sent — nothing due", "info bob: not sent — nothing due"}
	if lines := jobLines(t, st.DB, "notify.daily"); fmt.Sprint(lines) != fmt.Sprint(want) {
		t.Errorf("the daily deck's log is %q, want one line per reader: %q\n(printed: %s)", lines, want, deck)
	}

	// A week and more later alice's quote is due, and the deck tells her phone.
	// This server is offline, so the call is refused and the run fails, and the
	// call is in the run's log. Nothing a reader does ages a quote, so the test
	// writes its date.
	mustExec(t, st.DB, `UPDATE annotations SET created_at = datetime('now', '-10 days')`)
	deck = run("", false, "notify", "daily")
	if err := st.DB.QueryRow(`SELECT state FROM jobs WHERE kind = 'notify.daily' ORDER BY id DESC LIMIT 1`).Scan(&state); err != nil || state != "failed" {
		t.Errorf("the run whose message was refused was kept as %q (%v), want failed\n%s", state, err, deck)
	}
	lines := jobLines(t, st.DB, "notify.daily")
	if len(lines) != 3 || lines[0] != "warn POST api.pushover.net/1/messages.json → refused (offline)" ||
		!strings.HasPrefix(lines[1], "info alice: not sent — ") || lines[2] != "info bob: not sent — nothing due" {
		t.Errorf("the daily deck's log is %q, want the refused call to Pushover and then a line per reader\n(printed: %s)", lines, deck)
	}
	srv.stop()
}

// A SERVER ON ITS OWN CERTIFICATE KEEPS A FAILED HANDSHAKE WITH THE REQUEST LINES.
// Somebody types http:// at a server that speaks only https — a scanner does the
// same all day on an open port. net/http says so in a line of its own, and it is
// kept at the request level, dropped first when the log is full, rather than as an
// info line kept to the last.
func TestAFailedHandshakeIsKeptWithTheRequestLines(t *testing.T) {
	dir := t.TempDir()
	cert, key := writeCertPair(t, t.TempDir(), "tippani.lan")
	srv := serveOn(t, dir, "TIPPANI_TLS_CERT="+cert, "TIPPANI_TLS_KEY="+key)
	if resp, err := http.Get("http://" + srv.addr + "/"); err == nil {
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("plain http at the https port was answered %d", resp.StatusCode)
		}
	}
	srv.get("/api/locales") // the same server, asked properly, as a control
	srv.stop()

	st := openData(t, dir)
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE level = 'request'
		AND line LIKE 'http: TLS handshake error from 127.0.0.1:%: client sent an HTTP request to an HTTPS server'`); n != 1 {
		t.Errorf("the failed handshake is not kept once at the request level:\n%s", srv.out)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE level = 'info' AND line LIKE 'http: %'`); n != 0 {
		t.Errorf("net/http's lines are kept at info")
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE level = 'request' AND line LIKE 'GET /api/locales 200 %'`); n != 1 {
		t.Errorf("the request asked over https is not kept:\n%s", srv.out)
	}
}

// A STOP WITH THE DATABASE LOCKED BY ANOTHER PROGRAM STILL ENDS INSIDE DOCKER'S
// GRACE. A `sqlite3` shell left in a transaction holds SQLite's write lock from
// before the stop until after it, so nothing the server writes at the stop can
// land. Each of those writes used to wait five seconds to find that out, and they
// added up past the SIGKILL. Now each gives up in time, the server says which
// lines it could not keep and that the checkpoint could not finish, and it exits
// cleanly; what it could not write, the next start settles.
func TestAStopWithTheDatabaseLockedElsewhereStillEndsInsideTheGrace(t *testing.T) {
	dir := t.TempDir()
	srv := serveOn(t, dir)
	srv.get("/api/locales")
	st := openData(t, dir)
	// A job waiting, so the queue has something to write at the stop.
	mustExec(t, st.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (7, 'fill', 'queued', 3)`)
	shell, err := st.DB.Begin() // the pool's transactions take the write lock at BEGIN
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	srv.stop() // fails the test unless the server exits cleanly inside ten seconds
	took := time.Since(start)
	shell.Rollback()
	terminal := srv.out.String()
	// Each step gave up on the lock and said so: the queue's write, the log's
	// last flush, the log pool's close (which leaves it to close by itself) and
	// the checkpoint, which folded back what it could.
	for _, want := range []string{
		"[error] TIP-JOBS-002 [jobs] stopping the queue: database is locked",
		"[error] TIP-LOG-005 the last log lines were not all kept in the database",
		"!! closing the log pool on shutdown returned: a log write was still waiting on the database",
		"[error] TIP-STORE-005 wal checkpoint on shutdown failed: another connection was still writing",
	} {
		if !strings.Contains(terminal, want) {
			t.Errorf("the terminal does not say %q:\n%s", want, terminal)
		}
	}
	// Those give up after half a second, one, one and two, and the log's own
	// write, already waiting when the stop began, after busy_timeout's five: about
	// five seconds in all. Any one of them waiting out busy_timeout as well puts
	// the stop at seven and more, and two at the edge of the SIGKILL.
	if took > 7*time.Second {
		t.Errorf("the stop took %s with the lock held elsewhere; its steps are bounded to end in about five", took)
	}

	again := serveOn(t, dir)
	again.stop()
	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = 7 AND state = 'interrupted'`); n != 1 {
		t.Errorf("the job the locked stop could not settle was not settled by the next start")
	}
}
