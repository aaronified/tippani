# ADR-0057: The FTS-restore worry was unfounded

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** An earlier draft of the bin plan budgeted work for reindexing after a restore. Verification killed it: the `_ai` / `_ad` / `_au` triggers from `0001_init.sql` and `0003_movies.sql` already cover insert and delete on every content table, so a restore that re-inserts rows reindexes for free. I am recording it rather than deleting it, because the draft was wrong in a specific and instructive way — 1.7.1 genuinely *was* bitten by an external-content index, so the caution was not irrational, just misapplied. I approved striking the budgeted work once the triggers were checked.

**Instead of.** An explicit rebuild step after restore, which would have been dead code.

**Reversal.** Yes: a planned work item removed before it was written.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
