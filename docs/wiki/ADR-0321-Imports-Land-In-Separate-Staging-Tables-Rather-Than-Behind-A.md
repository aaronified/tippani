# ADR-0321: Imports land in separate staging tables rather than behind a pending flag, so no existing read can leak an unapproved quote

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** Migration 0023 adds `import_batches`, `staged_works` and `staged_quotes`, deliberately outside the live tables. Ownership is by parentage — `staged_quotes` → `staged_works` → `import_batches`, which carries the `user_id` — mirroring `annotations` → `books`, with no `user_id` on the child tables to drift out of step.

**Why.** A `pending` flag on `annotations` would have had to be threaded through every existing read as `WHERE pending = 0` — dozens of queries, each one a place to forget it and leak an unapproved quote into a list, a search hit or a quiz card. Separate tables make the *default* safe: no existing query can see staged rows because no existing query names these tables.

**Instead of.** The `pending` flag — rejected on exactly that failure mode.

**Approved.** Mine, and this is the decision the whole section rests on. I approved paying for three new tables to buy a default that cannot be forgotten.

<sub>1.2.0 — `internal/store/migrations/0023_import_staging.sql` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
