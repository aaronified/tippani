# ADR-0331: Selections chunk their bound ids — 32766 is a real ceiling, and the fullest queue was the one that could not be emptied

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `sqlIDChunk = 900`, and `chunkIDs` splits every `IN (...)` list. Every caller runs inside one transaction, so a chunked statement is still all-or-nothing.

**Why.** SQLite's compiled parameter limit is 32766, and a *resolved* selection is not bounded by the 5000 cap — that guards only the explicit ids a client sends, while `all` and `batch_id` expand server-side to the whole queue. The queue is designed to hold quotes indefinitely, so one 5 MB Kindle export can put tens of thousands in it. Without chunking, "Approve all" answers 500 exactly when there is most to approve, and the queue cannot even be discarded.

**Instead of.** Capping the resolved selection too — rejected; that caps the feature rather than the statement.

**Approved.** Mine, and the shape of the bug is what I approved recording: the failure lands precisely on the largest imports, which are the ones the staging queue exists for.

<sub>1.2.0 — `internal/httpapi/import_staging.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
