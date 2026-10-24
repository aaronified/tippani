# ADR-0035: One transaction per imported file

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** planned in §5/§8; held through the staging rework in 1.2.0

**Decided.** An import stream-parses with `bufio` (raised max-token cap, since the 64 KB default errors on pathological long lines) and commits every insert in a single transaction per file. The plan states the reason as bluntly as I would: batched inserts are the difference between a sub-second burst and minutes of fsync churn. With `synchronous=FULL` this stopped being a nicety — per-row commits would fsync per row. The staging rework kept the shape: parse one or many books, then one transaction that stages every work and its quotes. I signed this off at plan time and never had cause to revisit it.

**Instead of.** Per-row or per-book commits, for finer failure granularity. Rejected: a half-imported file is worse than a rejected one.

<sub>planned in §5/§8; held through the staging rework in 1.2.0 — `docs/wiki/Design-decisions.md` · `internal/httpapi/import_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
