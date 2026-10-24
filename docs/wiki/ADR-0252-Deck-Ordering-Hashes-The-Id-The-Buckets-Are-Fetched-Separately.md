# ADR-0252: Deck ordering hashes the id, the buckets are fetched separately, and spreadByWork rotates

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** Every ordering ends in `shuffleKeySQL` — `(id * 2654435761 + kindSalt + seed) % 100003` — the due and unseen buckets are fetched by separate queries, and `spreadByWork` re-orders the merged list by rotating through one queue per work, taking each work's best-ranked remaining card in turn.

**Why.** The hash breaks the tie that made the fetch a prefix. Separate fetches stop one bucket starving the other. The rotation stops one book owning a deck, and its trade-off is deliberate and stated: a work with 400 quotes and a work with 2 get one slot per rotation each, so a large book is covered more slowly than its share of the library — which is the point, since the complaint being fixed is a big import monopolising every deck. Queue order is first appearance, so the most-overdue work still leads.

**Approved.** Mine, and I approved the unfair-to-large-works trade rather than weighting by size.

<sub>1.0.0 — `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
