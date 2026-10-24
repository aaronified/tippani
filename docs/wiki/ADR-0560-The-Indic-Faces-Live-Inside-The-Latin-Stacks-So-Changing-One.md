# ADR-0560: The Indic faces live inside the Latin stacks, so changing one rebuilds three

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `--font-display`, `--font-ui` and `--font-hand` each name the Latin face first and then the Bengali and Devanagari faces. Stacks are composed in `stackFor` from the WHOLE choice, not per role.

**Why after the Latin face and not before.** No Latin codepoint ever reaches the Bengali face and no Bengali codepoint stops at the Latin one, so one stack serves both and neither pays for the other. Listed *before*, the Indic faces' own Latin subsets would win and the app would change typeface.

**The consequence, which is the non-obvious part:** picking a new Bengali face has to rebuild the display, ui and hand stacks too. A per-role substitution would leave a Bengali quote inside a book card rendering in the old face while the Bengali row of the picker showed the new one.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/fonts.js` · `web/frontend/test/dom/fonts.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
