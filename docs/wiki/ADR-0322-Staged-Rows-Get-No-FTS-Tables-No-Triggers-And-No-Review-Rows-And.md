# ADR-0322: Staged rows get no FTS tables, no triggers and no review rows, and tags stay denormalised text

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** The staging tables carry no FTS5 index and no FTS triggers, no `item_reviews` rows, and tags as comma-joined text in `staged_quotes.tags` rather than join rows against `tags`.

**Why.** All three are consequences of the previous decision and all three are intended. Staged text is not searchable and cannot be pulled into a quiz. Repetition state begins at approval, not at import. And a tag that exists only inside an unapproved import does not appear in the user's tag vocabulary — approval is what turns it into a real join row. Having no FTS triggers also keeps these tables clear of the external-content hazard 0022 recorded, where a trigger that writes the row it fired on corrupts an FTS index.

**Approved.** I approved each consequence explicitly in the migration comment, because "we forgot the triggers" and "we deliberately have no triggers" look identical from the schema alone.

<sub>1.2.0 — `internal/store/migrations/0023_import_staging.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
