# ADR-0491: prefers-contrast: more and prefers-reduced-transparency strip every decorative layer

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/index.css` · `web/frontend/src/ui.jsx`

**Decided.** Both queries drop the page grain, the scenic backdrop, the card tiles, the dither, the shell tiles and the accent grain to zero. Nothing structural moves — borders, lifts, colours and layout are untouched. `prefers-reduced-motion` neutralises every transition and animation *and* opts out of behaviour: `usePlayful` returns without picking an animation at all.

**Why.** The grain overlay is a fixed layer at 5.5% opacity multiplying over every glyph, every quote and every input on the screen. It is the whole point of the design, and for a reader who has asked their operating system for more contrast it is 5.5% of noise standing between them and the text. Neither query was honoured anywhere in the file. What is left after the sweep is the same app with the noise taken off, not a different one — which is the test I applied to decide what counts as decorative. Reduced motion had to go further than a transition reset because the playful animation carousel is a *behaviour*: suppressing the transition on something that was never going to be transitioned is not honouring the request. It arrived one section early because it costs one rule, and the alternative was shipping a release that added six more textured surfaces with no way to turn any of them off. Mine.

<sub>`web/frontend/src/index.css` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
