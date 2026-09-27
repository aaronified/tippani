package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
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
// 31 days old, because no line can be logged in the past. And the wire field
// names, which are the contract the screen is built to.
//
// What each one guards, in a sentence a person would say: only an admin reads
// the system log; it shows every level but file requests and traces unless asked,
// and exactly the levels asked for; a time range keeps the lines inside it; a
// keyword is matched without regard to case and a % or _ in it means itself; a
// page ends where the next begins; nothing older than thirty days is shown; the
// export holds exactly what the filters show, or everything kept, one line per
// line inside a fence no line can close.

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
