# ADR-0056: Only the five content kinds get a bin

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** Book, movie, annotation, dialogue and standalone quote go to the bin. Tags, people, stickers and avatars still delete outright, because a tag is vocabulary and a person is a reference row — deleting either is a change to how the library is organised, not a loss of what is in it, and both are cheap to recreate. Of the ten delete handlers in `internal/httpapi/*_handlers.go`, five are in scope. I drew that line and I approved it.

**Instead of.** Binning everything, which would have made the payload builder handle four more shapes for no recoverable loss.

<sub>1.8.0 — `internal/store/migrations/0031_trash.sql` · `internal/httpapi/trash.go` · `internal/httpapi/trash_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
