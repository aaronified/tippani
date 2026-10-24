# ADR-0840: Four dials per material, and the tier rule they are the exception to

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `PHYS` gives every tile four numbers — hardness, subsurface glow,
colour spread, reflection — which `lightLayers` compiles into gradient layers inside
`surfaceProps`. A reader edits them per tile behind a door on Settings → Theme, and the
edits are stored as one JSON object keyed by tile name.

**Why.** Until now every surface got the same treatment: a veil of its own colour with
the grain over it. Marble and wool differed by their photograph and by nothing else, and
they do not behave alike — stone returns the window in a small bright patch, wool
scatters it wide and dim, brushed steel smears it along the grain, paper glows faintly
from within. The pack's dials are what makes a material set a room rather than a set of
wallpapers.

**THE COST ARGUMENT IS THE WHOLE APPROVAL.** These were approved on the condition that
they cost nothing at runtime, which is true only because a dial compiles to a static
gradient stack once, at theme-apply time, and the compositor then draws what it always
drew. `material-physics.test.js` asserts exactly that: no `var()`, no `color-mix()`, one
blend mode per layer. A value deferred to paint time would be a different feature with
the same controls.

**PER TILE, NOT A GLOBAL MULTIPLIER.** The answer to "make my paper less shiny" is about
paper. A single global dial would make the other twenty-six materials wrong in order to
fix one, and a test holds the isolation.

**FIVE STOPS ON A SQUARED CURVE, AND THE COUNT IS ASSERTED.** A wide gradient with two
stops steps in 1/255 jumps a reader can see on a dark ground. Five puts the steps under
the tile's own noise — and counting them in the test is what keeps it true, because the
banding is invisible in a screenshot and obvious on a real screen.

**`flat` STAYS IDENTITY**, which the first draft broke: every dial at zero still emitted
a specular layer, so Atrium — the set whose whole point is costing nothing — gained a
composite the compositor had to draw. The operator already short-circuits `flat`; this
does too.

**THE FIVE GLASS DIALS ARE NOT HERE.** Clarity, refraction, bevel, fringe and gain only
mean anything with the lens, and the owner's ruling was that they ship with the
true-glass toggle or not at all.

**A DECLARED EXCEPTION TO THE TESTING RULE.** `material-physics.test.js` knows the
function, which the repo's tier rule allows only with a stated reason. The reason: what a
reader perceives is "the page looks softer", which no assertion can state — but that a
dial's number reaches the compiled stack, that an untouched tile gets the factory value,
and that editing one material leaves the others alone are facts about a function. The
browser tier covers what it can: that the door is reachable and names the materials the
chosen set is wearing.

**Approved** — the owner: "build it, minus the glass dials."

*Unreleased — `web/frontend/src/theme.js`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/pure/material-physics.test.js`,
`web/frontend/test/journeys/tuning-a-material.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
