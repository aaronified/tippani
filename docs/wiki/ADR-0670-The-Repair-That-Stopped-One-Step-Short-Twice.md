# ADR-0670: The repair that stopped one step short, twice

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.7

**Decided.** `onCastChanged` hands over the cast it has just reloaded, and the host builds a new record around it.

**Three versions of one seam.** The panel called `onChanged?.()` with no argument; the prop was the host's record setter; the page unmounted. The repair renamed the prop and passed `onChanged?.(item)` — never undefined, and never anything either: setting React state to the same reference is a bail-out, so nothing re-rendered and nothing refetched. The panel's edits reached the boards only after a manual reload.

**THE SECOND FAILURE IS THE SAME SHAPE AS THE FIRST, one level up**, and the test written to prevent a recurrence could not see it: `cast-panel.test.jsx` asserts what the panel PASSES, which is exactly right and exactly half. What the host DOES with it is the other half, and both bugs lived there. The new case renders the real dialog, drives the real panel and asserts the record the host was handed — not undefined, not the same object, and carrying the cast.

**The general rule, now written down twice over.** A callback crossing a component boundary has three things worth asserting: that it is called, what it is called WITH, and what the other side does with it. A stub answers only the first.

<sub>2.2.7 — `web/frontend/src/cast.jsx` · `web/frontend/src/WorkDetails.jsx` · `web/frontend/test/dom/details-save-all.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
