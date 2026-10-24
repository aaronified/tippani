# ADR-0776: A restore, a reset, a search rebuild or an update waits for the running job

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** Each runs inside `Runner.Exclusive`. While a job runs it is refused with 409 and *"A job is running. Stop it in Settings → Jobs, or wait for it to finish."*; while it runs, no job starts, and a press is refused as busy. A job that is only waiting does not stand in the way — a restore interrupts it as it carries the history over, and a reset empties the table — and the restore and reset prompts say so before step one. A restore is held from before its upload is read, and an update through its pull. A claim the worker is in the middle of is waited out rather than counted as a running job. An update that has launched its recreater keeps the queue shut after its own hold ends — a press, a restore, a reset, a rebuild or a second update answers 503 — until the container is replaced, and for five minutes at most: a server still running then was not replaced, and the next press opens the queue with no timer (`Runner.Retire`).

**Why.** Each pulls the ground from under a job in the middle of an item: a restore and a reset swap the files, a rebuild can escalate to a whole-file recovery, and an update recreates the server. Holding from before the upload means a job cannot start during a long upload and fail the restore at its last step.

**Instead of.** The hold around the swap alone, whose refusal would come after the whole upload. Refusing while anything waits, which would make an admin empty the queue to restore. Queueing a restore as a job, which would swap the database under the queue it was waiting in.

<sub>3.1.0 — `internal/httpapi/jobs_exclusive.go` · `internal/jobs/runner.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
