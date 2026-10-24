# ADR-0369: Every word on a backdrop card carries a zero-offset halo in the drawn skin's own surface colour

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/test/dom/quote-image-halo.test.jsx`

**Decided.** Text on a backdrop card is haloed, with **no** offset, in the surface colour of the skin being drawn.

**Why.** A photograph is not a background colour: it has its own lights and darks, and ink that reads cleanly on paper vanishes into a shoulder or an eye — not all of it, which would at least be obvious, but a word here and a word there, in the one artefact this app produces that somebody else reads. Zero offset makes it a glow around each letter rather than a drop shadow beneath it, because the text is meant to be *on* the card, not floating above a picture. The colour comes from the skin being drawn rather than the one on screen, since the picture's skin is chosen separately and frequently is not the app's — reading the live theme here would have been correct only by coincidence. Approved by me, and the "drawn, not displayed" detail is the part that is easy to get wrong twice.

<sub>`web/frontend/test/dom/quote-image-halo.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
