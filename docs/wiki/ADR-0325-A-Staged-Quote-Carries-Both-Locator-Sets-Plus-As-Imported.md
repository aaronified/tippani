# ADR-0325: A staged quote carries both locator sets plus as-imported snapshots, so a cross-kind retarget is reversible

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `staged_quotes` holds `chapter` / `location` (book) *and* `character` / `actor` / `timestamp` (film) on every row, plus `location_orig` and `timestamp_orig`. Approval reads whichever set the destination kind uses.

**Why.** Retargeting a batch across kinds is the repair for a misdetected file, and moving book highlights onto a show must not destroy the chapter and location on the way, in case the move is itself the mistake. The `_orig` columns are the as-imported snapshot: bulk location formulae rewrite the live column, and `reset` restores the snapshot, so a formula applied by mistake is recoverable rather than permanent.

**Instead of.** Clearing the unused locator set on retarget — rejected; it makes the repair one-way.

**Approved.** I signed this off on the principle that nothing in a holding area should be irreversible, which is the whole reason the holding area exists.

<sub>1.2.0 — `internal/store/migrations/0023_import_staging.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
