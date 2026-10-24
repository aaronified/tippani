# ADR-0520: Right-click yields to the browser when text is selected

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1

**Decided.** A non-collapsed selection inside the target means the browser's own menu wins — no `preventDefault`.

**Why.** This is a note-keeping app. Selecting a passage and right-clicking it to copy, search or look it up is not an edge case here, it is a core motion, and replacing that menu with an app menu takes away the thing the app is for. It also composes with the gesture ground rules, which forbid `user-select: none` on quote text for the same reason. My call, and it is the one place I am happy to lose a gesture entirely.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
