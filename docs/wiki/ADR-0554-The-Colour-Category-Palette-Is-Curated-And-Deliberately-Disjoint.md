# ADR-0554: The colour-category palette is curated, and deliberately disjoint from the accents

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** A category colour is picked from a fixed list of sixteen named swatches, not
a free hex field. The list avoids not just the four accent values but the whole
ochre / terracotta / olive / slate neighbourhood. `palette.test.jsx` holds it there.

**Why.** The point of a category colour is that several of them are distinguishable at a
glance, and that survives about as long as the first two near-identical blues. Keeping
them clear of the accent range means a category can never be misread as the app's own
accent — a same-hue collision on a filter chip is exactly where that goes wrong.

**Instead of.** A free hex field, which is what every app that has this feature offers,
and which is the reason their palettes look the way they do. And a mere exact-value
exclusion, which would have passed review and failed in use, because "not the same hex"
is not "tells apart".

**Approved.** Mine, and I approved pinning it with a test rather than a comment, since
"these look different enough" is the kind of judgement that stops being true when someone
adds a sixteenth swatch.

<sub>1.7.0 — `web/frontend/src/theme.js` · `web/frontend/test/dom/palette.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
