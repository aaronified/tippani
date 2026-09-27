package httpapi

import (
	"context"
	"database/sql"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"tippani/internal/jobs"
	"tippani/internal/olog"
	"tippani/internal/outbound"
	"tippani/internal/store"
)

// WHAT THE SERVER KEEPS OF A REQUEST, AND OF A LOOKUP MADE IN ONE.
//
// Every request is driven through the handler as a browser or a phone sends it,
// with a logbook attached and, where a lookup looks outward, the outbound hook
// installed exactly as serve() installs both (srv.Logbook, and
// outbound.SetObserver with the logbook's Outbound).
//
// WHAT IT KNOWS, declared because a test here may not know the code: the journal
// tables' names and columns (system_logs, jobs, job_logs), which it reads through
// srv.Store.DB. What it promises is what the database keeps, which no one read of
// the API shows whole: that what a request carried (a search's words, a share
// link's token, a saved key) is in no row and no column, a job's stored result
// included, which the API sends to its owner alone and shaped by its kind; that
// the log's own reading leaves no line, which a check made through that reading
// would take part in; and that a lookup kept for nobody is owned by no account,
// which the wire cannot tell from one owned by another. Also known: the Server's
// Logbook field, which is how serve() gives the server its logbook;
// and olog.CaptureForTest, because stdout and stderr are what an operator reads in
// `docker logs`. The restore test parks a lookup inside its outward call by
// wrapping the observer, because a restore landing between the moment a request
// is signed in and the moment its job is written is a window of microseconds that
// nothing a person does holds open; the restore itself is the API's. The test of a
// share link stuck at the door holds the pool full (store.HoldEveryConnectionForTest,
// as the health tests do, for the same reason: nothing a reader does puts a live
// server in that state), and installs olog's sink as serve() does (olog.SetSink),
// since the lines it reads are olog's. The test of a handler that panics puts its
// own handler behind the request logger (srv.logRequests), because no route in the
// app panics on any input — a panic is a bug by definition — and what is under test
// is what the logger keeps of one; the request goes through a real net/http server,
// which is what recovers the panic.
//
// What each one guards, in a sentence a person would say: the log keeps what a
// request did and not what it carried, a search's words or a share link, however
// the link is spelled, and a line naming a download stuck at the door keeps no link
// either; a request whose handler panics after looking outward is kept, line and
// job, as a 500; the terminal line is the one it always was; a picture is kept as a file and the Jobs
// tab's own reading is not kept at all; a lookup made with a saved key is kept as a
// job that shows every call it made, and the key is in no row and on no stream;
// and a lookup whose database was restored under it is kept for nobody.

// keeping gives srv a logbook, as serve() does, and closes it (flushed) before the
// store closes.
func keeping(t *testing.T, srv *Server) *jobs.Logbook {
	t.Helper()
	lb := jobs.NewLogbook()
	lb.Attach(srv.Store)
	srv.Logbook = lb
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		lb.Close(ctx)
	})
	return lb
}

func flushed(t *testing.T, lb *jobs.Logbook) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := lb.Flush(ctx); err != nil {
		t.Fatalf("the log was never written: %v", err)
	}
}

func column(t *testing.T, db *sql.DB, q string, args ...any) []string {
	t.Helper()
	rows, err := db.Query(q, args...)
	if err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		out = append(out, s)
	}
	return out
}

// kept is every system line as level and text, in order.
func kept(t *testing.T, srv *Server) []string {
	t.Helper()
	return column(t, srv.Store.DB, `SELECT level || ' ' || line FROM system_logs ORDER BY id`)
}

func TestTheLogKeepsWhatARequestDidAndNotWhatItCarried(t *testing.T) {
	srv := newTestServer(t)
	lb := keeping(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	terminal := olog.CaptureForTest(t)

	admin.mustDo("GET", "/books?q=Wv-searched-words&sort=title&empty=", nil, http.StatusOK)
	staged := decode[struct {
		URL string `json:"url"`
	}](t, admin.importFile("/share/image", "quote.png", append(append([]byte{}, pngHeader...), "card"...)))
	token := strings.TrimPrefix(staged.URL, "/share/image/")
	if token == "" || token == staged.URL {
		t.Fatalf("no share link came back: %q", staged.URL)
	}
	// The phone's download manager fetches the link with no session at all.
	anon := &testClient{t: t, h: h}
	anon.mustDo("GET", staged.URL, nil, http.StatusOK)
	// Two other spellings of the same link, which a person pasting or a client
	// normalising a URL can send: a letter escaped, which the router unescapes and
	// serves, and a doubled slash, which it redirects to the link.
	anon.mustDo("GET", "/api/share/%69mage/"+token, nil, http.StatusOK)
	if rec := anon.do("GET", "/api//share/image/"+token, nil); rec.Code/100 != 3 {
		t.Fatalf("the doubled slash was answered %d, not sent on to the link", rec.Code)
	}
	flushed(t, lb)

	lines := kept(t, srv)
	search := regexp.MustCompile(`^request GET /api/books\?q=…&sort=…&empty= 200 \S+ \d+B 192\.0\.2\.1:1234 alice r\d+$`)
	share := regexp.MustCompile(`^asset GET /api/share/image/… 200 \S+ \d+B 192\.0\.2\.1:1234 - r\d+$|^request GET /api/share/image/… 200 \S+ \d+B 192\.0\.2\.1:1234 - r\d+$`)
	redirected := regexp.MustCompile(`^request GET /api/share/image/… 3\d\d \S+ \d+B 192\.0\.2\.1:1234 - r\d+$`)
	var sawSearch, sawRedirect bool
	sawShare := 0
	for _, l := range lines {
		sawSearch = sawSearch || search.MatchString(l)
		sawRedirect = sawRedirect || redirected.MatchString(l)
		if share.MatchString(l) {
			sawShare++
		}
		if strings.Contains(l, "Wv-searched-words") || strings.Contains(l, token) {
			t.Errorf("a kept line holds what the request carried: %q", l)
		}
	}
	if !sawSearch || sawShare != 2 || !sawRedirect {
		t.Fatalf("the kept lines do not show the search (%t), the two share downloads (%d) and the redirect (%t) as they should:\n%s",
			sawSearch, sawShare, sawRedirect, strings.Join(lines, "\n"))
	}

	// THE TERMINAL LINE IS THE ONE IT ALWAYS WAS: the whole request URI, on its
	// own line with the standard timestamp, once.
	full := regexp.MustCompile(`(?m)^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2} GET /api/books\?q=Wv-searched-words&sort=title&empty= 200 \S+ \d+B 192\.0\.2\.1:1234 alice r\d+$`)
	if n := len(full.FindAllString(terminal.String(), -1)); n != 1 {
		t.Fatalf("the terminal shows the search's request line %d times, want once, unchanged:\n%s", n, terminal)
	}
	if !strings.Contains(terminal.String(), " GET /api/share/image/"+token+" 200 ") {
		t.Fatalf("the terminal's line for the share download changed:\n%s", terminal)
	}
}

// A SHARE LINK STUCK AT THE DOOR IS NAMED WITHOUT ITS TOKEN. The lines that name a
// request still running (a failed health check's) or refused (the database door's)
// go to the system log like the request's own line, and are kept as long, so they
// leave the token out too. The pool is held full, as the health tests hold it,
// which keeps the download waiting at the door while the health check fails, and
// then has the door refuse it.
func TestAShareDownloadStuckAtTheDoorIsNamedWithoutItsToken(t *testing.T) {
	srv := newTestServer(t)
	lb := keeping(t, srv)
	// serve()'s sink: the health check's and the door's lines are olog's.
	olog.SetSink(func(e olog.Entry) { lb.System(e.Level, e.Code, e.Line) })
	t.Cleanup(func() { olog.SetSink(nil) })
	h := srv.Handler()
	admin := signupAdmin(t, h)
	staged := decode[struct {
		URL string `json:"url"`
	}](t, admin.importFile("/share/image", "quote.png", append(append([]byte{}, pngHeader...), "card"...)))
	token := strings.TrimPrefix(staged.URL, "/share/image/")
	if token == "" || token == staged.URL {
		t.Fatalf("no share link came back: %q", staged.URL)
	}

	held := store.HoldEveryConnectionForTest(t, srv.Store.DB)
	waits := srv.Store.DB.Stats().WaitCount
	done := make(chan int, 1)
	anon := &testClient{t: t, h: h}
	go func() { done <- anon.do("GET", staged.URL, nil).Code }()
	for i := 0; srv.Store.DB.Stats().WaitCount == waits; i++ {
		if i > 400 {
			t.Fatal("the download never queued for a connection")
		}
		time.Sleep(5 * time.Millisecond)
	}
	if rec := healthz(h); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("/healthz while the download waits on a held pool: got %d, want 503", rec.Code)
	}
	select {
	case code := <-done:
		if code != http.StatusServiceUnavailable {
			t.Fatalf("the download, with no connection to be had: got %d, want 503 at the door", code)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("the download was still waiting at the door after 20s")
	}
	store.ReleaseForTest(held)
	flushed(t, lb)

	var health, door bool
	for _, l := range kept(t, srv) {
		health = health || strings.HasPrefix(l, "error GET /healthz: ") && strings.Contains(l, "GET /api/share/image/… ")
		door = door || strings.HasPrefix(l, "error GET /api/share/image/… (req r")
		if strings.Contains(l, token) {
			t.Errorf("a kept line holds the share link's token: %q", l)
		}
	}
	if !health || !door {
		t.Fatalf("the kept log does not name the download in the failed health check (%t) and at the door (%t):\n%s",
			health, door, strings.Join(kept(t, srv), "\n"))
	}
}

// A HANDLER THAT PANICS AFTER LOOKING OUTWARD IS STILL KEPT. net/http recovers the
// panic and the server goes on, so this request is the one somebody opens the log
// to find: its line is there as a 500, and so is its job, failed, with the call it
// made before the panic.
func TestAHandlerThatPanicsAfterLookingOutwardIsStillKept(t *testing.T) {
	t.Setenv(outbound.EnvVar, "1")
	srv := newTestServer(t)
	lb := keeping(t, srv)
	outbound.SetObserver(lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	ts := httptest.NewUnstartedServer(srv.logRequests(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://books.example.org/volumes?q=Dune", nil)
		if err != nil {
			t.Error(err)
		} else if _, err := (&http.Client{Transport: outbound.Transport(nil)}).Do(req); err == nil {
			t.Error("offline, and the call went out")
		}
		panic("a bug in the handler")
	})))
	// net/http's own line about the panic, which is not what this test reads.
	ts.Config.ErrorLog = log.New(io.Discard, "", 0)
	ts.Start()
	t.Cleanup(ts.Close)

	if resp, err := http.Get(ts.URL + "/api/books/lookup"); err == nil {
		resp.Body.Close()
		t.Fatalf("the handler panicked and the client was answered %d", resp.StatusCode)
	}
	flushed(t, lb)

	line := regexp.MustCompile(`^request GET /api/books/lookup 500 \S+ \d+B 127\.0\.0\.1:\d+ - r\d+$`)
	found := false
	for _, l := range kept(t, srv) {
		found = found || line.MatchString(l)
	}
	if !found {
		t.Errorf("the request whose handler panicked left no line as a 500:\n%s", strings.Join(kept(t, srv), "\n"))
	}
	var id int64
	var state, errText string
	if err := srv.Store.DB.QueryRow(`SELECT id, state, error FROM jobs`).Scan(&id, &state, &errText); err != nil {
		t.Fatalf("the request looked outward and then panicked, and left no job: %v", err)
	}
	calls := column(t, srv.Store.DB, `SELECT level || ' ' || line FROM job_logs WHERE job_id = ?`, id)
	if state != "failed" || errText != "HTTP 500" ||
		len(calls) != 1 || calls[0] != "warn GET books.example.org/volumes?q=Dune → refused (offline)" {
		t.Fatalf("the job is %s (%q) with %q; want failed (HTTP 500) with its refused call", state, errText, calls)
	}
}

func TestAPictureIsKeptAsAFileAndTheLogsOwnReadingIsNotKept(t *testing.T) {
	srv := newTestServer(t)
	srv.Static = fstest.MapFS{"index.html": {Data: []byte("<!doctype html><title>Tippani</title>")}}
	lb := keeping(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	if err := os.WriteFile(filepath.Join(srv.coversDir(), "aabbccddeeff0011.png"), pngHeader, 0o600); err != nil {
		t.Fatal(err)
	}

	admin.mustDo("GET", "/covers/aabbccddeeff0011.png", nil, http.StatusOK)
	admin.mustDo("GET", "/covers/ffffffffffffffff.png", nil, http.StatusNotFound)
	page := httptest.NewRecorder()
	h.ServeHTTP(page, httptest.NewRequest("GET", "/library", nil))
	if page.Code != http.StatusOK {
		t.Fatalf("the app's page: %d", page.Code)
	}
	// The Jobs tab's own polling, and the start of a job, which is not a read.
	for _, p := range []string{"/jobs?view=current", "/jobs/summary", "/jobs/12?log_after=3", "/admin/logs?level=error", "/admin/logs.md?all=1"} {
		admin.do("GET", p, nil)
	}
	admin.do("POST", "/jobs", map[string]any{"kind": "fill"})
	flushed(t, lb)

	lines := kept(t, srv)
	want := []*regexp.Regexp{
		regexp.MustCompile(`^asset GET /api/covers/aabbccddeeff0011\.png 200 `),
		// A picture that is missing is what somebody opens the log to find.
		regexp.MustCompile(`^request GET /api/covers/ffffffffffffffff\.png 404 `),
		regexp.MustCompile(`^asset GET /library 200 `),
		regexp.MustCompile(`^request POST /api/jobs \d{3} `),
	}
	for _, re := range want {
		found := false
		for _, l := range lines {
			found = found || re.MatchString(l)
		}
		if !found {
			t.Errorf("no kept line matches %s:\n%s", re, strings.Join(lines, "\n"))
		}
	}
	for _, l := range lines {
		if strings.Contains(l, "GET /api/jobs") || strings.Contains(l, "GET /api/admin/logs") {
			t.Errorf("the log kept its own reading: %q", l)
		}
	}
}

// The keys a reader saved in Settings: a Google Books key, and a TMDB v3 key
// (32 hex characters), which TMDB's client sends in the query string.
const (
	savedGoogleKey = "AIzaSavedGoogleKey4471"
	savedTMDBKey   = "5ac1d2e3f4a5b6c7d8e9f0a1b2c3d4e5"
)

func TestALookupWithASavedKeyIsKeptAsAJobAndTheKeyIsNowhere(t *testing.T) {
	t.Setenv(outbound.EnvVar, "1")
	srv := newTestServer(t)
	lb := keeping(t, srv)
	outbound.SetObserver(lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	h := srv.Handler()
	admin := signupAdmin(t, h)
	admin.mustDo("PUT", "/admin/metadata-keys", map[string]any{
		"google_books_key": savedGoogleKey, "tmdb_key": savedTMDBKey}, http.StatusOK)
	terminal := olog.CaptureForTest(t)

	book := admin.do("POST", "/books/lookup", map[string]string{"title": "Dune"})
	film := admin.do("POST", "/movies/lookup", map[string]string{"title": "Dune"})
	flushed(t, lb)

	type job struct {
		id    int64
		uid   sql.NullInt64
		state string
	}
	jobOf := func(kind string) job {
		t.Helper()
		var j job
		if err := srv.Store.DB.QueryRow(`SELECT id, user_id, state FROM jobs WHERE kind = ?`, kind).
			Scan(&j.id, &j.uid, &j.state); err != nil {
			t.Fatalf("the lookup left no %s job: %v", kind, err)
		}
		return j
	}
	for _, c := range []struct {
		kind, call string
		status     int
	}{
		{"lookup.book", "GET www.googleapis.com/books/v1/volumes?", book.Code},
		{"lookup.movie", "GET api.themoviedb.org/3/search/movie?", film.Code},
	} {
		j := jobOf(c.kind)
		wantState := "succeeded"
		if c.status >= 400 {
			wantState = "failed"
		}
		if !j.uid.Valid || j.uid.Int64 != userID1(t, srv) || j.state != wantState {
			t.Errorf("%s: owner %v, state %s — want alice's, %s (the request answered %d)", c.kind, j.uid, j.state, wantState, c.status)
		}
		lines := column(t, srv.Store.DB, `SELECT level || ' ' || line FROM job_logs WHERE job_id = ? ORDER BY id`, j.id)
		found := false
		for _, l := range lines {
			if strings.HasPrefix(l, "warn "+c.call) && strings.HasSuffix(l, " → refused (offline)") && strings.Contains(l, "key=…") {
				found = true
			}
		}
		if !found {
			t.Errorf("%s's log does not show its refused call to %s with the key hidden:\n%s", c.kind, c.call, strings.Join(lines, "\n"))
		}
	}

	for _, key := range []string{savedGoogleKey, savedTMDBKey} {
		for _, q := range []string{
			`SELECT count(*) FROM system_logs WHERE instr(line, ?) > 0`,
			`SELECT count(*) FROM job_logs WHERE instr(line, ?) > 0`,
			`SELECT count(*) FROM jobs WHERE instr(error || subject || params || result, ?) > 0`,
		} {
			var n int
			if err := srv.Store.DB.QueryRow(q, key).Scan(&n); err != nil || n != 0 {
				t.Errorf("a saved key is kept: %d row(s) for %s (%v)", n, q, err)
			}
		}
		if strings.Contains(terminal.String(), key) {
			t.Errorf("a saved key reached stdout or stderr:\n%s", terminal)
		}
	}
}

func userID1(t *testing.T, srv *Server) int64 {
	t.Helper()
	var id int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM users WHERE username = 'alice'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestALookupWhoseDatabaseWasRestoredUnderItIsKeptForNobody(t *testing.T) {
	t.Setenv(outbound.EnvVar, "1")
	srv := newTestServer(t)
	lb := keeping(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)

	// The first lookup, with nothing in its way, is alice's: the owner is noted.
	outbound.SetObserver(lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	admin.do("POST", "/books/lookup", map[string]string{"title": "Dune"})
	flushed(t, lb)
	var first int64
	if err := srv.Store.DB.QueryRow(`SELECT id FROM jobs WHERE kind = 'lookup.book' AND user_id = ?`, userID1(t, srv)).Scan(&first); err != nil {
		t.Fatalf("an ordinary lookup was not kept as alice's: %v", err)
	}

	backupNow(admin)
	safetyBackup(t, admin)

	// The second parks inside its first outward call until the restore is done.
	parked, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	outbound.SetObserver(func(req *http.Request, resp *http.Response, err error, took time.Duration) {
		lb.Outbound(req, resp, err, took)
		once.Do(func() {
			close(parked)
			<-release
		})
	})
	done := make(chan int, 1)
	go func() { done <- admin.do("POST", "/books/lookup", map[string]string{"title": "Dune"}).Code }()
	select {
	case <-parked:
	case <-time.After(20 * time.Second):
		t.Fatal("the lookup never looked outward")
	}
	admin.mustDo("POST", "/admin/restore", map[string]any{"password": testPw}, http.StatusOK)
	close(release)
	<-done
	flushed(t, lb)

	// Alice is in the restored database under the same id and name, so nothing
	// but the swap itself says the id may not be hers: the job goes to the admin.
	var owner sql.NullInt64
	if err := srv.Store.DB.QueryRow(`SELECT user_id FROM jobs WHERE kind = 'lookup.book' AND id > ? ORDER BY id LIMIT 1`, first).
		Scan(&owner); err != nil {
		t.Fatalf("the lookup the restore landed under was not kept: %v", err)
	}
	if owner.Valid {
		t.Fatalf("the lookup the restore landed under was kept as user %d's; it began in the database the restore replaced", owner.Int64)
	}
	if userID1(t, srv) == 0 {
		t.Fatal("alice is not in the restored database, so this proves nothing")
	}
}

// SIGNING IN THROUGH THE OPERATOR'S OWN PROVIDER LOOKS OUTWARD TOO, AND IS KEPT.
// Offline, because that provider is observed and never refused: switching the
// app offline must not lock anybody out, and the calls are recorded all the same.
// The callback's one-time code and state are in the query, and the kept line
// leaves their values out.
func TestASignInThroughTheOperatorsProviderIsKeptWithItsCalls(t *testing.T) {
	t.Setenv(outbound.EnvVar, "1")
	srv := newTestServer(t)
	lb := keeping(t, srv)
	outbound.SetObserver(lb.Outbound)
	t.Cleanup(func() { outbound.SetObserver(nil) })
	idp := withOIDC(t, srv)
	srv.OIDCAutoCreate = true
	h := srv.Handler()

	if _, cookie := signInWithOIDC(t, h, idp, "", nil); cookie == nil {
		t.Fatal("offline, the operator's own provider could not sign anybody in")
	}
	flushed(t, lb)

	host := strings.TrimPrefix(idp.srv.URL, "http://")
	calls := column(t, srv.Store.DB, `SELECT l.line FROM job_logs l JOIN jobs j ON j.id = l.job_id
		WHERE j.kind = 'signin.oidc' ORDER BY l.id`)
	for _, want := range []string{
		"GET " + host + "/.well-known/openid-configuration → 200 · ",
		"POST " + host + "/token → 200 · ",
	} {
		found := false
		for _, c := range calls {
			found = found || strings.HasPrefix(c, want)
		}
		if !found {
			t.Errorf("no sign-in job shows %q…; the sign-in jobs' lines:\n%s", want, strings.Join(calls, "\n"))
		}
	}
	lines := kept(t, srv)
	callback := regexp.MustCompile(`^request GET /api/auth/oidc/callback\?code=…&state=… 302 `)
	found := false
	for _, l := range lines {
		found = found || callback.MatchString(l)
		if strings.Contains(l, "good-code") {
			t.Errorf("the kept log holds the callback's one-time code: %q", l)
		}
	}
	if !found {
		t.Errorf("the callback's kept line is missing or keeps its values:\n%s", strings.Join(lines, "\n"))
	}
}
