# ADR-0039: The one genuinely read-only transaction is marked ReadOnly

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.3.2

**Decided.** `previewStagedTarget` answers "where would this work's quotes land?" and never writes. Because the DSN sets `_txlock=immediate`, a plain `Begin` there would take SQLite's write lock up front — and this runs once per staged work while a staging list renders. So it opens with `sql.TxOptions{ReadOnly: true}`. A preview has no business queueing behind a real writer, or making one queue behind it. It is the only transaction in the tree that qualified, and I moved it in the same commit that introduced the immediate locking, because that change is what made the distinction matter.

**Instead of.** Leaving it read-write, which was invisible until `_txlock=immediate` gave it a cost.

<sub>1.3.2 — `internal/httpapi/import_staging.go` · `internal/httpapi/conflict_pool_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
