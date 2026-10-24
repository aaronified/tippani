# ADR-0268: The fixed ladder stays the default; adaptive intervals would ship beside it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** Adaptive, FSRS-style intervals are on the roadmap as an opt-in sitting beside the ladder, not as a replacement for it.

**Why.** `item_reviews.stability` is already a half-life in days, so scaling it multiplicatively on a result is a handful of lines. The ladder stays the default and stays honest about what it is — but a lapse currently drops you to 7 from any rung, and that is the one place the loop is harsher than the science asks. Anki's move to FSRS made that argument mainstream.

**Approved.** Mine, and I approved it as opt-in on the same reasoning that retired the sliders: a default nobody has to understand.

**Reversal.** Half of this is overturned by the entry below: adaptive is the DEFAULT as of 3.1.0. What is *not* reversed is the other half — the ladder still ships beside it, fully supported, exactly as this entry insisted it must.

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_adaptive_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
