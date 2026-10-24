# ADR-0434: Keyboard focus opens a label only via :focus-visible, so a tap does not double up with the long-press path

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** `onFocus` opens the bubble only when `e.target.matches(':focus-visible')` is true, inside a `try` that degrades to silence on an engine without it.

**Why.** A tap also focuses. Without the check, a touch user gets the label from the long press *and* from the focus, and matching `:focus-visible` is what separates keyboard from pointer without guessing at the input device. On an engine that does not support it, staying quiet is the safe failure — a missing label is better than a stuck one.

**Instead of.** Sniffing the input device — rejected; `:focus-visible` is the browser's own answer to the same question and is better informed than any heuristic of mine.

**Approved.** I approved the silent fallback rather than defaulting to "show it anyway", on the principle that an unexplained control beats a control explaining itself at the wrong moment.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
