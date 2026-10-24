# ADR-0278: Achievements are off by default, computed at query time, one streak

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** Milestones are derived from data already in the library at query time — no counters table, no background jobs, nothing ticking — off by default, private, nothing social, shown as a dismissible shelf. Exactly one streak exists, on the review, and a missed day spends a built-in grace rather than zeroing the count.

**Why.** Achievements mostly mark distance travelled, and distance travelled is already stored. The one streak earns its keep on the review because that is the loop turning up matters for, and it is built the forgiving way the loop already works — mirroring the rule that a lapse is shortened, never hard reset. It is never dressed up as a loss: "You broke your streak!" banners are exactly what I will not do. Streaks stop at the review; nothing else in the app grows one.

**Approved.** Mine, and I approved the restraint as the feature — the version worth building is the one that is easy to leave switched off.

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
