# ADR-0521: A selection clears when the filter changes, spans one kind, and never persists

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1

**Decided.** Changing any filter clears the selection. Selecting in a second section clears the first, and the bar names the kind. There is no persistence — the selection dies with the screen.

**Why.** A selection that survives a filter change is a set of rows you can no longer see, and the next bulk action applies to things that are not on screen. Cross-kind selection is forbidden because the bulk endpoints are per-kind and the available actions differ, so a mixed selection would offer the intersection and quietly do nothing to half of it. No persistence because a selection is a sentence you are in the middle of, not a state worth restoring — restoring one across a reload means the next bulk action is applied to a set the reader assembled yesterday. Approved by me as three rules that are really one: a selection is only ever what is currently visible and currently one thing.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
