# ADR-0058: A delete is a snapshot in a bin, not a flag on the row

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** The five content kinds and a whole account go to `trash` (migration 0031) as a JSON snapshot of their subtree; the rows are then really deleted, cascades and triggers and all. Restoring re-inserts them. Retention is a per-user preference, swept at boot and once a day.

**Why.** The alternative is a `deleted_at` column, and it costs a predicate in front of every query, count, stat, export, dedupe check and FTS trigger in the app — forever, on every future one too. The failure mode is not a crash: it is a deleted quote turning up in a quiz six months later because one query out of two hundred forgot the clause. With a snapshot, nothing else in the schema changes and nothing else in the application knows the bin exists.

The cost is real and named: a snapshot is a copy, so it can be incomplete in ways the live row cannot. That is why the payload's COLUMNS are read from `PRAGMA table_info` rather than listed in Go, and why there is a test comparing a payload's keys against the table's own columns.

**Instead of** a soft delete, above. **Instead of** an export-and-reimport round trip, which loses everything the exporter does not carry — ids, review schedules, sticker positions — and would make "undo" mean "something quite like it".

**Approved.** Mine, and I approved shipping it BEFORE the features that need it: bulk delete is only a reasonable thing to offer once every delete is recoverable.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
