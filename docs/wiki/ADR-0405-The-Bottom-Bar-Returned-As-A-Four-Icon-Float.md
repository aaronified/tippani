# ADR-0405: The bottom bar returned as a four-icon float

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** Four thumb-reachable icons — Search, Home, Library, Catalogue — hovering clear of the bottom edge so the Android gesture pill keeps its own strip. It slides away as you read down the page and returns on the way back up. Reduced motion opts out of hiding entirely rather than snapping.

**Why.** An addition, not a replacement: the ☰ drawer still owns the utility tabs, ＋ Add and the account rows, so the bar carries only what a thumb reaches for constantly and the drawer carries everything. Reduced motion opts out of the *hiding*, not into a jump cut, because the accessible answer to an animation is stillness, not the same movement without frames.

**Reversal.** Of 0.4.0's removal.

**Approved.** My call, and I approved it as an addition specifically so the drawer would not have to shrink to justify it.

<sub>1.0.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
