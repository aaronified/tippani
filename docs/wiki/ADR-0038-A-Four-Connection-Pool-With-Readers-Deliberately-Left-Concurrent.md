# ADR-0038: A four-connection pool, with readers deliberately left concurrent

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.3.2; the log connection 3.1.0

**Decided.** `SetMaxOpenConns(4)`. `_txlock` applies only to read-write transactions, so a read-only `BEGIN` still gets a plain deferred lock and several readers can overlap — including while a writer holds the write lock, which is the entire point of WAL. This is pinned rather than asserted: `TestReadersOverlapAWriter` opens a writer, holds it, and requires two reads to get through; its failure message says what a failure would mean, which is that every search on the box is now queueing behind imports. I asked for that test specifically, because the property is invisible until it is gone.

**Instead of.** Dropping to a single connection, which the abandoned single-writer plan implied. It would have serialised readers behind writers on a box whose search is meant to be the fast thing.

**And a fifth connection, which is not in the pool.** From 3.1.0 the store opens `LogDB` beside it: one connection (`SetMaxOpenConns(1)`) on the same file at `synchronous=NORMAL`, written only by the logbook, its batches and its prune, through `Store.LogWrite`. It takes SQLite's write lock like any writer, so a batch waits behind a library write and a library write behind a batch, each within `busy_timeout`. It does not read: the Jobs tab's lists, a job's poll and the system log all read through the four. One connection is enough because there is one writer, the logbook's single drainer, and it is what lets a file swap reason about the log at all: the swap takes the lock `LogWrite` holds for reading, so the drainer waits out a restore, a recovery or a reset, then writes into whichever file the server is on afterwards.

<sub>1.3.2; the log connection 3.1.0 — `internal/store/store.go` · `internal/store/swap.go` · `internal/store/write_lock_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
