# ADR-0304: The daily deck's "seeded" options were never seeded

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `quizPools` sorts its work list after building it from a map, and the quote sampler orders by a hash of the id when a seed is present instead of `ORDER BY RANDOM()`.

**Why.** The deck's whole contract is that today's cards are the same cards, in the same order, with the same choices, on every device. The comment saying so had been there for releases. The pool underneath came from Go map iteration — deliberately randomised — and a SQL `RANDOM()`, so the same card offered different wrong answers on a phone and a laptop, and nothing anywhere reported it.

**Instead of** trusting the comment. This is the second time in this section a stated invariant turned out to be enforced by nothing.

**Approved.** Mine.

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_seed_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
