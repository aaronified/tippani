# ADR-0871: Sections, third pass: a stored size that disagreed with its own handle

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**CARRYING THE PACK'S `step: 5` CREATED A DEFECT NOBODY HAD LOOKED FOR, AND A RATING ASKED
THE QUESTION THAT FOUND IT.** Sizes have been saved since long before the slider had a step,
so a browser holding 123 is ordinary. A range with `min=95 step=5` SNAPS that to 125 in the
DOM and fires no event — so the handle sat on 125 while React's state, the "123px" readout
beside it and the two grids reading the same key all still said 123. Three places disagreeing
with the control, with no press to blame it on, and nothing in the change or its documents
mentioned it because the question "what happens to a reader already off the new ladder" was
never asked.

`useCoverSize` puts a stored size on the ladder on the way in. Such a reader moves by at most
two pixels, once, and what is stored, what is drawn and where the handle sits are one number
from the first paint.

**AND THE TEST FOR IT IS IN TWO TIERS, FOR A REASON THIS PASS HAD ALREADY BEEN CAUGHT BY.**
`coverSizeOnLadder` is arithmetic and has pure cases. Removing the call to it from the hook
leaves every one of them green — which is exactly the shape of the gap found one pass earlier,
where the gap read was untested by the suite written for it. So a dom case renders the screen
with 123 in storage and reads the number off it. Pinning a function and pinning that anything
CALLS it are two different tests, and the first is worthless alone.

**THREE PIECES OF PROSE WERE WRONG AND ARE CORRECTED IN PLACE.** The entry two above still
gave the phone as one cover at 165 — the measurement that came from probe ordering — and the
entry above it still said "the desk now draws two and the phone one". Both are corrected
where they stand rather than contradicted from further down the file, because a reader
looking up this decision finds the first copy. The new journey's own title said "one sample
cover" while its body asserted two, so a failing run would have printed a sentence that was
not true. And `cover-specimen-fits.test.jsx` still opened with the refuted claim that a
journey cannot see this: the wiki was corrected on that point in the previous commit and the
test header was not.

**THE TWO SIZE SLIDERS' LABELS ARE NAMED FOR THE SCREEN THEY ARE ON.** They were
`settings.appearance.book-size.label` and `…film-size.label`, from when the sliders lived on
Appearance; they are `settings.features.*` now. No reader sees the difference — the keys
resolve to the same words, and the words are the ranges' accessible names — but a key that
names the wrong screen is how the next person looking for this control fails to find it.

*Unreleased — `web/frontend/src/ui.jsx`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/pure/cover-fit.test.js`,
`web/frontend/test/dom/cover-specimen-fits.test.jsx`,
`web/frontend/test/journeys/sizing-a-cover-on-a-phone.journey.mjs`,
`internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
