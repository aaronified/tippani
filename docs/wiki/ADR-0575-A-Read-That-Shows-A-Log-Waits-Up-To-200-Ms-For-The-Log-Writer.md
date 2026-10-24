# ADR-0575: A read that shows a log waits up to 200 ms for the log writer; the list of past jobs does not

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** A job's lines and every system line reach the database through the logbook's one drainer, in batches, so a read made just after a line was logged can miss it. Four reads wait for the drainer first, for at most 200 ms: a job's poll (`GET /jobs/{id}`), the system log (`GET /admin/logs`), and the two Markdown exports, a job's (`GET /jobs/{id}/log.md`) and the system log's (`GET /admin/logs.md`). The implementation spec named the first two; the plan, folded into §18, named none of them. The exports are a departure from the spec, because an export is the file somebody is handed to read a failure from, and a file that stops short of the last line logged is the one read where "the next poll has it" is no answer. The list of past jobs (`GET /jobs?view=past`) does not wait. An in-request job's row lands milliseconds after its request ends, nobody asks for the list faster than that, and a queued job's row is written as it happens.

**Why.** The wait is free while the drainer keeps up: a flush returns once what was logged before it is written. It costs the whole 200 ms while the drainer is held up, waiting out another writer's lock or parked by a restore. On the past list that is 200 ms on every read for nothing. The list is read when the tab opens and again when a job ends or somebody presses something, and none of those is racing a line.

**Instead of.** Waiting on the past list as well, which the first build did and a review found. And waiting on none of them, which leaves a poll a line behind the job it is watching.

<sub>3.1.0 — `internal/httpapi/jobs_handlers.go` · `internal/httpapi/logs_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
