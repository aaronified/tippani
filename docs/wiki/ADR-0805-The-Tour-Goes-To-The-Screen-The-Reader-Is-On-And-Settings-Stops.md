# ADR-0805: The tour goes to the screen the reader is on, and Settings stops holding it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, in two messages: *"the help section shall have the onboarding journey for each
screen separately. a button in the help screen that will go you through the features in
that screen"*, and then *"no need for a global onboarding settings"*.

**The steps already knew which screen they were about.** Every entry in `TOUR_STEPS`
carries a `tab` — it is what navigates the shell when a step opens — so a per-screen tour
is a filter over the list that exists, not a second list. That matters more than the line
of code it saves: a separate per-screen list would be the place where the app's idea of
"what is on this screen" quietly stops matching the tour's.

**Help is the right home because it is where the reader already is.** The "?" is one press
from every screen and already names that screen. A reader confused by Metadata does not go
to Settings; they press the thing next to what is confusing them. And the button states the
count — *"Show me around this screen (3 steps)"* — because a walkthrough of unknown length
is a commitment people decline. At 3.0.3 the owner renamed it *"Tour this page (3 steps)"*
and kept the count; the Bengali became এই পাতাটা ঘুরে দেখুন, the app inviting the reader
rather than the reader asking the app (Bengali-style §5.4), and the tour's glyph became a
plane.

**A screen with no steps draws no button.** Quotes and Search have none. A control that
opens an empty tour is worse than an absent one: it gets pressed twice before it is
believed.

**A screen's walk does not decide whether the first-run tour has happened.** `finish` and
`later` write nothing in per-screen mode. `tourStep` is an index into the UNFILTERED list,
so postponing Help's third Settings step would have resumed the whole tour at whatever
step held that position — a resume point pointing at the wrong screen. `skip` still writes,
because "skip all" means the same wherever it is pressed, which is the owner's *"on any of
the onboarding screens the user can skip all"*.

**And the way back is the same slot.** *"if he has already skipped, on any one of them they
should be able to manually enable them as well."* Where `tour` is `skipped`, the control
that would say "skip tour" says "turn the tour back on" and writes the empty string — the
never-seen state the shell already auto-opens on, so this is the tour put back where it
started rather than a fourth value to teach anything about.

### What went with it

`OnboardingCard` is deleted rather than hidden, and so is `tourFeatures`, which existed
only to give that card each named step's INDEX into the unfiltered list. That index was
delicate enough to need a paragraph and a test — `welcome` and `done` have no name, so the
nth feature was never the nth step — and all of it was in service of starting the tour at a
chosen feature. Help starts a tour by SCREEN, so there is no index to get wrong and nothing
left to guard. `DevicesCard`, hidden in the same pass, is the contrast: unregistered and
kept whole, because that one is coming back.

<small>Unreleased — `web/frontend/src/tour.jsx`, `help.jsx`, `App.jsx`, `Settings.jsx`,
`ui.jsx`</small>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
