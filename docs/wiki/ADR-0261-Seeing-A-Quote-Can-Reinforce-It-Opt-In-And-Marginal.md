# ADR-0261: "Seeing" a quote can reinforce it, opt-in and marginal

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.6.2

**Decided.** `srSeen` lets practising a quote (a non-skip answer), sharing it or favouriting it lengthen its half-life marginally. Off by default at 1.0×. Merely appearing in the Daily Quiz explicitly does not count.

**Why.** Encountering a quote is weak evidence you still hold it, and weak evidence deserves a weak effect. The Daily Quiz is excluded because its got/forgot already drives the schedule in full, and counting the same encounter twice would compound. The bump uses `max()` so a "seen"-lengthened half-life is never shortened by a later success.

**Approved.** I approved this off by default; a schedule that moves for reasons you did not intend is worse than one that moves too little.

<sub>0.6.2 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
