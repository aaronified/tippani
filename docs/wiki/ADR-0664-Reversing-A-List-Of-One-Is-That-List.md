# ADR-0664: Reversing a list of one is that list

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.5

**Decided.** The two-sided layout swaps by choosing which SIDE each face is given; only the line-up reverses the list.

**The fault.** "Change the people chip from left to right (or simply swap, thus the same key works for two characters as well)" — one person is the plain reading, and one person was the case that did not work, because `[A].reverse()` is `[A]`. The toggle was a no-op on the request's own example, the help text promised it in two languages, and the preference it saved then reversed the reader's next two-person card.

**One flag, three layouts, and it does not follow that one implementation covers them.** The line-up genuinely wants the order reversed. The sides want the side each face is given. Writing both as "reverse the list" was an economy that happened to be correct for two of the three.

**And it was only visible on a backdrop**, which is off by default — so a reader on the default settings never found the control the request asked for. The chips honour it now: a cluster has no edges, so there "swap" means the other face leads, which is the same statement one layout over.

<sub>2.2.5 — `web/frontend/src/quoteImage.js` · `web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
