# ADR-0436: Every label and confirmation is five words or fewer, with 1.2s and 1.5s dwell times that only work because the copy is short

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** `HINT_MS = 1200` for a control's own label on touch; `TOAST_MS = 1500` for a mutation confirmation, slightly longer because it is news. Every message in the app is five words or fewer, enforced at the call sites.

**Why.** The timers are only defensible because the copy is. A toast is not a document: five words is one glance, and a pill still sitting there several seconds after the glance reads as something you are expected to act on. The rule cuts the other way too — a bubble that needs a paragraph is an info dot, which is exactly what an info dot's own hover label now says instead of putting its whole paragraph in a bubble.

**Instead of.** Longer dwell times — rejected; the fix for "I could not read it" is shorter copy, not a slower toast.

**Approved.** Mine, and I approved the two constants and the word limit as one decision, because either alone is wrong.

<sub>1.4.1 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
