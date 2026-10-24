# ADR-0530: Select is the first item in the card's own menu

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** Three ways in: the checkbox in a card's corner, Ctrl/Cmd-click anywhere on it, and `Select` at the top of the context menu. Once a selection exists a plain click toggles instead of opening.

**Why.** The menu entry is what makes the context menu and multiselect one feature rather than two: the gesture that asks "what can I do to this" is also how you start doing it to several. It is also the only entry point that works identically on a phone, where long-press-to-select would collide with long-press-for-menu — and the menu wins that collision, because it is the more general gesture and it contains the selection entry anyway.

The click changing meaning is the risky part, and it is legible rather than modal-by-stealth: the bar is up, the cards wear checkboxes and an accent ring. Clicking the last one off leaves the mode, so it needs no Cancel.

**Instead of** a Select-mode toggle in the toolbar as the primary door. It is a mode you have to find and then leave; the checkbox and Ctrl-click are things you already know.

**Approved.** Mine.

<sub>1.10.0 — `web/frontend/src/Library.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/selection-cards.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
