# ADR-0124: The completeness score asks whether a year is present, not whether it is positive

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** The metadata console's `has_year` is `published_year IS NOT NULL AND published_year <> 0`, not `> 0`.

**Why.** It was `> 0`, so the oldest books in a library — the ones the BCE work existed to make storable — would have been the ones it nagged about hardest. The score's question is "is a year recorded", and 0 is the answer to that, not the sign.

**Reversal.** Reversed. This is a bug that shipped inside the same release as the feature that created it: I widened the domain of the column and did not go looking for the places that had encoded the old domain as a comparison.

**Approved.** Mine, and the lesson I approved recording is the general one — a widened range means auditing every predicate over it, not just the validator.

<sub>1.7.4 — `internal/httpapi/metadata_library.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
