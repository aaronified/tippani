package jobs

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"tippani/internal/outbound"
)

// THE OUTBOUND HOOK: ONE LINE FOR EVERY CALL THAT LEAVES THE APP. The owner asked
// for every job to carry "what was searched, where, and every outbound request",
// and for two hooks to feed the logs, one of them in the outbound gate. The gate
// tells an observer of each round trip (outbound.SetObserver), and this is the
// observer: serve() installs it once, and `tippani notify daily` installs its own.
//
// The line goes to whoever the call was for. A queued job's calls carry the job
// in their context (the runner puts it there), and so do a request's (the request
// logger puts a *Lazy there, which becomes an in-request job with its first
// line). A call made with neither — nothing today, but a goroutine that dropped
// its context would be one — still goes in the system log, tagged [outbound], so
// no outward call is ever unrecorded.

// Outbound is the observer outbound.SetObserver takes. It writes nothing to the
// database on the caller's path: a job's line and a system line are both
// buffered for the drainer, and a request's lines wait in its *Lazy.
func (lb *Logbook) Outbound(req *http.Request, resp *http.Response, err error, took time.Duration) {
	line, lvl := outboundLine(req, resp, err, took)
	if rec := From(req.Context()); rec != nil {
		rec.Log(lvl, "%s", line)
		return
	}
	lb.System(lvl, "", "[outbound] "+line)
}

// outboundLine is the call as a line and the level it is kept at:
//
//	GET api.themoviedb.org/3/search/movie?query=Dune&api_key=… → 200 · 312 ms · 4.1 kB
//	GET www.googleapis.com/books/v1/volumes?q=…&key=… → refused (offline)
//	POST id.twitch.tv/oauth2/token → error: dial tcp: lookup id.twitch.tv: no such host
//
// The scheme goes (nearly every call is https, and the line is read in a narrow
// pane), and so does any user:password@, which Redact drops but a URL rebuilt from
// its host never had. The query's secrets go through Redact here, because a line
// with no scheme is not URL-shaped to the logbook's door. The size is the one the
// server declared: the line is written when the answer arrives, before anybody
// reads it, and a compressed or chunked answer declares none.
//
// A call that failed, was refused or answered 400 or worse is a warning: the job
// or the request it was for did not get what it asked for.
func outboundLine(req *http.Request, resp *http.Response, err error, took time.Duration) (string, string) {
	u := req.URL
	target := u.Host + u.EscapedPath()
	if u.RawQuery != "" {
		target += "?" + u.RawQuery
	}
	head := req.Method + " " + outbound.Redact(target) + " → "
	switch {
	case errors.Is(err, outbound.ErrOffline):
		return head + "refused (offline)", LevelWarn
	case err != nil:
		return head + "error: " + err.Error(), LevelWarn
	}
	var b strings.Builder
	b.WriteString(head)
	fmt.Fprintf(&b, "%d · %s", resp.StatusCode, tookText(took))
	if resp.ContentLength >= 0 {
		b.WriteString(" · " + sizeText(resp.ContentLength))
	}
	if resp.StatusCode >= 400 {
		return b.String(), LevelWarn
	}
	return b.String(), LevelInfo
}

// tookText is a call's duration as a reader compares them: whole milliseconds
// under a second, tenths of a second past it.
func tookText(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%d ms", d.Round(time.Millisecond).Milliseconds())
	}
	return fmt.Sprintf("%.1f s", d.Seconds())
}

// sizeText is a byte count in the decimal units a browser's network pane uses.
func sizeText(n int64) string {
	switch {
	case n < 1000:
		return fmt.Sprintf("%d B", n)
	case n < 1000*1000:
		return fmt.Sprintf("%.1f kB", float64(n)/1000)
	default:
		return fmt.Sprintf("%.1f MB", float64(n)/(1000*1000))
	}
}
