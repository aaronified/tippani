# ADR-0050: The bin reinstates recoverability via a snapshot table, not a flag

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** Every delete in this app is final, and there has never been an undo. That was tolerable while deleting meant one row behind a confirm dialog; it stops being tolerable the moment a selection can delete forty things at once, which is what the release after next wants. The answer is a `trash` table holding a JSON snapshot, and the rows are still really deleted. That is the whole point: nothing else in the app changes, and every query, count, stat and search keeps working untouched. A soft-delete flag would have made every read in the codebase grow a predicate, and the one read that forgot it would be a bug that shows a deleted quote to its owner. I approved the snapshot design over the flag on exactly that argument.

**Instead of.** A `deleted_at` predicate on the five content tables. Rejected on the every-read-grows-a-clause cost and the forgotten-predicate failure mode.

**Reversal.** None yet; nothing is written.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
