# ADR-0861: Photographing every surface, and the picture that lied

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**`capture.mjs` PHOTOGRAPHS ADDRESSES, AND THESE TWO SCREENS ARE NOT ADDRESSES ANY MORE.**
They are twelve sections behind a rail, and almost everything a reader operates on them opens
OVER the section. A run of the old harness shows two of the twelve and none of the overlays,
which is how a screen gets reported by the owner from their own phone and does not reproduce
here. `surfaces.mjs` presses through all of them at 390 and 1280 — 44 captures — and it
FAILS LOUDLY: every step either captures what it was sent for or records a miss with the
reason and the list of what was actually on the screen, and the run exits non-zero. A
capture set with a hole in it is worse than none, because the hole is invisible in a
directory of PNGs.

**THAT LOUDNESS IMMEDIATELY EARNED ITSELF.** Half the first door list was written from the
design pack and named controls that do not exist under those words — "Interface language" is
drawn as "Choose a language", "What changed" as "Changelog" — and the run printed the real
names beside each miss. Two of the pack's doors are genuinely not built and are not listed.

**AND ONE CAPTURE LIED OUTRIGHT.** `fullPage: true` expands the shot to the DOCUMENT'S
scroll extent, and this app has one sanctioned horizontal scroller whose inner width a long
title runs out to — so the works console came back as a 1235px image at a 390px viewport, a
phone screen apparently three times too wide, with the dock and the card below it stretched
across it. The page it was taken of measures 390 wide with nothing past the edge. An hour
went on that picture before anything measured it. The shots are viewport shots now, on a tall
viewport, and every one records whether the page it shows actually overflowed — because a
picture cannot be asked that.

**THE MEASUREMENT THEN FOUND THE REAL ONE.** At 1280 the Metadata screen reports 1479 in
1280: a desktop page you can scroll off the side of. `.ann-table-wrap` was written when these
consoles were TABLES — a table is as wide as its columns and horizontal scroll was the honest
answer. They are lists of record rows now, and a record row's name scrolls inside its own box,
so `axis="both"` let one seventeen-word public-domain title set the content width and, with
nothing capping the wrap, push the whole page out. `min-width: 0` is the other half: a flex
child defaults to its content's minimum, so the cap has to be stated or the row refuses it.

**A RATCHET DEMANDED THE DUPLICATION ITS OWN SIBLING FORBIDS.** `harness-archive.test.js`
required every runner to ask for the archive BEFORE it boots, and found the boot with
`findIndex` — which answers -1 for a runner that boots nothing, read as "position -1". So a
runner that delegates booting to `run-with-server.sh`, the only place in that directory the
scratch server is started correctly, failed with "expected 9 to be less than -1". A runner
that boots nothing cannot boot too early.

*Unreleased — `web/frontend/src/MetadataPage.jsx`, `web/frontend/src/Settings.jsx`,
`web/frontend/src/MetadataSources.jsx`, `scripts/screenshots/surfaces.mjs`,
`scripts/screenshots/run-surfaces.sh`, `scripts/screenshots/run-with-server.sh`,
`web/frontend/test/rules/harness-archive.test.js`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
