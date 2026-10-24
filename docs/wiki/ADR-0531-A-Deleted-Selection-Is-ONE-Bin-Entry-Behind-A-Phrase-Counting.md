# ADR-0531: A deleted selection is ONE bin entry, behind a phrase counting what will go

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** Bulk delete writes a single `trash` row of kind `selection` (migration 0032) holding every row from every item. It requires a typed phrase — "delete 3 quotes" — checked on the server, and the count in that phrase is the count of items the caller actually OWNS.

**Why.** Forty-one entries for one act would be a wall of rows in the bin for a single decision, and undoing it would mean forty-one restores that can each half-fail. One entry makes it one Undo, and the restore needed no new code: it walks the payload's tables in foreign-key order, and a payload holding forty annotations is the same shape as one holding a single annotation.

The phrase counts the OWNED items because otherwise a selection containing one id that is not yours would refuse every phrase a reader could possibly type, with no way to find out why. That is the kind of dead end that reads as a broken feature.

A typed confirmation for something the bin makes recoverable looks like belt and braces. It is not: this is the only path in the app that removes many things at once, the friction is the point, and it is unreachable by any gesture.

**Instead of** rebuilding nothing and packing selections into the existing `book`/`quote` kinds, which would have meant a bin row that lies about what it holds. The rebuild is safe here specifically because `trash` is a leaf: nothing references it, and its only foreign key points out at `users`.

**Approved.** Mine, and I approved shipping it only after the bin.

<sub>1.10.0 — `internal/store/migrations/0032_trash_selection.sql` · `internal/httpapi/trash.go` · `internal/httpapi/bulk_handlers.go` · `internal/httpapi/bulk_delete_test.go` · `web/frontend/src/SelectionBar.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
