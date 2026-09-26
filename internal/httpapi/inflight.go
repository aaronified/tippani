package httpapi

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"tippani/internal/olog"
)

// stuckAfter is the server's WriteTimeout (cmd/tippani/main.go). Past it, a
// normal request can no longer deliver its answer, so one still running is worth
// a line in the log.
const stuckAfter = 60 * time.Second

// THE REQUESTS IN FLIGHT, SO A HUNG ONE LEAVES A TRACE. The access line is
// written when a request finishes, so a request that never finishes wrote
// nothing, and a log that went quiet after "listening" looked the same whether
// requests had stopped arriving or were arriving and hanging (issue #40). This
// keeps the running requests in a map and names each one once when it passes
// stuckAfter.
//
// NO GOROUTINE AND NO TICKER, which is the repo's rule. The sweep runs on every
// request's arrival, and on every health check and refused request, and the
// Docker HEALTHCHECK calls /healthz every 30s, so a hung request is named within
// about half a minute of passing the deadline even when nothing else arrives.
type flight struct {
	method, path, remote string
	since                time.Time
	told                 bool
}

type flightTable struct {
	mu   sync.Mutex
	reqs map[string]*flight
}

// track records the request for as long as it runs. It sits inside logRequests,
// so it sees the request id that logRequests assigned. /healthz has none and
// passes straight through. It does not wrap the ResponseWriter, so it takes on
// no Unwrap duty (see statusRecorder). The delete is deferred, so a handler
// that panics leaves no ghost entry.
func (f *flightTable) track(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := reqID(r)
		if rid == "" {
			next.ServeHTTP(w, r)
			return
		}
		now := time.Now()
		f.mu.Lock()
		if f.reqs == nil {
			f.reqs = map[string]*flight{}
		}
		f.reqs[rid] = &flight{method: r.Method, path: r.URL.Path, remote: r.RemoteAddr, since: now}
		f.mu.Unlock()
		f.reportOverdue(now)
		defer func() {
			f.mu.Lock()
			delete(f.reqs, rid)
			f.mu.Unlock()
		}()
		next.ServeHTTP(w, r)
	})
}

// reportOverdue names, once each, the requests that have been running longer
// than stuckAfter. The lines are written outside the lock.
func (f *flightTable) reportOverdue(now time.Time) {
	type late struct {
		rid string
		fl  flight
	}
	var due []late
	f.mu.Lock()
	for rid, fl := range f.reqs {
		if !fl.told && now.Sub(fl.since) > stuckAfter {
			fl.told = true
			due = append(due, late{rid, *fl})
		}
	}
	f.mu.Unlock()
	sort.Slice(due, func(i, j int) bool { return due[i].fl.since.Before(due[j].fl.since) })
	for _, d := range due {
		olog.Warnf(olog.CodeHTTPStillRunning, "%s %s still running after %s (from %s, req %s)",
			d.fl.method, d.fl.path, now.Sub(d.fl.since).Round(time.Second), d.fl.remote, d.rid)
	}
}

// describe is the requests in flight, oldest first and at most n of them, for a
// line that says why a health check or a request failed.
func (f *flightTable) describe(n int, now time.Time) string {
	type row struct {
		rid string
		fl  flight
	}
	f.mu.Lock()
	rows := make([]row, 0, len(f.reqs))
	for rid, fl := range f.reqs {
		rows = append(rows, row{rid, *fl})
	}
	f.mu.Unlock()
	if len(rows) == 0 {
		return "no requests in flight"
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].fl.since.Before(rows[j].fl.since) })
	parts := make([]string, 0, n)
	for i, r := range rows {
		if i == n {
			break
		}
		parts = append(parts, fmt.Sprintf("%s %s %s (req %s)", r.fl.method, r.fl.path, now.Sub(r.fl.since).Round(time.Second), r.rid))
	}
	noun := "requests"
	if len(rows) == 1 {
		noun = "request"
	}
	return fmt.Sprintf("%d %s in flight, oldest first: %s", len(rows), noun, strings.Join(parts, ", "))
}
