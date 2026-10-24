# ADR-0051: The trash payload reads its columns from PRAGMA table info

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** The snapshot is built by reading `PRAGMA table_info` per table rather than by naming columns. A snapshot that lists columns by hand is a snapshot that silently stops carrying the column added next release, and the failure only shows up on a restore, months later, as a field quietly reset to its default. The delayed, silent failure mode is the entire justification, and it is backed by a test that adds a column and expects it to survive the round trip — the claim tested rather than asserted in a comment. I approved this, and I approved the test alongside it, because the claim is worthless without one.

**Instead of.** An explicit per-table column list; rejected on the delayed-failure argument.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
