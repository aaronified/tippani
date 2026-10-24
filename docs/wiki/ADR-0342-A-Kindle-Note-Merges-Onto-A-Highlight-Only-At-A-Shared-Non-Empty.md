# ADR-0342: A Kindle note merges onto a highlight only at a shared non-empty position, and a re-emitted record keeps the longer copy

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** `mergeClipNote` requires both the previous annotation of the same book *and* a non-empty position the two agree on. Without a position to key on, the note stays a note-only annotation. `dropClipDuplicate` handles Kindle re-emitting a whole record when a highlight is extended in place: at the same position with one text a prefix of the other, the longer wins, and any note already merged onto the copy being replaced is carried over.

**Why.** Kindle emits a note as its own record immediately after the highlight it annotates, but some devices carry no position — and attaching a note to whatever happened to come before it is worse than leaving it standing alone. Prefix matching at a shared position is what distinguishes "the same highlight, extended" from "two highlights that start alike".

**Instead of.** Merging on adjacency alone — rejected; it is right most of the time and silently wrong the rest.

**Approved.** My call. Both rules refuse to act on weak evidence, and I approved that bias throughout this parser: skipped and counted back to you beats guessed at.

<sub>1.0.0 — `internal/importer/kindle_clippings.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
