# ADR-0451: Five ways to dismiss a window became two: a × over content, a back arrow out of a full-screen sheet

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** A window over the screen closes with a ×. A full-screen sheet, which *is* the screen, goes back with an arrow.

**Why.** There were five: a literal multiplication sign at font-size 24 in three modals, a hand-rolled cross at a different stroke weight in the lightbox, a *Close* ghost button in four dialog headers, a *Done* ghost button in the share dialog's footer doing the identical job as the *Close* in its own header, and a back arrow in the mobile sheet. Nothing was wrong with any one of them. What was wrong was that dismissing a window meant finding whichever one *this* window used.

**Reversal.** All five were mine, accumulated one dialog at a time. What I got wrong was never asking, while adding the fourth, what the first three did.

**Approved.** I approved the consolidation and the two-way rule, and approved recording that no individual instance was a mistake — the defect was the set, which is why nothing flagged it.

<sub>1.6.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
