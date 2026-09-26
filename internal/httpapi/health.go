package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"tippani/internal/olog"
	"tippani/internal/store"
)

// healthBudget is how long /healthz waits for a database connection. It sits
// inside the healthcheck subcommand's 3s client (cmd/tippani/main.go) and inside
// Docker's 5s HEALTHCHECK timeout (Dockerfile), so a slow answer is still an
// answer and not a timeout with no reason attached.
const healthBudget = 2 * time.Second

// handleHealthz answers 200 when a request arriving now could reach the database
// and get an answer, and 503 with the reason when it could not.
//
// IT USED TO ANSWER 200 FOR BEING ALIVE, AND THAT WAS ISSUE #40. A container
// whose pool had stopped giving connections to anyone reported healthy for as
// long as the process accepted TCP. So it now asks the pool for a connection and
// runs one read on it, the same read GET /api/auth/status runs, outside a
// transaction, so a writer holding SQLite's lock does not turn it red.
//
// A GREEN CHECK STAYS SILENT, a red one says why in the log, and the first green
// after a red one says so. Nothing restarts the container: plain Docker and
// Compose do not restart on unhealthy. What changes is that "healthy" now means
// what an operator reads it as.
func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	err := s.Store.Probe(r.Context(), healthBudget)
	now := time.Now()
	s.running.reportOverdue(now)
	if r.Context().Err() != nil {
		return // the prober hung up first
	}
	if err == nil {
		if n := s.healthFailed.Swap(0); n > 0 {
			olog.Printf("[health] healthy again after %d failed check(s)", n)
		}
		w.WriteHeader(http.StatusOK)
		return
	}
	s.healthFailed.Add(1)
	code, why := olog.CodeHealthNoAnswer, "the database did not answer"
	if errors.Is(err, store.ErrNoConnection) {
		code, why = olog.CodeHealthNoConnection, err.Error()
	}
	olog.Errorf(code, "GET /healthz: %v; %s", err, s.running.describe(5, now))
	// Counts only in the body, never the driver's text: this endpoint needs no
	// sign-in.
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusServiceUnavailable)
	fmt.Fprintf(w, "%s %s\n", code, why)
}

// admitDB refuses an API request with 503 when no database connection comes
// free within store.ConnWait, instead of letting it queue for ever.
//
// IT WAITS ONCE, AT THE DOOR, AND HOLDS NOTHING. The connection it gets is handed
// straight back, so no handler is cut short: a backup, a restore, an update or a
// large import approval runs exactly as long as it did. What it bounds is the
// wait that issue #40 describes, a pool that gives no connection to anyone. A
// wait inside a handler is not bounded here; it is named by the in-flight
// tracker once it passes stuckAfter.
//
// Any error other than a timed-out wait, such as a handle closed for a moment
// during a restore's swap, lets the request through, so today's behaviour holds
// there.
//
// THE WAIT IGNORES THE CLIENT GOING AWAY. Some handlers must finish after the
// browser has left: an in-app update pulls and relaunches whether or not anyone is
// still watching (TestAnUpdateSurvivesTheClientGoingAway). A door that followed
// the client's cancellation stopped those before they started. So the wait is
// bounded by ConnWait alone, and what happens after it is the handler's business,
// as it always was.
func (s *Server) admitDB(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := s.Store.Admit(context.WithoutCancel(r.Context()), store.ConnWait)
		if !errors.Is(err, store.ErrNoConnection) {
			next.ServeHTTP(w, r)
			return
		}
		now := time.Now()
		s.running.reportOverdue(now)
		olog.Errorf(olog.CodeHTTPNoConnection, "%s %s%s: %v; %s",
			r.Method, r.URL.Path, reqSuffix(r), err, s.running.describe(1, now))
		writeErr(w, http.StatusServiceUnavailable,
			"Tippani's database is not answering, so this request changed nothing. "+
				"Try again in a minute; if it keeps happening, restart Tippani and include its log in a report.")
	})
}
