# ADR-0052: Restore is one entry per user action, and an account shares the table

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** Deleting a book is one trash row — *The Dispossessed* plus its 40 quotes — restored whole. There is no way to end up with a quote whose book is missing, because there is no way to restore half an entry. Restore is a subtree, not a row. Deleting an account is binned the same way, as a single all-or-nothing entry covering the whole library, and `kind = 'account'` lives in the same table rather than beside it: the purge, the retention setting and the ownership check are the same code for both, and a second table would mean a second place to forget. My call on both halves.

**Instead of.** Per-row trash entries with a restore that reassembles, and a separate table for account deletions.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
