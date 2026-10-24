# ADR-0235: Recall is computed at query time from a stored half-life

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.4.0

**Decided.** Recall probability is `p = 2^(-elapsed_days / stability)`, with `stability` the memory half-life in days. A card is due when `elapsed >= stability`, so both due-ness and most-forgotten-first ordering reduce to plain `julianday()` arithmetic. `dueSQL` is written once and spliced into both the deck and the badge.

**Why.** No math functions, no stored due date, no background job, nothing ticking — which is what §8's CPU budget demands on a box sharing a hundred other services. Statuses are derived at read time and never stored, so an edit cannot leave a stale one behind. `dueSQL` exists as a single string because spelling it twice is how the deck and the badge come to disagree about how many cards are left.

**Instead of.** A stored `due_at` column plus a sweep — rejected; it is a cache of an expression that costs nothing to evaluate.

**Approved.** Mine, and I approved it as the founding constraint of the whole feature rather than an implementation detail.

<sub>0.4.0 — `internal/httpapi/review_handlers.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
