# ADR-0841: True glass, off by default, and the measurement that was weaker than promised

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `glassLens.js` builds a per-surface SVG displacement field and applies it as
a bare `url(#…)` `backdrop-filter`. It runs only when the reader turns it on, never when
`prefers-reduced-motion` is set, and never where the browser cannot composite a backdrop.
Its five dials — refraction, bevel, fringe, gain, blur — appear in the materials panel
only while it is on.

**Why it is opt-in.** The budget is this repository's own, in `ui.jsx`'s sheet-drag note:
ONE `blur(10px)` on the sheet scrim blew the frame budget on a phone, the browser
coalesced and dropped the pointer stream, and a drag stopped tracking the finger. The lens
is a graph of a dozen primitives per surface. The owner's answer when that was put to
them was "opt-in, off by default", and the five glass dials ship with it or not at all.

**THE MEASUREMENT, AND WHAT IT DOES NOT SHOW.** `scripts/screenshots/glass-cost.mjs`
scrolls a phone-width viewport for two seconds with the lens off and then on, against a
seeded library:

    panes marked          3
    filters built         2
    frames, lens off      122  (61.0/s)
    frames, lens on       121  (60.5/s)

**That is not a clean bill of health, and reporting it as one would be the dishonest
move.** The scroll is driven by `requestAnimationFrame`, so it cannot report a rate above
about 60/s — both columns are at the cap, which means the probe never saturated the
compositor and therefore cannot distinguish "costs nothing" from "costs something under
the cap". What it does establish is that the lens does not collapse the frame rate on
this hardware at this surface count, and that the surface count is THREE: the rail, the
mobile bar and the dock. The cost the original analysis feared was for a design where
every card is a pane.

**A GENUINE PHONE MEASUREMENT IS STILL OWED** before this is recommended rather than
merely offered, and the control's own hint says "off is the light choice" rather than
claiming a number nobody has taken.

**THE FIRST ATTEMPT AT THE FIELD WOULD HAVE BEEN FROSTING.** Blink drops any
`backdrop-filter` whose chain contains `feImage`, so a canvas normal map — the obvious
way — bends nothing while the blur in the same list still runs. The field is built
instead from primitives that survive inside a backdrop: the backdrop's own alpha,
blurred, then differenced between two offset copies, which is a signed ramp that is zero
through the middle and swings at each edge. Same reason the filter is a BARE `url()`:
Blink drops the reference when it sits in a list beside filter functions.

**AND THERE WERE NO GLASS SURFACES TO LENS.** `--surf-*` is written by `theme.js` and
consumed by nothing — its own note says the surfaces move onto it one at a time — so the
only `backdrop-filter`s in the app were scrims. The shell chrome now carries
`data-glass`, which is what gives the toggle something to act on. Moving the rest of the
app onto the composites is separate work.

**Approved** — the owner: "Opt-in, off by default", and the glass dials "should be built
along with the true glass toggle".

*Unreleased — `web/frontend/src/glassLens.js`, `web/frontend/src/theme.js`,
`web/frontend/src/App.jsx`, `web/frontend/test/dom/true-glass.test.jsx`,
`scripts/screenshots/glass-cost.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
