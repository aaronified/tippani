# ADR-0255: reviewSource descriptors put the five queries that must agree in one place

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** A `reviewSource` struct names each kind's table, parent, parent key and its own eligibility rule, and builds `from()`, `ownerCol()`, `reviewJoin()`, `where()` and `bucketClause()` from it.

**Why.** Five queries have to agree on what is reviewable — the two deck buckets, the badge count, the status tally and the Stats half-life — and until standalone quotes arrived they agreed by being copies of each other, which held only because annotations and dialogues have the same shape. Standalone quotes have neither a parent table to take the user scope from nor the same eligibility rule. Copies would have diverged the first time one was updated and another forgotten, and the symptom is a badge promising cards the deck will not serve.

**Approved.** Mine, and I approved the refactor before the feature rather than after the first divergence.

<sub>1.5.0 — `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
