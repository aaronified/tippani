# ADR-0033: WAL with synchronous=FULL for the library, and one NORMAL connection for the logs

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 0.6.4; the log connection 3.1.0

**Decided.** I open the database with `journal_mode(WAL)` and `synchronous(FULL)`. PLAN §8 specified `NORMAL`, and I was wrong: in WAL mode `NORMAL` only fsyncs at checkpoint, so an unclean stop — `docker stop` escalating to SIGKILL, or a volume that does not guarantee fsync ordering — can leave a torn WAL that surfaces later as `database disk image is malformed`. `FULL` fsyncs the WAL on every commit and closes that window. Write volume here is low (imports, edits, never a hot path), so the extra fsync is negligible against the corruption it prevents. I approved this the day I finished reading the corruption postmortem. **Since 3.1.0 one connection is the exception**: `Store.LogDB`, the same file and DSN at `synchronous(NORMAL)`, one connection, written only by the logbook — the system log, every job's lines, the rows of the jobs that ran inside a request, and the prune that ages them out. Library writes, and the rows of queued jobs, stay on the `FULL` pool.

**Why the exception is safe.** `synchronous` is a property of the connection, not of the file. A `FULL` commit fsyncs the WAL up to its own frame, and the `NORMAL` frames written before it are in that WAL, so they are made durable by the next library write for free. What a crash can cost is the last log batches written after the last library commit — lines about the seconds before the crash, whose first copy went to `docker logs` anyway. Logging every request is the one hot write path this app has, and under `FULL` it would be a disk sync per request.

**Instead of.** `synchronous=NORMAL`, as planned, on the argument that WAL is crash-safe anyway. It is, against a process crash; not against a volume that reorders. For the logs: the library pool at `FULL`, which is the sync per request I ruled out, and a second database file, which a backup, a restore and a factory reset would each have to learn about.

**Reversal.** This entry *is* a reversal of the plan. §8 now records the supersession in place rather than quietly reading as if it were built. **And 3.1.0 reverses it in part**, on my ruling for the release: *"system logs written on their own database connection at synchronous=NORMAL, so logging every request doesn't cost a disk sync each time."* The argument above still holds for everything a reader would miss; it never held for a log line.

<sub>0.6.4; the log connection 3.1.0 — `internal/store/store.go` · `internal/jobs/logbook.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
