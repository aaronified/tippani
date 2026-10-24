# ADR-0084: Nested tags are a display convention, not a parent id

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** `theme/grief`, displayed hierarchically over the existing `name` column. Planned, not built.

**Why.** No schema change and no migration to regret. A parent id buys a real tree and costs a table rebuild on a foreign-key parent of three cascading join tables — the exact shape this project keeps calling its most dangerous migration class.

**Approved.** My call, recorded on the roadmap before anything was written so that the cheap shape is the one already agreed.

<sub>Not shipped — `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
