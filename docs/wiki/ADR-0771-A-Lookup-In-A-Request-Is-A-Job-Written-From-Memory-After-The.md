# ADR-0771: A lookup in a request is a job written from memory, after the answer

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Every request carries a `*jobs.Lazy` beside its reader. It is nothing until something logs into it — the gate's first line, or a handler's `jobs.Begin` — and then it is a job held in memory, up to 500 lines or 256 KB and then "N more lines were not kept". When the request ends, the request logger hands the logbook the row and its lines as one entry: succeeded under 400, failed with "HTTP <status>" otherwise, and a handler's panic still leaves its line and its job before net/http sees it. Nothing touches the database on the request's path. Such a job is in Past jobs and never in Current jobs, and it cannot be run again, because the request it ran in is gone. The handlers that know what was searched name it as the job's subject.

**Why.** My answer: a single manual lookup runs *"as fast as today and never queued behind a bulk run, and each is still recorded as a job with its log."* A row written as the request starts, and its lines as they come, is a database write — on the library pool, a disk sync — in front of every search a reader types.

**Instead of.** Queueing the lookups, which I ruled out. Writing the row first.

<sub>3.1.0 — `internal/jobs/recorder.go` · `internal/httpapi/server.go` · `internal/httpapi/jobkinds.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
