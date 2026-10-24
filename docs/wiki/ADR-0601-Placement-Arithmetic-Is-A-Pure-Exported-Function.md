# ADR-0601: Placement arithmetic is a pure exported function

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.6

**Decided.** The popup flip / clamp / cap arithmetic is a pure function tested on its own, not through the DOM.

**Why.** Jsdom applies no layout and reports every rectangle as zeros, so a test driving the placement through the DOM would be asserting that nothing fits inside nothing. The same blindness is why all six existing tests over the collapsed colour picker passed while it was broken — the elements were present, correct and accessible, in a box with no height.

**Approved.** My call, and I approved extracting the arithmetic specifically so it could be tested at all.

<sub>1.7.6 — `CHANGELOG.md` · `web/frontend/test/pure/anchored-popup.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
