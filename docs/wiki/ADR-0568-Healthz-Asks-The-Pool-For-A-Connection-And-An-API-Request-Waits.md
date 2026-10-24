# ADR-0568: /healthz asks the pool for a connection, and an API request waits ten seconds for one at most

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 3.0.1

*Issue #40: the container reported healthy, its log looked normal, and nothing loaded until a
restart.*

**Decided.** `/healthz` waits up to two seconds for a pooled connection and runs one read on it,
the read GET /api/auth/status runs, outside a transaction so a writer holding SQLite's lock does
not turn it red. It answers 200, or 503 with a TIP-HEALTH code and the pool's counts, and the
healthcheck subcommand prints that reason so `docker inspect` shows it. The `/api` mount waits up
to ten seconds (twice busy_timeout) for a connection before any handler runs, hands it straight
back, and answers 503 "changed nothing" if none came free. A table of the requests in flight names
any request past the 60-second write deadline once (TIP-HTTP-003), and a failed check or refusal
lists the oldest ones. It is swept on every arrival and every health check, with no goroutine and
no ticker.

**Why a check at the door and not a deadline.** No database call in this app carries a context:
every Query, QueryRow, Exec and Begin runs on context.Background(), so database/sql's wait for a
connection ends only when one is freed, and a request deadline would bound nothing. One bounded
wait before the handler bounds the wait #40 describes, and cuts no backup, restore, update or
import short.

**What it does not do, said plainly.** It restarts nothing: plain Docker and Compose do not
restart an unhealthy container. A wait inside a handler is named, not bounded. And #40's own
evidence may not be this at all. Loading a page writes an access line even when the pool is stuck,
because the page needs no database, and the reported log had none after "listening", which points
at requests not reaching the process, such as the host's port publish. Troubleshooting now teaches
that reading.

**Instead of.** Per-request deadlines and http.TimeoutHandler, which bound nothing while the
queries ignore context. A wrapper around every database call that bounds its own wait, which would
start a goroutine per statement, a design question this repo settles before code. A bigger pool,
which moves the cliff. A line at every request's arrival, which doubles the log. A watchdog
goroutine, which the repo's rule forbids. A guard that keeps /healthz green while API requests are
still finishing, so a busy pool (a writer can hold a connection for busy_timeout, longer than the
check's two seconds) never logs a red check: left out for now, because Docker needs three failures
in a row and a single burst is documented as needing nothing. Moving the read of the name
separators out of the nineteen transactions that take a second connection while holding one: it is
the wait this door names but does not bound, and it is a change across nineteen handlers, so it is
its own piece of work.

**Reversal.** It partly reverses the entry above: a green probe still writes nothing, but a failed
one writes an [error] line, and the first green after it says so. That entry's "stdout" was always
stderr: the access line goes through the standard logger.

<sub>3.0.1 — `internal/httpapi/health.go` · `internal/httpapi/inflight.go` · `internal/store/health.go` · `cmd/tippani/main.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
