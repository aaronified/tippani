# ADR-0716: A name can be complete, unclipped, and in two pieces

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Found by looking at the screen at a width nobody had looked at. Kept because every
existing guard passed while it was happening.*

- **What it looked like.** Between about 850 and 950px, the work hero's action buttons
  float right and were wide enough to leave a sliver on the FIRST line and nothing after
  it. The title flowed into that sliver: *Moby-Dick; or, The Whale* drawn as "Moby-", then
  five buttons, then "Dick; or, The Whale" beside the cover. Its neighbours at 1000 and
  800 were both fine, which is why a single sample would have reported the screen well.
- **`clear: right` on the title is the whole fix.** The cover float is deliberately NOT
  cleared — text beside the cover is the arrangement, and it is what the float layout
  exists for. Clearing only the right float means the title never shares a line with the
  toolbar at any width, and it now fits on one line across the whole band rather than
  two or three squeezed beside the buttons.
- **The standing rule was already right and did not reach this.** "Never truncate a name"
  exists because a shortened name and a short name look alike; `no-truncated-names.test.js`
  enforces it by reading the stylesheet for `text-overflow: ellipsis`. This name was not
  truncated, not clipped and not overflowing — so nothing fired. The general form of the
  rule is stronger: **a name is drawn in one piece, and its lines all start in the same
  place.** That is now measured — `frame-scroll.mjs` groups the title's client rects into
  lines and fails when their left edges disagree, at eight widths from 1179 down to 780.

<sub>Unreleased — `web/frontend/src/works.jsx` · `scripts/screenshots/frame-scroll.mjs` ·
`Developing.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
