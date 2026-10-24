# ADR-0487: Quotes expand on click, and overflow is measured rather than guessed

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** The "show more / show less" buttons are gone; clicking the text expands it. `ExpandableDescription` sets `overflows` from `el.scrollHeight > el.clientHeight + 2`, re-checked by a `ResizeObserver`, and the click target only becomes a button when it can actually toggle.

**Why.** A character-count heuristic is wrong at every width, in both directions: it shows a chevron on a short quote in a wide column and hides one on a long quote in a narrow one. Measuring answers the question that is actually being asked — does this box clip its content — and the observer keeps the answer true through a resize or a column change. Making the whole text the target rather than a separate button is what let the button go; `role`, `tabIndex` and handlers are attached only when there is something to toggle, so a card with nothing hidden is not announced as a control. I approved removing the buttons on the strength of the measurement, not before it.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
