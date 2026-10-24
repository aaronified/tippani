# ADR-0777: Deleting a reader stops their jobs and waits for the running one to let go

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Deleting an account stops its jobs first — the waiting ones before they start, the running one at once, as Stop stops it — and then waits up to ten seconds for the worker to let go of that account's job, since a run stopped while a database write of its own was under way finishes that write first. A job still running then refuses the delete with 409, saying it has been stopped and is still finishing a write it had begun, and the next press goes ahead. From the moment the delete begins until it ends, the account can start no job — its session still works until the account goes, so a press answers 400 — and a refused delete lets it start them again. The history stays, handed to the admin by 0079's trigger.

**Why.** The queue checks a job's owner when it claims it, not while it runs, and a job still running under a deleted id could write into rows scoped by the id the next sign-up is given.

**Instead of.** Stopping them after the delete, when the trigger has already cleared the owner the jobs are found by. Refusing at once while a job runs, which would make nearly every such delete a second press for nothing.

<sub>3.1.0 — `internal/httpapi/admin_handlers.go` · `internal/jobs/runner.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
