# ADR-0474: useDismiss takes a list of refs, because portalling changed what counts as "outside"

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** `useDismiss(open, close, [ref, popRef], {event})` — a list, not a wrapper element. The event is configurable, defaulting to `mousedown`.

**Why.** A popup rendered into `<body>` is no longer inside the wrapper, so the familiar `wrapper.contains(e.target)` reports every click *on the popup* as an outside click and the menu closes on the way to choosing from it. Every migrated call site hit this, which is precisely why the check lives in one place. The event choice is real rather than cosmetic: `pointerdown` lands before focus moves and `mousedown` after, and `TokenInput`'s blur handler commits typed text, so swapping them changes the order those two run in — the same portal trap shows up there as "picking 'fantasy' after typing 'fant' enters `fant`". Mine.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
