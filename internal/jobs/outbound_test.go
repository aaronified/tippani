package jobs_test

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/outbound"
)

// EVERY CALL THAT LEAVES THE APP IS ONE LINE, IN THE LOG OF WHOEVER IT WAS FOR,
// AND NO LINE KEEPS A KEY.
//
// WHAT IT KNOWS, declared: the package's exported API and outbound's (the
// observer is installed exactly as serve() installs it, outbound.SetObserver with
// the logbook's Outbound), and the jobs, job_logs and system_logs tables, which
// it reads back because the endpoints that show them are httpapi's, a package
// that imports this one and cannot be reached from its tests.
// The calls are real: a real client through the real gate, to a real server on
// this machine that answers the way a provider does, at the URL shape TMDB v3's
// client builds (the key in api_key=). The kind is the test's own, one call and
// done, so "one line per call" can be counted exactly.
//
// What each one guards, in a sentence a person would say: a job that looked
// something up shows what it asked and what came back, without the key; a lookup
// made in a request is kept as a job with that same line; a call nobody's job made
// is still in the system log; and a call a provider refused, one nothing answered
// and one the offline switch refused are each a warning that says which.

const probeKey = "tmdbV3probeKey0123456789abcdef"

// provider answers like a search endpoint: a small JSON body of a declared length.
func provider(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[]}`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func observing(t *testing.T, lb *jobs.Logbook) {
	t.Helper()
	outbound.SetObserver(lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
}

func search(ctx context.Context, base string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		base+"/3/search/movie?query=Dune&api_key="+probeKey, nil)
	if err != nil {
		return err
	}
	resp, err := (&http.Client{Transport: outbound.Transport(nil)}).Do(req)
	if err != nil {
		return err
	}
	return resp.Body.Close()
}

// keyAnywhere fails the test if the key is in any row the log keeps.
func keyAnywhere(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, q := range []string{
		`SELECT count(*) FROM job_logs WHERE instr(line, ?) > 0`,
		`SELECT count(*) FROM system_logs WHERE instr(line, ?) > 0`,
		`SELECT count(*) FROM jobs WHERE instr(error || subject || params || result, ?) > 0`,
	} {
		if n := count(t, db, q, probeKey); n != 0 {
			t.Errorf("%d row(s) keep the key: %s", n, q)
		}
	}
}

func TestAJobThatLookedSomethingUpShowsTheCallWithoutTheKey(t *testing.T) {
	t.Setenv(outbound.EnvVar, "")
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash) VALUES (1, 'aro', 'x')`)
	lb := attached(t, st)
	observing(t, lb)
	srv := provider(t)

	r := jobs.NewRunner(st, lb, jobs.Options{})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		r.Close(ctx)
	})
	r.Register(jobs.Kind{Name: "probe", Run: func(ctx context.Context, _ *jobs.Job) error { return search(ctx, srv.URL) }})
	id, err := r.Enqueue(jobs.Owner{UserID: 1, Username: "aro", Gen: st.Generation()}, "probe", "", nil, 1, nil)
	if err != nil {
		t.Fatal(err)
	}
	eventually(t, "the probe job succeeds", func() bool {
		return count(t, st.DB, `SELECT count(*) FROM jobs WHERE id = ? AND state = 'succeeded'`, id) == 1
	})
	flush(t, lb)

	host := strings.TrimPrefix(srv.URL, "http://")
	lines := strings1(t, st.DB, `SELECT level || ' ' || line FROM job_logs WHERE job_id = ? ORDER BY id`, id)
	if len(lines) != 1 {
		t.Fatalf("one call, and the job's log holds %d lines: %q", len(lines), lines)
	}
	want := "info GET " + host + "/3/search/movie?query=Dune&api_key=… → 200 · "
	if !strings.HasPrefix(lines[0], want) || !strings.HasSuffix(lines[0], " ms · 14 B") {
		t.Fatalf("the job's line is %q, want %q… ms · 14 B", lines[0], want)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM system_logs WHERE line LIKE '[outbound]%'`); n != 0 {
		t.Fatalf("the job's call was also put in the system log (%d lines): it belongs to the job", n)
	}
	keyAnywhere(t, st.DB)
}

func TestALookupInARequestIsKeptAsAJobWithItsCall(t *testing.T) {
	t.Setenv(outbound.EnvVar, "")
	st := openStore(t)
	exec(t, st.DB, `INSERT INTO users (id, username, password_hash) VALUES (4, 'mitra', 'x')`)
	lb := attached(t, st)
	observing(t, lb)
	srv := provider(t)

	l := jobs.NewLazy(lb, func(p string) string { return map[string]string{"POST /movies/lookup": "lookup.movie"}[p] })
	l.Viewer(4, "mitra", st.Generation())
	l.Route("POST /movies/lookup")
	if err := search(jobs.WithRecorder(context.Background(), l), srv.URL); err != nil {
		t.Fatal(err)
	}
	l.Finish(http.StatusOK)
	flush(t, lb)

	var id, uid int64
	var kind string
	if err := st.DB.QueryRow(`SELECT id, user_id, kind FROM jobs`).Scan(&id, &uid, &kind); err != nil {
		t.Fatalf("the lookup left no job: %v", err)
	}
	if uid != 4 || kind != "lookup.movie" {
		t.Fatalf("the lookup's job is %s for user %d, want lookup.movie for 4", kind, uid)
	}
	lines := strings1(t, st.DB, `SELECT line FROM job_logs WHERE job_id = ?`, id)
	if len(lines) != 1 || !strings.Contains(lines[0], "/3/search/movie?query=Dune&api_key=… → 200 · ") {
		t.Fatalf("the lookup's job log: %q", lines)
	}
	keyAnywhere(t, st.DB)
}

func TestACallNobodysJobMadeIsInTheSystemLogAndARefusalSaysSo(t *testing.T) {
	st := openStore(t)
	lb := attached(t, st)
	observing(t, lb)
	srv := provider(t)
	host := strings.TrimPrefix(srv.URL, "http://")
	// A provider having a bad day, and one that is not there at all: a port
	// that was free a moment ago, so nothing answers on it.
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "try again later", http.StatusServiceUnavailable)
	}))
	t.Cleanup(down.Close)
	gone := httptest.NewServer(http.NotFoundHandler())
	gone.Close()

	t.Setenv(outbound.EnvVar, "")
	if err := search(context.Background(), srv.URL); err != nil {
		t.Fatal(err)
	}
	if err := search(context.Background(), down.URL); err != nil {
		t.Fatal(err)
	}
	if err := search(context.Background(), gone.URL); err == nil {
		t.Fatal("a call to a closed port was answered")
	}
	t.Setenv(outbound.EnvVar, "1")
	if err := search(context.Background(), srv.URL); err == nil {
		t.Fatal("offline, and the call went out")
	}
	flush(t, lb)

	lines := strings1(t, st.DB, `SELECT level || ' ' || line FROM system_logs ORDER BY id`)
	if len(lines) != 4 {
		t.Fatalf("four calls, and the system log holds %d lines: %q", len(lines), lines)
	}
	went := "info [outbound] GET " + host + "/3/search/movie?query=Dune&api_key=… → 200 · "
	if !strings.HasPrefix(lines[0], went) {
		t.Errorf("the call that went out: %q, want %q…", lines[0], went)
	}
	// An answer of 400 or worse is a warning: the lookup did not get what it
	// asked for, even though the call itself worked.
	failed := "warn [outbound] GET " + strings.TrimPrefix(down.URL, "http://") + "/3/search/movie?query=Dune&api_key=… → 503 · "
	if !strings.HasPrefix(lines[1], failed) {
		t.Errorf("the call a provider answered 503: %q, want %q…", lines[1], failed)
	}
	// A call that never got an answer says why, in the transport's words.
	broke := "warn [outbound] GET " + strings.TrimPrefix(gone.URL, "http://") + "/3/search/movie?query=Dune&api_key=… → error: "
	if !strings.HasPrefix(lines[2], broke) || len(lines[2]) == len(broke) {
		t.Errorf("the call nothing answered: %q, want %q and the reason", lines[2], broke)
	}
	refused := "warn [outbound] GET " + host + "/3/search/movie?query=Dune&api_key=… → refused (offline)"
	if lines[3] != refused {
		t.Errorf("the refused call: %q, want %q", lines[3], refused)
	}
	if n := count(t, st.DB, `SELECT count(*) FROM jobs`); n != 0 {
		t.Errorf("a call with no job or request made %d job(s)", n)
	}
	keyAnywhere(t, st.DB)
}
