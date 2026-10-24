# ADR-0768: The worker and the log writer exist only while there is work

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Nothing starts either goroutine in `internal/jobs` but work. The worker is started by the press that finds none running and exits when it finds nothing to claim; the log writer is started by the line that finds none running — the boot's own lines are the first — and exits when there is nothing left to write. Each guards the moment it decides to exit against work arriving in that same moment — one mutex over whether it is alive and whether work is waiting — so a job queued, or a line logged, just as the worker or the writer looks and finds nothing is never left for the next press to discover. Neither sleeps, except to back off while another connection holds SQLite's write lock.

**Why.** It is §1's line kept rather than argued around: an idle server runs neither of them. The lost wakeup is the one way this shape fails, and it fails silently — a job waiting with no worker looks exactly like a job waiting behind another.

**Instead of.** A worker started at boot and parked on a channel, which is simpler and is a goroutine for the life of the process. A log flusher on a ticker.

<sub>3.1.0 — `internal/jobs/doc.go` · `internal/jobs/runner.go` · `internal/jobs/logbook.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
