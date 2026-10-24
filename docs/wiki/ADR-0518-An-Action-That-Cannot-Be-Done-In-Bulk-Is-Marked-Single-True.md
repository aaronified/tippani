# ADR-0518: An action that cannot be done in bulk is marked single: true

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1

**Decided.** Every action appears in both lists or is explicitly flagged, and a test asserts it.

**Why.** An action that can be done to one thing and not to forty is a real category — Edit is exactly that — so the registry marks it rather than omitting it. Absence is what drift looks like; a flag is what a decision looks like. The two are indistinguishable in a list, which is the entire reason for the flag. Mine, and it is the same principle as `orphanRefQuery` returning `""` instead of falling through: make the missing case visible.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
