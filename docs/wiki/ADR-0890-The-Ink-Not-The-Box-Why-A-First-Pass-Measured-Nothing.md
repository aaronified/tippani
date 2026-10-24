# ADR-0890: The ink, not the box — why a first pass measured nothing

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`glyph-align.mjs` reports the glyph's INK (`getBBox()` mapped through the viewBox) against
the painted rect of the text beside it, on 24 addresses at both widths. **A first cut
measured element boxes, reported every count in the app as within 1.5px, and disagreed with
the owner.** The owner was right and the instrument was wrong: this app's fill glyphs are
Phosphor icons with viewBoxes cropped off centre (`viewBox="14.1 2.1 243.9 243.9"`), so a
box centred to the pixel can still have its drawing sitting three pixels high. What the eye
reads is the ink.

**AND THREE FILTERS EARN THEIR PLACE, EACH ADDED AFTER A WRONG READING** — which is the
part worth recording, because each one was a number this probe reported with confidence:

- A glyph and the words must belong to the same CONTROL. A toolbar row holds three buttons
  and also holds an svg and the word "Export", so the row measured one button's glyph
  against another button's label and reported **11.6px** of nothing.
- The two rects must overlap vertically. A glyph that LEADS a block — a dock button over
  its label, a clamp-more under a paragraph — is not an alignment question, and those came
  back as 21px.
- A label this app has clipped away is not text on the screen. Every icon-only control
  keeps its words in the accessibility tree with `clip: rect(0 0 0 0)` rather than
  `display: none`, and the text's line box is still laid out and still measurable — so a
  height filter does not catch it. This is the one check in the probe that reads a style
  rather than a rect, and it is there because there is nothing in the geometry to read.

Thirteen findings became four real ones. `glyph-align-baseline.json` carries what is left
with a reason per site, and a NEW site fails rather than being appended — the same
instrument `typescale-baseline.json` is. Two entries in it are honest debt rather than
argued exceptions, and say so.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
