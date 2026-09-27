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
// and the users and notify_settings tables, to give the daily deck two readers
// without driving Pushover's settings screen. Every server runs with
// TIPPANI_OFFLINE=1, so nothing here reaches the internet.
//
// What each one guards, in a sentence a person would say: when the container is
// stopped, the last lines it logged are kept, a job the previous run left is
// interrupted with its line, and the checkpoint runs after the log is closed, not
// before; the boot lines and a coded warning are kept at their levels; and the
// command-line tools leave a live server's running job running, while the daily
// deck is kept as a job of its own.

import (
	"bytes"
	"database/sql"
	"fmt"
	"net"
	"net/http"
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
	base   string
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

func serveOn(t *testing.T, dir string) *served {
	t.Helper()
	addr := freeAddr(t)
	s := &served{t: t, base: "http://" + addr, out: &bytes.Buffer{}, exited: make(chan error, 1)}
	s.cmd = exec.Command(os.Args[0], "serve")
	s.cmd.Env = binaryEnv(dir, "TIPPANI_BIND="+addr)
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
		if resp, err := http.Get(s.base + "/healthz"); err == nil {
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
	resp, err := http.Get(s.base + path)
	if err != nil {
		s.t.Fatalf("GET %s: %v", path, err)
	}
	resp.Body.Close()
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

	srv := serveOn(t, dir)
	srv.get("/api/locales")
	srv.get("/api/auth/status?probe=Wv-kept-value")
	// A job still waiting when the container is stopped. Shutdown's first step
	// interrupts it and logs its line a moment before the log's last flush, so
	// the line is kept only if that flush comes before the log pool closes.
	live := openData(t, dir)
	mustExec(t, live.DB, `INSERT INTO jobs (id, kind, state, created_at) VALUES (6, 'fill', 'queued', 3)`)
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
		// The line logged the moment the signal arrived: kept, so the log was
		// written before its pool closed.
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

	// The job waiting at the stop: interrupted by shutdown, with its line.
	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = 6 AND state = 'interrupted'`); n != 1 {
		t.Errorf("the job waiting when the server stopped was not interrupted")
	}
	if n := count(t, st.DB, `SELECT count(*) FROM job_logs WHERE job_id = 6 AND line = 'the server stopped before this job started'`); n != 1 {
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
	st := openData(t, dir)
	for _, q := range []string{
		`INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'alice', 'x', 1), (2, 'bob', 'x', 0), (3, 'mitra', 'x', 0)`,
		// Two readers want the daily deck; mitra has no Pushover at all.
		`INSERT INTO notify_settings (user_id, pushover_user, app_token) VALUES (1, 'ualice', 'tapp'), (2, 'ubob', 'tapp')`,
	} {
		mustExec(t, st.DB, q)
	}
	st.Close()

	srv := serveOn(t, dir)
	// The live server's own job, started after it booted: running now.
	st = openData(t, dir)
	mustExec(t, st.DB, `INSERT INTO jobs (id, user_id, username, kind, state, created_at, started_at)
		VALUES (9, 1, 'alice', 'covers', 'running', 1, 2)`)

	run := func(stdin string, args ...string) string {
		t.Helper()
		cmd := exec.Command(os.Args[0], args...)
		cmd.Env = binaryEnv(dir)
		cmd.Stdin = strings.NewReader(stdin)
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("tippani %s: %v\n%s", strings.Join(args, " "), err, out)
		}
		return string(out)
	}
	run("a-long-password\n", "user", "add", "carol")
	deck := run("", "notify", "daily")

	if n := count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = 9 AND state = 'running' AND finished_at IS NULL`); n != 1 {
		t.Fatalf("a command-line tool settled the live server's running job under it")
	}
	var id int64
	var owner sql.NullInt64
	var state string
	if err := st.DB.QueryRow(`SELECT id, user_id, state FROM jobs WHERE kind = 'notify.daily'`).Scan(&id, &owner, &state); err != nil {
		t.Fatalf("the daily deck was not kept as a job: %v\n%s", err, deck)
	}
	if owner.Valid || state != "succeeded" {
		t.Errorf("the daily deck's job: owner %v, %s — want no owner (the operator's cron started it), succeeded", owner, state)
	}
	var lines []string
	rows, err := st.DB.Query(`SELECT line FROM job_logs WHERE job_id = ? ORDER BY id`, id)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var l string
		rows.Scan(&l)
		lines = append(lines, l)
	}
	rows.Close()
	want := []string{"alice: not sent — nothing due", "bob: not sent — nothing due"}
	if fmt.Sprint(lines) != fmt.Sprint(want) {
		t.Errorf("the daily deck's log is %q, want one line per reader: %q\n(printed: %s)", lines, want, deck)
	}
	srv.stop()
}
