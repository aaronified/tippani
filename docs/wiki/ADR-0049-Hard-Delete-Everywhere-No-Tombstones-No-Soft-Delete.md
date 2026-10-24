# ADR-0049: Hard delete everywhere — no tombstones, no soft delete

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** Deleting a row deletes it, and `ON DELETE CASCADE` takes the children. There are 45 cascade edges across 15 migrations, and a book delete takes seven child tables with it. The reason is one line in PLAN §3 and it is sufficient: there is no external sync partner, so there is nothing to reconcile a tombstone against. A soft-delete flag on a library with no replica buys a filter clause on every read and nothing else. I approved this at plan time.

**Instead of.** A `deleted_at` column on every content table.

**Reversal.** Not reversed, but *supplemented* — see 3.18, which reinstates recoverability without touching this rule.

<sub>from 0.1.0 — `internal/store/migrations/`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
