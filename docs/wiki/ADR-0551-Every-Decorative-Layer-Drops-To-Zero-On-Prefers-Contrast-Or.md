# ADR-0551: Every decorative layer drops to zero on prefers-contrast or prefers-reduced-transparency

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** Under either media query the page grain, the scenic backdrop, the card
tiles, the dither, the shell tiles and the accent grain all go to zero. Nothing structural
moves: borders, lifts, colours and layout are untouched. `accent-texture.test.jsx` reads
the stylesheet and fails when a textured surface has no entry in that block.

**Why.** `.grain-overlay` is a fixed layer at `z-index: 60` — it multiplies over every
glyph and every input on the screen. At 5.5% opacity that is the whole point of the design
for most readers and 5.5% of noise standing between the text and someone who has asked
their operating system for more contrast. Those two media queries are the two ways a
person says so, and neither was honoured anywhere in the file.

**Reversal.** Of an omission rather than a decision, and the trigger matters: this landed
in 1.6.0 rather than with the accessibility work it belongs to, because 1.6.0 added six
more textured surfaces and shipping those with no way off was not defensible. What is
left — raising ink and hairline contrast to WCAG AA, and an in-app switch for a reader
whose OS is not set that way — is on the roadmap under
[access &amp; reading comfort](Roadmap.md#access).

**Approved.** Mine, and I approved pulling it forward rather than letting the release ship
without it.

<sub>1.6.0 — `web/frontend/src/index.css` · `web/frontend/test/dom/accent-texture.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
