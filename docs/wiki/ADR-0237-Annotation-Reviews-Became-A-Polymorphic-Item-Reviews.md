# ADR-0237: annotation reviews became a polymorphic item reviews

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.5.0

**Decided.** Migration 0015 replaces it with `item_reviews`, keyed `(kind, item_id)` — `book`, `screen`, later `utterance`. Every existing book half-life is carried forward verbatim.

**Why.** Films and shows became first-class review material, and a table cannot hold a real foreign key to two parents. `ON DELETE CASCADE` is replaced by one `AFTER DELETE` trigger per parent. 0026 spells out why the third trigger is not cosmetic: `id` is a plain `INTEGER PRIMARY KEY`, so SQLite reuses a rowid once the highest row is deleted, and an orphaned schedule row would be silently adopted by the next quote created — arriving carrying a stranger's stability, review count and lapse history.

**Approved.** Mine, and I approved carrying the schedule forward rather than starting everyone over, which was the cheaper migration.

<sub>0.5.0 — `internal/store/migrations/0015_review_rework.sql` · `internal/store/migrations/0026_utterances.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
