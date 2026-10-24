# ADR-0081: A category name is fifteen runes, down from twenty-four

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** Unreleased as of 1.7.6

**Decided.** `CAT_NAME_MAX = 15`, counted in code points, mirrored by `catNameMax` in `auth_handlers.go`, which refuses a longer name rather than storing a cut-off one. `capCategoryName` slices by code point, not UTF-16 unit, because a `.slice()` can cut an astral character in half and leave a lone surrogate — one unit to JS, one rune to Go, and a validation failure with no on-screen explanation.

**Why.** These are labels. They ride a swatch tooltip, a filter chip, a group heading and the Stats breakdown's label column, and none of those has room for a sentence. Twenty-four was a number nothing was built for: the breakdown's column could not hold one and ellipsised instead, which is a chart truncating the very categories it is breaking down. Fifteen is what that column holds outright, so the cap and the layout agree. Every built-in name fits with room to spare — "Inspirational" is 13, "Uncategorised" 13. The constant lives in `theme.js` rather than in `Settings.jsx` because `StatsPage` sizes its label column from it, and a cap the layout is cut for has to be a cap the layout can see.

**Reversal.** Of my own 24, which I had picked without checking what read it.

**Approved.** My call, and I approved it as the cap moving to meet the layout rather than the layout apologising for the cap.

<sub>Unreleased as of 1.7.6 — `web/frontend/src/theme.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
