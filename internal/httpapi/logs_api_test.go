package httpapi

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"syscall"
	"testing"
	"testing/fstest"
	"time"

	"tippani/internal/olog"
)

// AN ADMIN READS THE SERVER'S OWN LOG, NARROWS IT, AND EXPORTS IT.
//
// The reads and the exports are driven through the API as Settings › Jobs ›
// System logs drives them, as the admin and as a reader.
//
// WHAT IT KNOWS, declared because a test here may not know the code: the lines
// under test are printed through olog, as the server's own code prints them, with
// olog's sink installed as serve() installs it (olog.SetSink into the logbook) —
// no request makes the server print a line of the test's choosing, and what is
// under test is what the log does with the lines it gets. The request and file
// lines come from real requests (the SPA served from srv.Static, as the request
// log's own test serves it). One line is written straight into system_logs,
// 31 days old, because no line can be logged in the past, and sixty thousand
// more in one statement, because no request logs that many in a test's time.
// And the wire field names, which are the contract the screen is built to.
//
// The downloads nobody reads are real sockets to a real listener, each with a
// small receive buffer, which read the status line and then nothing: a client
// that stops reading is a socket that stops draining, and the recorder the other
// tests use never blocks. The time an export waits for such a client is
// shortened (exportIdle) for the part that waits it out, so that part takes a
// second and not a minute. And two tests swap the database files under an export
// (Store.Swap with nothing to move, then rebindDB, as a restore does): one under
// an export that has stalled part-way, which is the one way to land a swap
// between two of its batches on demand, and one from afterFencePass, the seam
// that runs as the export's fence pass ends, which is the one way to land it
// between the export's first reads and its first line.
//
// What each one guards, in a sentence a person would say: only an admin reads
// the system log; it shows every level but file requests and traces unless asked,
// and exactly the levels asked for; a time range keeps the lines inside it; a
// keyword is matched without regard to case and a % or _ in it means itself; a
// page ends where the next begins; nothing older than thirty days is shown; the
// export holds exactly what the filters show, or everything kept, one line per
// line inside a fence no line can close; downloads nobody is reading leave the
// app answering everyone else, and are given up on in the end; an export the
// database is swapped under says where it stopped, and sends none of the new
// database's lines when the swap comes before its first.

// logging gives srv a logbook and routes olog into it, as serve() does.
func logging(t *testing.T, srv *Server) {
	t.Helper()
	lb := keeping(t, srv)
	olog.SetSink(func(e olog.Entry) { lb.System(e.Level, e.Code, e.Line) })
	t.Cleanup(func() { olog.SetSink(nil) })
}

// openPage is a browser opening a screen's address: the server answers with the
// SPA, a file.
func openPage(t *testing.T, h http.Handler, path string) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("opening %s: %d", path, rec.Code)
	}
}

type logLine struct {
	ID    int64  `json:"id"`
	At    int64  `json:"at"`
	Level string `json:"level"`
	Code  string `json:"code"`
	Line  string `json:"line"`
}

type logPage struct {
	Lines []logLine `json:"lines"`
	More  bool      `json:"more"`
}

func (c *testClient) logs(query url.Values) logPage {
	c.t.Helper()
	return decode[logPage](c.t, c.mustDo("GET", "/admin/logs?"+query.Encode(), nil, http.StatusOK))
}

// marked is the lines of a page that carry marker, as "level line".
func marked(p logPage, marker string) []string {
	var out []string
	for _, l := range p.Lines {
		if strings.Contains(l.Line, marker) {
			out = append(out, l.Level+" "+l.Line)
		}
	}
	return out
}

func TestAnAdminNarrowsTheSystemLogByLevelTimeAndKeyword(t *testing.T) {
	srv := newTestServer(t)
	logging(t, srv)
	srv.Static = fstest.MapFS{"index.html": {Data: []byte("<!doctype html><title>Tippani</title>")}}
	h := srv.Handler()
	admin := signupAdmin(t, h)
	bob := addUser(t, h, admin, "bob")

	bob.mustDo("GET", "/admin/logs", nil, http.StatusForbidden)
	bob.mustDo("GET", "/admin/logs.md", nil, http.StatusForbidden)
	bob.mustDo("GET", "/admin/logs.md?all=1", nil, http.StatusForbidden)

	olog.Errorf(olog.CodeJobRead, "[test] Wv-log the disk said no")
	olog.Warnf(olog.CodeJobRead, "[test] Wv-log 50%% off")
	olog.Printf("[test] Wv-log 50X off")
	olog.Printf("[test] Wv-log a_b")
	olog.Printf("[test] Wv-log aXb")
	bob.mustDo("GET", "/books?Wv-log", nil, http.StatusOK) // a request line
	openPage(t, h, "/library/Wv-log")                      // a file line: the SPA

	raw := admin.mustDo("GET", "/admin/logs?q=Wv-log", nil, http.StatusOK)
	var wire []json.RawMessage
	json.Unmarshal(shaped(t, "GET /admin/logs", raw.Body.Bytes(), "lines", "more")["lines"], &wire)
	if len(wire) == 0 {
		t.Fatalf("no lines: %s", raw.Body)
	}
	shaped(t, "a system line", wire[0], "id", "at", "level", "code", "line")
	all := admin.logs(url.Values{"q": {"Wv-log"}})
	got := strings.Join(marked(all, "Wv-log"), "\n")
	for _, want := range []string{"error [test] Wv-log the disk said no", "warn [test] Wv-log 50% off",
		"info [test] Wv-log 50X off", "info [test] Wv-log a_b", "info [test] Wv-log aXb", "request GET /api/books?Wv-log 200 "} {
		if !strings.Contains(got, want) {
			t.Fatalf("the default levels do not show %q:\n%s", want, got)
		}
	}
	if strings.Contains(got, "asset") || strings.Contains(got, "/library/Wv-log") {
		t.Fatalf("the default levels show a file request:\n%s", got)
	}
	// Newest first.
	if all.Lines[0].Level != "request" || all.Lines[len(all.Lines)-1].Level != "error" {
		t.Fatalf("not newest first: %v", marked(all, "Wv-log"))
	}
	// The code is kept beside the line, not in it.
	if oldest := all.Lines[len(all.Lines)-1]; oldest.Code != "TIP-JOBS-003" || strings.Contains(oldest.Line, "TIP-") || all.Lines[0].Code != "" {
		t.Fatalf("the codes: %+v", all.Lines)
	}

	for query, want := range map[string][]string{
		"level=error":       {"error [test] Wv-log the disk said no"},
		"level=asset":       {"asset GET /library/Wv-log 200"},
		"level=warn,error":  {"warn [test] Wv-log 50% off", "error [test] Wv-log the disk said no"},
		"q=50%25":           {"warn [test] Wv-log 50% off"},
		"q=A_B":             {"info [test] Wv-log a_b"},
		"q=wv-LOG+THE+DISK": {"error [test] Wv-log the disk said no"},
	} {
		v, _ := url.ParseQuery(query)
		if !v.Has("q") {
			v.Set("q", "Wv-log")
		}
		got := marked(admin.logs(v), "Wv-log")
		if len(got) != len(want) {
			t.Fatalf("%s: %q, want %q", query, got, want)
		}
		for i := range want {
			if !strings.HasPrefix(got[i], want[i]) {
				t.Fatalf("%s: %q, want %q", query, got, want)
			}
		}
	}
	admin.mustDo("GET", "/admin/logs?level=loud", nil, http.StatusBadRequest)
	admin.mustDo("GET", "/admin/logs?from=yesterday", nil, http.StatusBadRequest)

	// A time range keeps the lines inside it, both ends included.
	olog.Printf("[test] Wv-range before")
	time.Sleep(5 * time.Millisecond)
	cut := time.Now().UnixMilli()
	time.Sleep(5 * time.Millisecond)
	olog.Printf("[test] Wv-range after")
	after := marked(admin.logs(url.Values{"q": {"Wv-range"}, "from": {fmt.Sprint(cut)}}), "Wv-range")
	before := marked(admin.logs(url.Values{"q": {"Wv-range"}, "to": {fmt.Sprint(cut)}}), "Wv-range")
	if len(after) != 1 || !strings.HasSuffix(after[0], "Wv-range after") || len(before) != 1 || !strings.HasSuffix(before[0], "Wv-range before") {
		t.Fatalf("from %d: %q; to %d: %q", cut, after, cut, before)
	}

	// A page ends where the next begins, and says when there is more.
	first := admin.logs(url.Values{"q": {"Wv-log"}, "level": {"info"}, "limit": {"2"}})
	if len(first.Lines) != 2 || !first.More {
		t.Fatalf("the first page of two: %+v", first)
	}
	rest := admin.logs(url.Values{"q": {"Wv-log"}, "level": {"info"}, "before": {fmt.Sprint(first.Lines[1].ID)}})
	if len(rest.Lines) != 1 || rest.More || rest.Lines[0].ID >= first.Lines[1].ID {
		t.Fatalf("the page after it: %+v", rest)
	}

	// Thirty days, however far back from reaches.
	if _, err := srv.Store.DB.Exec(`INSERT INTO system_logs (at, level, line) VALUES (?, 'info', '[test] Wv-log from last month')`,
		time.Now().Add(-31*24*time.Hour).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	for _, v := range []url.Values{{"q": {"last month"}}, {"q": {"last month"}, "from": {"0"}}} {
		if got := marked(admin.logs(v), "last month"); len(got) != 0 {
			t.Fatalf("%v shows a line 31 days old: %q", v, got)
		}
	}
	if md := admin.mustDo("GET", "/admin/logs.md?all=1", nil, http.StatusOK).Body.String(); strings.Contains(md, "last month") {
		t.Fatal("everything kept holds a line 31 days old")
	}
}

func TestTheSystemLogExportsWhatTheFiltersShowOrEverythingKept(t *testing.T) {
	srv := newTestServer(t)
	logging(t, srv)
	srv.Static = fstest.MapFS{"index.html": {Data: []byte("<!doctype html><title>Tippani</title>")}}
	h := srv.Handler()
	admin := signupAdmin(t, h)

	olog.Printf("[test] Wv-md one with ```` four backticks")
	olog.Warnf(olog.CodeJobRead, "[test] Wv-md a break\nsecond \x1b[31mred\x1b[0m")
	olog.Printf("[test] Wv-other not asked for")
	openPage(t, h, "/library/Wv-md")

	rec := admin.mustDo("GET", "/admin/logs.md?q=Wv-md", nil, http.StatusOK)
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Fatalf("content type %q", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.HasPrefix(cd, `attachment; filename="tippani-system-log-`) || !strings.HasSuffix(cd, `.md"`) {
		t.Fatalf("content disposition %q", cd)
	}
	body := rec.Body.String()
	if strings.ContainsAny(body, "\x1b\r") {
		t.Fatalf("the export carries a terminal escape or a carriage return:\n%q", body)
	}
	lines := strings.Split(strings.TrimSuffix(body, "\n"), "\n")
	if len(lines) != 8 {
		t.Fatalf("the filtered export is %d lines, want 8:\n%s", len(lines), body)
	}
	if lines[0] != "# Tippani — system logs" || lines[1] != "" || lines[3] != "" {
		t.Fatalf("the heading: %q", lines[:4])
	}
	if !strings.HasPrefix(lines[2], "Tippani `") ||
		!strings.Contains(lines[2], " UTC · levels error, warn, info, request, the last 30 days, keyword `Wv-md` · times in UTC") {
		t.Fatalf("the line about the export: %q", lines[2])
	}
	if lines[4] != "`````" || lines[7] != "`````" {
		t.Fatalf("the fence: %q and %q, want five backticks (a line holds four)", lines[4], lines[7])
	}
	if !strings.HasSuffix(lines[5], "info     [test] Wv-md one with ```` four backticks") ||
		!strings.HasSuffix(lines[6], "warn     TIP-JOBS-003 [test] Wv-md a break⏎second red") {
		t.Fatalf("the block: %q", lines[5:7])
	}
	if strings.Contains(body, "Wv-other") || strings.Contains(body, "/library/Wv-md") {
		t.Fatalf("the export holds lines the filters leave out:\n%s", body)
	}

	// The same filters as the screen, level included.
	warn := admin.mustDo("GET", "/admin/logs.md?q=Wv-md&level=warn", nil, http.StatusOK).Body.String()
	if !strings.Contains(warn, "Wv-md a break") || strings.Contains(warn, "four backticks") || !strings.Contains(warn, "levels warn,") {
		t.Fatalf("the warn-only export:\n%s", warn)
	}

	// Everything kept: every level, every line.
	everything := admin.mustDo("GET", "/admin/logs.md?all=1", nil, http.StatusOK)
	if cd := everything.Header().Get("Content-Disposition"); !strings.HasPrefix(cd, `attachment; filename="tippani-system-log-all-`) {
		t.Fatalf("content disposition %q", cd)
	}
	eb := everything.Body.String()
	for _, want := range []string{" UTC · everything kept, 30 days · times in UTC", "Wv-other not asked for",
		"asset    GET /library/Wv-md 200", "Wv-md one with", "request  POST /api/auth/signup 200"} {
		if !strings.Contains(eb, want) {
			t.Fatalf("everything kept does not hold %q:\n%s", want, eb)
		}
	}
}

// stalledDownload opens GET path on ts as c, reads the status line and the
// headers, and then reads nothing more: a phone that went to sleep mid-download.
// Its receive buffer is kept small, so the server fills it and the kernel's send
// buffer and then waits on the client, as it would over a real link. The body is
// there to read later, for a test that wakes the phone up.
func stalledDownload(t *testing.T, ts *httptest.Server, c *testClient, path string) *http.Response {
	t.Helper()
	d := net.Dialer{Control: func(_, _ string, raw syscall.RawConn) error {
		var serr error
		if err := raw.Control(func(fd uintptr) {
			serr = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_RCVBUF, 4096)
		}); err != nil {
			return err
		}
		return serr
	}}
	conn, err := d.Dial("tcp", ts.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	req, _ := http.NewRequest("GET", ts.URL+apiPath(path), nil)
	req.AddCookie(c.cookie)
	if err := req.Write(conn); err != nil {
		t.Fatal(err)
	}
	conn.SetReadDeadline(time.Now().Add(20 * time.Second))
	res, err := http.ReadResponse(bufio.NewReader(conn), req)
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("the download of %s began %v (%v), want a 200", path, res, err)
	}
	return res
}

func TestDownloadsNobodyReadsLeaveTheAppAnsweringAndAreGivenUpOn(t *testing.T) {
	srv := newTestServer(t)
	logging(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	// Sixty thousand lines of two hundred bytes: a file several times what the
	// socket buffers between the server and a client can hold.
	if _, err := srv.Store.DB.Exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60000)
		INSERT INTO system_logs (at, level, code, line) SELECT ?, 'info', '', printf('[test] Wv-bulk %06d %s', i, ?) FROM n`,
		time.Now().UnixMilli(), strings.Repeat("x", 180)); err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close) // after the downloads' own cleanups, which close them first

	// More stalled exports than the library pool has connections, and the app
	// still answers a reader's list at once.
	for range 5 {
		stalledDownload(t, ts, admin, "/admin/logs.md?all=1")
	}
	req, _ := http.NewRequest("GET", ts.URL+apiPath("/books"), nil)
	req.AddCookie(admin.cookie)
	start := time.Now()
	res, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		t.Fatalf("GET /books beside five stalled exports: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /books beside five stalled exports: %d", res.StatusCode)
	}
	t.Logf("GET /books answered in %s beside five stalled exports", time.Since(start).Round(time.Millisecond))

	// And a download nobody reads is let go once it has waited long enough,
	// which the server's own log says.
	old := exportIdle
	exportIdle = 300 * time.Millisecond
	t.Cleanup(func() { exportIdle = old })
	stalledDownload(t, ts, admin, "/admin/logs.md?q=Wv-bulk")
	for deadline := time.Now().Add(20 * time.Second); ; time.Sleep(20 * time.Millisecond) {
		got := marked(admin.logs(url.Values{"level": {"warn"}, "q": {"export was not all sent"}}), "export was not all sent")
		if len(got) > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("an export nobody read for twenty seconds was never given up on")
		}
	}
}

// An export that a restore or a reset swaps the database under part-way ends with
// a line saying so, inside its block, rather than going on with lines from a
// database its fence was never measured over.
func TestAnExportTheDatabaseIsSwappedUnderSaysWhereItStopped(t *testing.T) {
	srv := newTestServer(t)
	logging(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	if _, err := srv.Store.DB.Exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60000)
		INSERT INTO system_logs (at, level, code, line) SELECT ?, 'info', '', printf('[test] Wv-bulk %06d %s', i, ?) FROM n`,
		time.Now().UnixMilli(), strings.Repeat("x", 180)); err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	// The download stalls a few megabytes in, far short of its end, and the
	// database is swapped under it: the restore's own swap, with nothing to move,
	// and the rebinding it does after it.
	res := stalledDownload(t, ts, admin, "/admin/logs.md?q=Wv-bulk")
	if err := srv.Store.Swap(func() error { return nil }, nil, nil); err != nil {
		t.Fatal(err)
	}
	srv.rebindDB()
	body, err := io.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		t.Fatalf("reading the rest of the export: %v", err)
	}
	lines := strings.Split(strings.TrimSuffix(string(body), "\n"), "\n")
	if n := len(lines); n < 3 || lines[n-1] != "```" ||
		lines[n-2] != "… the export stops here: the database was replaced (a restore or a reset) while the export was written" {
		t.Fatalf("the export's last lines: %q", lines[max(0, len(lines)-3):])
	}
	if kept := strings.Count(string(body), "Wv-bulk"); kept == 0 || kept >= 60000 {
		t.Fatalf("the export holds %d of the 60000 lines, want the ones before the swap", kept)
	}
}

// A swap that lands after an export has measured its fence and before it has
// sent a line ends it before its first line: every line it would send comes from
// a database the fence was not measured over, and the file says so.
func TestAnExportSwappedUnderBeforeItsFirstLineSendsNoneOfIt(t *testing.T) {
	srv := newTestServer(t)
	logging(t, srv)
	h := srv.Handler()
	admin := signupAdmin(t, h)
	for i := range 3 {
		olog.Printf("[test] Wv-before-the-swap %d", i)
	}
	// The three are kept before the export begins, so an export that sent them
	// would show them.
	flushed(t, srv.Logbook)
	if got := marked(admin.logs(url.Values{"q": {"Wv-before-the-swap"}}), "Wv-before-the-swap"); len(got) != 3 {
		t.Fatalf("the lines to export: %q", got)
	}
	swapped := false
	afterFencePass = func() {
		if swapped {
			return
		}
		swapped = true
		if err := srv.Store.Swap(func() error { return nil }, nil, nil); err != nil {
			t.Error(err)
		}
		srv.rebindDB()
	}
	t.Cleanup(func() { afterFencePass = nil })

	body := admin.mustDo("GET", "/admin/logs.md?q=Wv-before-the-swap", nil, http.StatusOK).Body.String()
	if !swapped {
		t.Fatal("the export never reached the end of its fence pass")
	}
	if n := strings.Count(body, "[test] Wv-before-the-swap"); n != 0 {
		t.Fatalf("the export holds %d of the log's lines, want none:\n%s", n, body)
	}
	lines := strings.Split(strings.TrimSuffix(body, "\n"), "\n")
	if n := len(lines); n < 3 || lines[n-1] != "```" || lines[n-3] != "```" ||
		lines[n-2] != "… the export stops here: the database was replaced (a restore or a reset) while the export was written" {
		t.Fatalf("the export's last lines: %q", lines[max(0, len(lines)-3):])
	}
}
