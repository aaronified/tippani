# ADR-0373: The share image picks which credit line wears portraits by a positive test

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/quoteImage.js`

**Decided.** `facesOnAttribution` checks membership of `ATTRIBUTION_CREDITS = {'author', 'speaker'}`, as a named function rather than a condition inside the draw call.

**Why.** The draw call used to ask `facesFor !== 'actor'`, so any new credit kind landed on the attribution line by falling through a negative test. That was right for a standalone quote's speaker by luck and would have been silently wrong for whatever came next. The positive form also states the rule instead of implying it: a credit is on the attribution line when it *is* the attribution — a book's author, a quote's speaker — whereas a film's attribution is its title, so the actor hangs off the meta line. This is the same class of defect as the orphan sweep's defaulting arm and `personCreditSQL`'s two switches, and I approved fixing it the same way: make the missing case visible instead of survivable.

<sub>`web/frontend/src/quoteImage.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
