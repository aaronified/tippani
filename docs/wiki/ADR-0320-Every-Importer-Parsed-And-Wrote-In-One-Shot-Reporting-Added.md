# ADR-0320: Every importer parsed and wrote in one shot, reporting added/skipped/enriched after the fact

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0 (reversal)

**Decided.** This is the state 1.2.0 replaced, recorded because it is the problem the rest of the section is the answer to.

**Why.** By the time the results screen said what had happened, the quotes were already in `annotations` / `dialogues`, already indexed for search, already in the review deck, and the only undo was hand-deleting them. The 1.1.1 bug where a film's own export re-imported as a *book* is exactly the class of mistake that should be caught before the write, not reported after it.

**Reversal.** Reversed in 1.2.0. What I got wrong originally was treating the results screen as a report when the user needs it to be a decision point.

**Approved.** The original design was mine and so was overturning it; I approved the rewrite once a real misdetection made the cost concrete rather than theoretical.

<sub>1.2.0 (reversal) — `CHANGELOG.md` · `internal/store/migrations/0023_import_staging.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
