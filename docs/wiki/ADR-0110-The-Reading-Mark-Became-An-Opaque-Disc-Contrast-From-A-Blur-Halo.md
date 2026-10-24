# ADR-0110: The reading mark became an opaque disc: contrast from a blur halo does not survive an 18px cover

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** post-1.3.0

**Decided.** `ReadingBadge` — the one glyph that still rides on artwork — is an opaque disc in shelf blue with a white glyph and a hard rim.

**Why.** It was a bare blue glyph carrying a dark blur halo, and a halo is a soft gradient, so at the ~18px a phone cover gives it the halo ate the thin strokes it existed to protect and the mark read as a smudge on anything but plain artwork. Contrast from an edge does not scale away. It also stops being the one thing in the app with a glow.

**Reversal.** Reversed. What I got wrong was testing the badge at the size I was drawing it rather than the size a phone renders it at.

**Approved.** Mine both times; I approved the redraw as soon as I looked at a real cover grid on a phone instead of a component in isolation.

<sub>post-1.3.0 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
