# ADR-0240: A fixed ladder replaced the tunable rule, at 7 → 30 → 100

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.9.5

**Decided.** A correct recall climbs to the smallest rung strictly above the card's current half-life; a card's first-ever success starts at 7 whatever created its row; a single lapse falls straight back to 7 from any height. Migration 0019 clamps stored values above 100 down to it and lets off-ladder values climb onto the nearest rung at their next answer. Both preferences retire, dropped on read.

**Why.** Three intervals a person can hold in their head beat two multipliers nobody can evaluate. The rungs *are* the review intervals, because a card is due when `elapsed >= stability`.

**Reversal.** Yes — of 0.4.3, entirely. And **the 100-day ceiling in this entry is no longer current**: the ladder gained a fourth rung at 365 in 3.1.0, below. The ladder itself, and every rule in the paragraph above about how a card moves along it, still stands.

**Approved.** My call and I stand by it; the ladder is the version I can explain in one sentence to somebody using the app.

<sub>0.9.5 — `internal/store/migrations/0019_review_ladder.sql` · `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
