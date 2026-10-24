# ADR-0522: Bulk delete is never reachable from a gesture, ships last and alone, and needs the bin first

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1

**Decided.** Select → toolbar Delete → typed confirmation. Never a swipe, never a long-press, never adjacent to Select or Edit in the menu; below a separator and danger-styled. It is the final commit of the plan, and it depends on the bin.

**Why.** Every other action in the registry is recoverable or trivially redone; this one deletes forty rows. Three deliberate frictions: it cannot be reached by a gesture that could be made by accident, it is separated from the actions people press constantly, and it costs a typed confirmation. Shipping it last and alone means the commit that introduces it changes nothing else, so it can be reverted on its own. Requiring the bin first is the load-bearing dependency — bulk delete is only sane because every in-scope delete is recoverable for 30 days. My call, and the ordering is the part I would defend hardest.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
