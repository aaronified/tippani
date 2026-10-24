# ADR-0053: id INTEGER PRIMARY KEY is a rowid alias, so ids need an allocation floor

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** Verification turned up something the decision had assumed away. `id INTEGER PRIMARY KEY` is a rowid alias on every one of these tables, so SQLite allocates `max(existing rowid) + 1` and *does* reuse a freed id — but only when the deleted row held the table's highest. That is exactly the common case: you delete the thing you just added. Making ids permanently unique needs `AUTOINCREMENT`, which is part of the column definition, so adding it means rebuilding all five tables — and those five are FK parents with cascading children, precisely the shape `0018_retire_ratings.sql` refused to touch on the grounds that a DROP-TABLE rebuild would cascade-delete the child rows. My recommendation, and the one I approved, is an `id_floor(table_name, next_id)` table with the five create handlers allocating explicitly above the floor. It delivers the decision as taken without rebuilding a single FK parent, at the cost of a new subtlety on every create.

**Instead of.** "original id if free, new id otherwise" (no migration risk, loses the bookmark guarantee in the narrow case), or `AUTOINCREMENT` on all five (permanent, invisible afterwards, needs the five-table rebuild).

**Reversal.** This point is explicitly not yet settled; the rest of the plan is written to be independent of the answer.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
