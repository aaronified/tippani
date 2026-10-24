# ADR-0448: The icon vocabulary was drawn from a counted button inventory, not from the plan's guess of twenty-six

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** Every glyph in the set has at least one call site in the sweep that introduced it. The list was built by counting what the tree actually had.

**Why.** The plan for the release guessed at twenty-six icons; the tree held nineteen distinct `GhostButton` labels in total, most of them one-off. Counting first is why the list is short — a vocabulary drawn from a wishlist is a set of glyphs with no meanings attached, which is worse than words.

**Reversal.** The guess was mine and it was wrong by roughly a third. What I got wrong was estimating the surface instead of measuring it, on a codebase sitting right there.

**Approved.** I approved throwing the estimate away and working from the inventory, and approved recording the discrepancy rather than quietly shipping nineteen.

<sub>1.6.0 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
