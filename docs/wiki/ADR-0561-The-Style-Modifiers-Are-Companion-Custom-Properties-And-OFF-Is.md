# ADR-0561: The style modifiers are companion custom properties, and OFF is inherit

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0, revised 1.15.2

**Decided.** Bold, italic, small caps, all caps and lining figures are per role, applied through five companion properties (`--font-display-weight` and so on) set beside every `font-family: var(--font-X)` — 69 rules in `index.css` and 63 inline styles.

**Why not at `:root`.** These are inherited properties. Set once at the root they would land on everything, and a modifier meant for the label face would restyle the quotes.

**Why `inherit` rather than `normal` for off.** A heading already set to 600 must not be flattened to 400 by a role nobody has touched. "Off" has to mean *whatever this element would have been*, which is exactly what an untouched preference should mean.

**Where an element already sets its own weight or italic, the companion is dropped** rather than left to fight it — 89 such sites, found by walking each object literal and rule block rather than by eye.

**"Monospace" was asked for and is not here.** Whether a face is monospaced is a property of how it was drawn; no CSS makes a proportional face monospaced, so a switch by that name could only lie. `font-variant-numeric: tabular-nums` is the real thing behind the request and ships as "Lining figures". Small caps and all caps are absent from the Bengali and Devanagari rows, which have no case at all.

**Reversal (1.15.2).** The screen no longer says any of that. The clause this entry used to carry was:

> **"Monospace" was asked for and is not here, and the picker says so.**

It said so in a paragraph under the Labels row's style chips, shown to every reader who opened that row, forever, because one reader once asked for a control. That is an answer with no question attached: the paragraph names a switch that is not on the screen, so the only way to understand it is to have wanted the switch. Explaining an absence to the person who never noticed it is how a settings panel turns into a transcript of its own arguments. The reasoning belongs where reasoning goes — this entry, and the comment over `FONT_STYLES` in `fonts.js` — and "Lining figures" still ships, still named after what it does.

**Approved.** The reader's for the list, mine for the two substitutions; the owner's for dropping the on-screen explanation.

<sub>1.15.0, revised 1.15.2 — `web/frontend/src/index.css` · `web/frontend/src/fonts.js` · `web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
