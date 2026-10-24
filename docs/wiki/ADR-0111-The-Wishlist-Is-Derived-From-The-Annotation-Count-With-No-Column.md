# ADR-0111: The wishlist is derived from the annotation count, with no column and no bookkeeping

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** A work with zero annotations or dialogues *is* the wishlist. Migration 0024 gave it no column, deliberately.

**Why.** It needs no storage and can never drift out of sync with the quotes it counts. A set status wins over wishlist for the label a tile draws — a book you started last night has no quotes yet and satisfies both, and the state you chose is the truer one — while the wishlist *filter* keys on the count alone, so the two chips never disagree about the same row.

**Instead of.** A `wishlist` boolean — rejected as a second source of truth for something already computable.

**Approved.** I approved this in the migration itself and wrote the reasoning into the SQL comment, so the next person to reach for a column finds the argument before they add one.

<sub>1.3.0 — `internal/store/migrations/0024_in_progress.sql` · `web/frontend/src/works.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
