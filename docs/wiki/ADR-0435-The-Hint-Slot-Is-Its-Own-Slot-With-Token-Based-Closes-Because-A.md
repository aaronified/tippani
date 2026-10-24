# ADR-0435: The hint slot is its own slot with token-based closes, because a label and a toast can legitimately coexist

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** Hints have their own module-level sink, separate from `toast()`. Every open returns a token and every close names one; a stale close is ignored.

**Why.** Holding a button, reading its label, tapping it and getting its confirmation is an ordinary sequence, and both can legitimately be on screen at once — they must not fight over one message. The token exists because moving a mouse between two adjacent controls interleaves the second control's enter with the first's leave, and a blind close would race the new label off the screen. Returning the same state object rather than a copy when a close is stale lets React bail out of the re-render, which matters because closes arrive in pairs (`pointerleave`, then `blur`).

**Instead of.** A `variant` on the toast — rejected on the coexistence case.

**Approved.** My call. The token is three lines and it removes a whole class of flicker I would otherwise have chased with timeouts.

<sub>1.4.1 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
