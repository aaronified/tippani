# ADR-0337: Book identity falls through ISBN → ASIN → title+author, read-only, with identifiers backfilled fill-empty-only

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** pre-1.0, split read-only in 1.2.0

**Decided.** `findImportBook` tries normalised ISBN, then ASIN, then `lower(title)` + `lower(author)`, skipping any key it does not have, and writes nothing. `upsertImportBook` wraps it and backfills the matched row's missing identifiers, author, series and series index with `UPDATE OR IGNORE ... COALESCE(col, ?)`.

**Why.** The same book arrives with an ISBN from one tool and bare title/author from another, and both must land in one row for cross-source quote dedupe to work. Backfilling the cheap key on a match means the *next* import, which may carry only one identifier and a differently-formatted title, still matches. `OR IGNORE` skips rather than fails if another row already owns that ISBN or ASIN, since both carry partial unique indexes per user. Fill-empty-only throughout, so existing data always wins.

**Approved.** My call, and the read-only split is the part I approved deliberately — it is what lets the staging queue ask "where would this land?" using the identical resolution that will actually run.

<sub>pre-1.0, split read-only in 1.2.0 — `internal/httpapi/import_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
