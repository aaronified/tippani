# ADR-0335: Standalone quotes stage under one synthetic staged work of kind 'quotes'; a nullable parent would have disabled dedupe

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** post-1.3.0

**Decided.** A batch of work-less quotes gets one synthetic `staged_works` row of kind `'quotes'` to hang from. Grouping, dedupe, partial approval and discard then work untouched, and the approve path branches on the kind it already reads.

**Why.** `staged_quotes.staged_work_id` is `NOT NULL REFERENCES staged_works(id)`, so a quote belonging to no book and no film could not be staged at all — which meant standalone quotes could be exported and never taken back, exactly the gap 1.1.1 closed for the catalogue. Making the column nullable is worse than it looks: SQLite cannot drop a NOT NULL, so it means a full rebuild, and it breaks the very dedupe it is trying to preserve — `UNIQUE (staged_work_id, dedupe_hash)` stops collapsing anything once the first column is NULL, because SQLite treats NULLs as distinct in a UNIQUE, so a file with the same line twice would stage twice.

**Instead of.** A parallel `staged_utterances` table — rejected; it duplicates the whole staging pipeline for a second shape that wants identical behaviour.

**Approved.** Mine, and I approved naming 0023's foresight rather than silently spending it: that migration's own comment already said the `kind` vocabulary was app-validated because a CHECK cannot evolve, which is why a third kind cost nothing here.

<sub>post-1.3.0 — `internal/store/migrations/0028_staged_utterances.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
