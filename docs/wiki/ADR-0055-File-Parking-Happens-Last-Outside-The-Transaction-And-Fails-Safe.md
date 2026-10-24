# ADR-0055: File parking happens last, outside the transaction, and fails safe

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** `trashAndDelete` does five things in one transaction and the order is the design: read the subtree by following the cascade edges rather than a hand-written list; collect image filenames the way `userCoverFiles` already does, *before* anything is deleted, because the cascade frees rows and not files; write the `trash` row; delete the row and let the existing cascade do exactly what it does today; then move — not copy — the files into `MediaCover/trash/`. The move is last and outside the database's control, so it is the one step that can leave a mismatch, and it is deliberately biased: a parked file with no trash row is garbage the purge collects, while a trash row pointing at a deleted file is a restore that silently loses a cover. I approved that bias explicitly.

**Instead of.** Parking files first, or copying instead of moving.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
