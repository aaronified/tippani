# ADR-0177: Look-alike titles are flagged for review, never auto-merged

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `findSimilarBooks` and `findSimilarMovies` surface same-title candidates at import, at add-from-source and in the Metadata console's duplicate groups. Merging is always an explicit act — `POST /books/merge` — and a movie add past a look-alike needs `confirm_new`.

**Why.** The fuzzy title rule (subtitle dropped, punctuation stripped, case-folded) is right often enough to be useful and wrong often enough that auto-merging would lose real rows — two editions of one book are a merge, a film and its remake are not. Films are additionally scoped to the same `media_type`, because a movie and a show of the same name are never the same entry. On the merge itself: annotations re-point to the target and any that would collide on `(book_id, dedupe_hash)` are dropped rather than duplicated — `UPDATE OR IGNORE` leaves them on the source, which is then deleted — so a quote already on the target does not come back twice. Detection and action are separate endpoints on purpose. I approved this split; detection is cheap to be generous with, action is not.

<sub>`internal/httpapi/import_dupes.go` · `internal/httpapi/metadata_bulk.go` · `internal/httpapi/movie_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
