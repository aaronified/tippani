# ADR-0782: Two test seams are in the binary, and neither works online

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `TIPPANI_JOBS_HOLD=1` keeps the worker from claiming anything, so every job stays waiting, and `TIPPANI_JOBS_HOLD=running`, the same switch's other position, lets the worker claim and holds the job it claims at its start, before its first step, until a Stop or shutdown ends it, with the jobs behind it waiting; `TIPPANI_LOG_HOLD=1` keeps the log writer from writing until the logbook closes at shutdown. Each is honoured only while `TIPPANI_OFFLINE` is on — a server that can reach the internet ignores them, and a test proves it for each — and each is named in the header of every file that uses it.

**Why.** Offline, which is how every browser journey runs, a job ends in milliseconds, so "a waiting job says it is waiting" and "Stop all asks first" had nothing on screen to assert, and when I ruled that the phone's tile counts the running job too (F11), neither did "1 running". A job held before its first step has done nothing when the Stop lands, so it ends stopped as any run cut short does, and nothing it would have written is half there. And the test of the shutdown order caught its own bug only by chance, six or seven runs in eight, because the writer had usually written the line before the order mattered; held, a wrong order keeps nothing at all, every run.

**Instead of.** Several hundred queued jobs before the signal, which widens the race without ending it. For the running job, a third variable, when a job running is one more position of the switch that already holds the queue; and a job long enough offline to be seen running, which is a race with the screen's poll rather than a state.

<sub>3.1.0 — `internal/jobs/runner.go` · `internal/jobs/logbook.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
