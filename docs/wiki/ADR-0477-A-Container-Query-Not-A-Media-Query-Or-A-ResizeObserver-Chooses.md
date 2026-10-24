# ADR-0477: A container query, not a media query or a ResizeObserver, chooses the collapsed colour picker

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/index.css`

**Decided.** `.hand-card` and `.film-frame` declare `container-type: inline-size; container-name: card`, and `@container card (max-width: 330px)` swaps the six dots for the collapsed control.

**Why.** What matters is how wide the *card* is, and a phone in a single column and a five-column desktop board can hand the same control the same 260px — so a media query answers a question nobody asked. A ResizeObserver would get the right answer by measuring, at the cost of a JS observer per card on a board of a hundred. `.cl-grid` had already established container queries here as the fix for exactly this mismatch. There is a consequence the collapsed-picker fix had to absorb: a container is a stacking context, so even at the correct height the list would have slid *under* the card beside it the moment it passed the card's edge — a menu is not part of the card it belongs to. Mine.

<sub>`web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
