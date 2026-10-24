# ADR-0757: The panel header was handing the drag to the browser, and the probe could not see it

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Fixed.** The owner reported the phone sheet flaky on character and people panels
**three times**, with Details fine each time. Two fixes shipped before this one and
neither touched the cause, because the probe that blessed them
(`scripts/screenshots/sheet-drag.mjs`) opened the Details key and nothing else — the one
surface already called fine. That is the whole lesson here and it outranks the defect.

**WHAT IT WAS, and the owner named it before I did:** *"the tiny top bar works as well in
people popups. but the header behaves as if i am scrolling the content (does not scroll it
either). so header is basically trying to vertically scroll itself"*, then *"header should
not even have any scrollable part."*

**ONE DECLARATION, AND A CLAIM I WITHDREW.** The first version of this entry named two
causes and a rater took the first one apart; it is recorded here because the mistake is more
instructive than the fix.

**WHAT IS ACTUALLY WRONG: `overflow-x: auto` makes a box scroll on BOTH axes.** CSS computes
a `visible` axis to `auto` beside a scrolling partner, so `.name-scroll` — one line of
`nowrap` text — was a vertical scroll container everywhere it is used, and
`.tp-panel-crumb` had the same shape. The stylesheet already KNEW this fact and had dealt
with one half of it: a note on `.name-scroll` explains the computed `auto` and adds
`padding-block` to undo the clipping it causes. Nobody followed the same fact to the
panning. That is the owner's "header is basically trying to vertically scroll itself",
almost word for word.

**WHAT WAS NOT WRONG, though I asserted it in capitals in three places: `touch-action` on
the head not reaching its children.** Effective touch-action is the INTERSECTION of an
element and its ancestors, and `.tp-panel-head { touch-action: none }` has been in the
stylesheet since `f1bbf183` — whose subject is *"the header takes the whole gesture"* — so
descendants were already covered. `getComputedStyle` reports the value DECLARED on each
element, which is `auto` for anything that never set one, so my measurement of "every child
computed `auto`" could not distinguish "covered by the head" from "open to the browser". It
looked like evidence and was not. `touch-action` also does not apply to non-replaced inline
elements, which most of that head's children are, so the rule was doubly inert. A
`.tp-panel-head *` rule went in on that reasoning, and TWO GUARDS were written to require
it — which is the worse half: a false mechanism with tests holding it in place is harder to
remove than the rule alone. Rule and guards withdrawn.

**AND THE CRUMB WENT BACK.** I had truncated `.tp-panel-crumb` too, which made a THIRD
exception to "never truncate a name" — undocumented, unguarded, and against a rule whose two
existing exceptions are each named in `typescale-baseline.json` with the ruling that granted
them. It was also unnecessary: with the head claiming `none`, a sideways scroller in there
cannot be panned by a thumb. It scrolls again; only its unnamed vertical axis is gone.

**AND THE DECISION HAD ALREADY BEEN MADE AND NOT APPLIED.** The owner excepted this title
from the never-truncate rule on 7 September — *"the title doesn't need to scroll in the
header. it can be ellipsis-ed. not a problem"* — and `.tp-panel-title` has carried
`text-overflow: ellipsis` ever since. The ELEMENT stayed a `NameScroll`, whose
`overflow-x: auto` sits 48 lines further down the file and therefore won the axis. So the
ellipsis never applied, the header kept a scroller, and the note beside it recorded the
consequence in advance: a sideways scroller "is why the head could only claim
`touch-action: pan-x`", and `pan-x` leaves horizontal panning to the browser — "every real
thumb drag is slightly diagonal". The scoped title is a plain `h2` now, the crumb
ellipsises, and the head claims `none` for itself and everything in it.

**WHY THE UNSCOPED PANEL WAS ALWAYS FINE.** One branch below, a panel with no scope renders
`<h2 className="tp-panel-title">` — plain, never a scroller. That is the entire difference
between "totally fine, as before" and three reports.

**AND THE REAL LESSON IS THE PROBE, not the CSS.** `sheet-drag.mjs` took `--surface` with a
DEFAULT of `details`, so a bare run measured the one panel the owner had already called
fine — twice, under two "the drag is fixed" reports. It has no default now and refuses to
run without one, on `controls.mjs`'s precedent ("`--fixture` names the shelf, and
`controls.mjs` refuses to run without it"), and `run-sheet-drag.sh` runs all three surfaces
rather than one. The two panels have no URL — `routes.js` parses none — so the probe presses
a speaker chip and answers the chooser the way a reader does.

**A GESTURE TEST STILL CANNOT CATCH THIS.** The probe drags with Puppeteer's MOUSE and
`touch-action` governs TOUCH panning, so a header no finger could drag passes every gesture
case. What it reads instead is the head's own declared `touch-action` and the computed
`overflow-y` of everything in the head — a vertical scroller in there is the defect, a
horizontal one is not. `sheet-head-owns-the-drag.test.js` holds the declarations in CI, where
no browser runs at all.

**AND THE TITLE'S DEAD SCROLLER WENT WITH IT.** `ui.jsx` still ran
`useEdgeScroll(titleRef, { axis: 'x' })` on the UNSCOPED title under a comment saying "the
title is a name too ... so it gets the same treatment rather than an ellipsis" — the position
the 7 September ruling overturned. An edge fade over an `overflow: hidden` box promises more
text in a direction nothing can be dragged.

**Two things the probe found that are NOT this defect, reported rather than gated:** a sheet
whose content exceeds the first stop opens at its smallest anchor, so a pull down can only
dismiss it — which is what a bottom sheet does everywhere, and Details shares it; and a drag
begun 120ms after opening loses its transform mid-gesture. The second is real (the first
sampled frame carries `translateY(146px)` and a later one carries none) and is unexplained;
it fires on all three surfaces, and the owner has said loading is instant for them, so it is
not what they are reporting.

**Still unverified on the owner's phone**, which is the only place this defect has ever been
observed.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `scripts/screenshots/sheet-drag.mjs` · `web/frontend/test/rules/sheet-head-owns-the-drag.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
