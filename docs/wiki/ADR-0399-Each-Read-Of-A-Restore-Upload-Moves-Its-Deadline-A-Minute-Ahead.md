# ADR-0399: Each read of a restore upload moves its deadline a minute ahead, the restore clears its write deadline, and the safety copy uses MkdirTemp

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1; the upload's idle deadline 3.1.0

**Decided.** Extract, validate, swap and reopen can outlive the server's 60-second `WriteTimeout` on a large library, so a restore clears its write deadline via `http.NewResponseController` — otherwise the work completes and the final JSON never reaches the client, which reads as a failed restore that actually succeeded. A multi-gigabyte upload outlives the 30-second `ReadTimeout`, so each read of a restore upload moves the read deadline a minute ahead: a minute in which nothing arrives answers 408, *"the upload stopped arriving, so it was given up; nothing was changed — upload the file again"*, and logs `TIP-BACKUP-010`. The read deadline is cleared once the upload is in, because the swap after it can outlive a minute. The onboarding upload shares the path. Separately, the `.pre-restore-<ts>` safety directory is created with `os.MkdirTemp` rather than a second-precision name. Second precision alone collides when two restores land in the same second — restore, then restore a different upload — and `os.Mkdir` would fail; worse, the name would alias this generation onto the previous one, so a rollback could grab the wrong directory. `MkdirTemp` guarantees a fresh name and the timestamp still makes it human-sortable.

**Why the upload may not stop.** An admin's restore holds the job queue from before the upload is read (§18), so while it sends nothing no job can start and none is claimed. An upload that stalled for good — the tab alive, the link dead — would hold every reader's queue until the TCP connection died.

**Instead of.** Raising the global timeouts, which weakens every other route.

**Reversal.** The `MkdirTemp` change reversed an earlier fixed-name scheme. **And in 3.1.0 an upload stopped clearing its read deadline.** This entry was *"Restore and upload clear the HTTP deadlines; the safety copy uses `MkdirTemp`"*, and it said both paths *"clear the relevant deadlines via `http.NewResponseController`"*: the upload's read deadline was cleared for as long as the upload took, which was right until the queue's hold made one stalled connection a way to freeze every reader's queue.

**Approved.** I approved clearing the deadlines and `MkdirTemp` after reasoning about what the wrong outcome would look like, which in the second case is a rollback restoring the wrong data.

<sub>1.4.1; the upload's idle deadline 3.1.0 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
