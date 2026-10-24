# ADR-0037: txlock=immediate replaced the single-writer plan

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.3.2

**Decided.** The lock order was the bug and the pool size never was. Almost every write here reads before it writes — the duplicate check, the ownership check, the FTS row about to be updated — and under SQLite's default `DEFERRED` locking that makes `BEGIN` take a read lock the first `INSERT` must upgrade. SQLite will not run the busy handler for that upgrade, because two transactions both holding read locks and both wanting to write would deadlock, so it fails the second one instantly. That is why eight concurrent POSTs produced a 500 in 17 ms against a `busy_timeout` of 5000: the timeout was never consulted. Opening with `_txlock=immediate` takes the write lock at `BEGIN`, where there is nothing to upgrade, and a second writer simply waits. One line, covering all thirty write transactions rather than the two a mutex would have been threaded through — and unlike a mutex it holds against a second process, a `sqlite3` shell or a restore. I approved this after reproducing the failure, and it is the correction I am gladdest about.

**Instead of.** The single-writer connection of 3.4, and a serialising mutex. Both aimed at the symptom through the wrong mechanism.

**Reversal.** None since; this is itself the reversal of the plan.

<sub>1.3.2 — `internal/store/store.go` · `internal/store/write_lock_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
