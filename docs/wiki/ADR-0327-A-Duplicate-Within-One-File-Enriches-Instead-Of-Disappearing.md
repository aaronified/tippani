# ADR-0327: A duplicate within one file enriches instead of disappearing, keeping the approved count equal to the shown count

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `stageQuotes` uses `INSERT OR IGNORE` against `UNIQUE (staged_work_id, dedupe_hash)`; on a collision it calls `enrichStagedQuote` rather than moving on.

**Why.** The live importer enriched in that case rather than discarding, so staging must too — otherwise the second copy's locators, note, colour and tags are lost silently, before anyone can see them. The unique constraint mirrors `annotations`' `UNIQUE (book_id, dedupe_hash)`, so a file's internal duplicates collapse exactly as they used to and the count a user sees in the queue is the count they will approve. It is deliberately *not* unique across batches: importing the same file twice gives two batches, and discarding one is the answer.

**Approved.** I approved this because the queue's whole value is that what you see is what you get, and a silent drop between staging and approval would break that.

<sub>1.2.0 — `internal/httpapi/import_staging.go` · `internal/store/migrations/0023_import_staging.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
