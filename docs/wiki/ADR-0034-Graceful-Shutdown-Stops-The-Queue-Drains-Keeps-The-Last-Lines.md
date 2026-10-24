# ADR-0034: Graceful shutdown stops the queue, drains, keeps the last lines, then checkpoints the WAL — inside one nine-second budget

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 0.6.4; the six steps and the budget 3.1.0

**Decided.** On `SIGTERM` or interrupt, `shutdown` runs six steps in this order. **The queue** refuses new jobs and asks the running one to stop after the item in hand; after 3 s its context is cancelled, so its outward calls abort, and after 1 s more a job still not back is marked interrupted, as are the ones waiting (those two writes wait at most half a second for the lock, and a row they could not settle is interrupted by the next start). **The requests** get 4 s through `http.Server.Shutdown`, then their connections are closed. **The logbook** gets 1 s to write what those two steps logged and then closes, so a line logged after it (the checkpoint's own) goes to the terminal alone. **The log connection** closes, or is left to close itself if a write is still waiting on the lock after 1 s. **The checkpoint**, `PRAGMA wal_checkpoint(TRUNCATE)`, waits at most 2 s for a writer and then folds back what it can without it. **Both pools** close within what is left and 0.7 s more, and the process exits whether they did or not. Every step takes its own budget or what is left of nine seconds from the signal, whichever is less, and the checkpoint always runs. The checkpoint is best-effort — a busy one is logged as `TIP-STORE-005` with how many frames it folded back, and not treated as fatal, because the WAL is still valid and replays on reopen. My call, made in the same pass as the `FULL` change and for the same reason.

**Why this order, and why one deadline.** The job goes first because it is the longest thing running and the only one that writes for minutes, and its end should be recorded while the database is open. The log closes before its pool so nothing writes into a closed connection, and before the checkpoint so nothing lands in the WAL behind it. The single deadline is there because the steps' own budgets add up to more than Docker's ten-second grace once something holds SQLite's lock: each of the queue's last two writes and the log's last write would wait out `busy_timeout` (5 s), and a context does not bound that wait on this driver — measured — so the bound is SQLite's own, a shortened `busy_timeout` on one pinned connection (`WithLockWait`).

**Instead of.** Relying on WAL replay alone; rejected because replay is the recovery path, not the design. A deferred `st.Close` after the checkpoint, which is what 0.6.4 shipped and which could wait on a stuck statement with no bound. `ExecContext` under the remaining budget, which the review proposed and the driver ignores while SQLite waits on the lock.

**Reversal.** In part, in 3.1.0. The entry was *"Graceful shutdown drains, then checkpoints the WAL"*: a 5-second `Shutdown`, then the checkpoint, then the deferred `Close`. The queue and the log connection added three steps before the checkpoint and a way for each to overrun, which is why the budget became one.

<sub>0.6.4; the six steps and the budget 3.1.0 — `cmd/tippani/main.go` · `internal/store/store.go` · `internal/store/busy.go` · `internal/jobs/runner.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
