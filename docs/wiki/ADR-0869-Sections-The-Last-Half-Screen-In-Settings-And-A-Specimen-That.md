# ADR-0869: Sections: the last half-screen in Settings, and a specimen that never measured anything

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**HALF OF THIS SCREEN HAD NEVER BEEN CONVERTED, AND THE HALF THAT HAD HID IT.** The order
list was a proper `PrefGroup` of `PrefRow`s; underneath it, the two cover-size sliders sat in
a hand-rolled `<div className="mt-7">` with a rule above them, a `MonoLabel`, an info dot and
both sliders side by side. The screen read as finished because its first screenful was.

The pack draws three groups, not one-and-a-block: "Show me, in this order", then **Library
covers** and **Catalogue posters** as groups of their own, each with the aside "this device"
(`settings-restructured.dc.html:2725`, `:2729`, `:2734`). Each of its slider rows carries
`label: ''` — the shelf is named by the heading above, so "Library covers" is said once
instead of once as a heading and again as "Library cover size" on the row beneath. That is
why `SizeSlider` no longer draws a label and keeps the words only as the range's accessible
name: a heading is not an accessible name, and a reader moving control to control would
otherwise meet two unnamed sliders.

**THE INFO DOT BECAME THE ASIDE**, which is the pack's own choice and the right one here. The
dot said these sizes are kept in this browser because a phone and a desk want different ones;
the aside says "this device" at the far end of each heading. The fact is the same and the
aside is where the eye already is. They still carry no changed mark — the section's count is
of preferences the SERVER holds, and a device-local slider in it would make the badge lie.

**AND THE OWNER'S OWN EXAMPLE, WHICH TURNED OUT NOT TO BE THE BUG THEY DESCRIBED.** Their
report: *"we have 3 posters for the poster size panel, when no mobile screen can hold three at
the lowest size even."* `CoverSpecimen` took `works.slice(0, 3)` — three cells, always, at up
to 240px each — directly underneath a comment promising **"AS MANY AS FIT, NEVER A SCROLL —
the pack's own note"**. A promise in a comment and a constant in the code, touching.

Measured, the third cover does not overflow: `.cover-specimen` wraps, so it drops to a second
line. That is worse than the failure the comment guarded against, not better — the specimen's
SHAPE changes as the reader drags, on the one control whose entire purpose is showing them a
shape. It is now measured from the element's own width, so the count answers the question the
browser just answered rather than a breakpoint that a card, a column or a font change would
falsify.

**THE MEASUREMENTS, BOTH WIDTHS, AFTER — AND BOTH OF THESE NUMBERS WERE LATER FOUND WRONG,
so they are struck here rather than left to be quoted.** The paragraph read: at 1280 the
column is 954px and draws three covers at 165 and three posters at 150; at 390 the column is
316px and draws one cover at 165 but two posters at 150.

The desktop figure was superseded by the layout correction in the next entry — the column is
457px, not 954px. The PHONE figure was never right at all. `useCoverSize` defaults to 100 on
a narrow screen and 165 otherwise; the probe that produced it ran the desk first, and the 165
it stored there came back through `localStorage` on the phone pass. **A reader arriving on a
phone gets 100px cells and sees TWO covers**, which is what
`sizing-a-cover-on-a-phone.journey.mjs` asserts. What survives from the paragraph is the part
that was measured rather than inferred: neither width scrolls sideways, and neither has an
element crossing the viewport.

**THE BUG IN THE FIX, CAUGHT BY MEASURING RATHER THAN BY READING.** The first version used a
`useRef` plus a `useEffect` with an empty dependency list. The shelf arrives over the network,
so the FIRST render has no works and returns `null` — by which time the effect has already
run, found the ref empty and attached nothing, and it never runs again. The measured room
stayed 0 for ever and the specimen drew one cover on a 954px desk. A callback ref fires when
the node itself appears, which is the question actually being asked. Reading the diff would
not have shown this; the probe did, in one line of output.

**THE ARITHMETIC IS ITS OWN FUNCTION** (`web/frontend/src/coverFit.js`) because it is
arithmetic: a width, a cell size and a gap in, a count out, checkable without mounting
anything. `test/pure/cover-fit.test.js` pins the owner's own numbers, the exact boundary
(two 150s fit 314 and not 313) and the floor of one for an unmeasured room.

**WHAT STAYS THE APP'S.** The up/down reorder arrows have no counterpart in the pack, which
draws the order rows as `sortable`. They answer a keyboard and a touch screen without a drag
gesture to discover, and the owner asked for one list rather than two; they stay.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/coverFit.js`,
`web/frontend/test/pure/cover-fit.test.js`, `web/frontend/test/dom/features-card.test.jsx`,
`internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
