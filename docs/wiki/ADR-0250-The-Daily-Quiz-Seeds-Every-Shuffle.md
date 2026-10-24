# ADR-0250: The Daily Quiz seeds every shuffle

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.x

**Decided.** `seededRand` folds the local-day seed with the card identity into one stable per-card seed, so distractor choice *and* order are identical for every client viewing the same day's card. Practice passes 0 and uses the global RNG.

**Why.** Re-randomising on each request changed the wrong options between browsers and left only the right answer stable — which is a way of telling you the answer. The same seed is why a refresh returns the same deck rather than a new one.

**Approved.** Mine; I approved seeding the whole option set rather than only the card order, which was the version that leaked.

<sub>1.x — `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
