# ADR-0769: Two hooks write the job lines, and olog's sink carries the app's own

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** My two hooks, *"one hook in the outbound gate and one in the request logger"*. **The gate's**: `outbound.SetObserver` installs one function that the gate calls after every round trip, and on every refusal under `TIPPANI_OFFLINE`, with the request, the answer or the error, and the time it took; the logbook turns that into one line in whichever job the request's context carries, or into the system log when it carries none. A failure, a refusal and an answer of 400 or worse are warnings. The code that made a refused call does not log it again as an error: a lookup or a download that `TIPPANI_OFFLINE` refused is a trace line there (`logOutwardFailure`), because the operator switched the app offline on purpose and the gate's line already says so, and offline a fill logged an error for every work it was given. Any other failure is still an error, under its code. The OIDC client carries the hook without the gate (`outbound.Observed`), so sign-in's calls are in the log too; the healthcheck and the Docker Engine API are the app looking at its own machine and carry neither. **The request logger's**: `logRequests` keeps a line per request and gives every request a job to log into (the next two entries). The app's own lines reach the system log by a third route: everything `olog` writes, the standard logger's lines through a tee, and net/http's through `olog.ServerLog`, each handed to `olog.SetSink` at the level of the function that wrote it.

**Why the gate and not the clients.** The gate is the one thing an outbound client here cannot be built without — `TestEveryOutboundClientCarriesTheGate` fails on one that lacks it — so an observer there hears the next client the day it is written. An observer per client is four places to remember. The line is written when the answer arrives, with the size the server declared, so a caller that never reads the body still leaves one.

**Instead of.** The observer in `httpapi`, which the daily-deck command, having no server, could not install. A byte count taken when the body closes, which leaves no line at all for a caller that never reads it.

<sub>3.1.0 — `internal/outbound/outbound.go` · `internal/jobs/outbound.go` · `internal/httpapi/server.go` · `internal/httpapi/outward_failures.go` · `internal/olog/olog.go` · `cmd/tippani/main.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
