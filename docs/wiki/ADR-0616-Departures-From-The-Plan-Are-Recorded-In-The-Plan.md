# ADR-0616: Departures from the plan are recorded in the plan

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.3.2

**Decided.** `synchronous=FULL` and the four-connection pool are recorded in PLAN §8 as deliberate departures, with the reasoning, rather than leaving the plan and the code disagreeing in silence.

**Why.** The silent gap produced the concurrency misdiagnosis. The recorded cause of the concurrent-write 500 was the pool — "PLAN §8 specified a single writer connection, `store.Open` allows four, so serialise them behind a mutex" — and both the cause and the fix were wrong. The real fault was the lock order: almost every write here reads before it writes, and under `DEFERRED` locking that makes `BEGIN` take a read lock the first INSERT must upgrade, which SQLite fails instantly rather than waiting on, so the 5000ms `busy_timeout` was never consulted. It was caught by making the test fail on purpose and reading the error code — `517`, `SQLITE_BUSY_SNAPSHOT`, which names the upgrade — not by re-reading an explanation that had been sitting there being fluent for months.

**Approved.** Mine, and I approved recording the wrong diagnosis alongside the right one.

<sub>1.3.2 — `CHANGELOG.md` · `docs/wiki/Design-decisions.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
