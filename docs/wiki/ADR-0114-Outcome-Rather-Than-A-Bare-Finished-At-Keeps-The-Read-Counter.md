# ADR-0114: outcome rather than a bare finished at keeps the read counter honest, with triggers standing in for a cross-table cascade

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `work_reads.outcome` is 'open' | 'finished' | 'abandoned'. `readCounts` counts only 'finished' rows. Two `AFTER DELETE` triggers on `books` and `movies` remove the matching read rows.

**Why.** An abandoned attempt has a stop date but was never finished, so a bare `finished_at` would count giving up as reading. `kind` + `work_id` is a polymorphic pointer at `books.id` or `movies.id`, so no foreign key is possible and no `ON DELETE CASCADE` exists to declare — the triggers are the stand-in, and deleting a work takes its history with it. At most one 'open' row per work is enforced in app code, since the partial unique index that would express it cannot also be scoped per user cheaply.

**Instead of.** Two parallel tables with real foreign keys — rejected as duplication of the whole log for two kinds that behave identically.

**Approved.** I approved the polymorphic pointer knowing it costs the FK, and approved the triggers as the explicit price of that.

<sub>1.3.0 — `internal/store/migrations/0024_in_progress.sql` · `internal/httpapi/shelf.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
