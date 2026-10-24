# ADR-0460: The Onboarding card lists nothing; a section picker replays one step, and the index comes from the unfiltered list

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.15.2

**Decided.** Settings → Onboarding is two buttons. **Replay the tour** (or Resume, or Start) starts at step 0 or at the parked step, and now wears a flag glyph with `keepLabel`, because that button carries the step count when it is a Resume. **Refresh one section** opens a picker of every named step, with its blurb, and choosing one starts the tour there.

**Why the list went.** The card had tried twice to be a table of contents. It began as a dozen two-line rows, which pushed the start button off a phone screen; the blurbs went behind info dots, which left a dozen names each trailing a dot. Either shape is a list you cannot press, sitting above the one button that does anything, answering "is this covered?" — and nobody opens Settings → Onboarding to ask that. They open it having forgotten how one screen works, and the old card had no answer for them short of sitting through the whole tour again.

**So the same list becomes the picker.** Same source — `tourFeatures`, so it still cannot drift from the tour it describes — and the blurbs come back as blurbs, because a dialog has the room the card did not. The difference is that a name now *does* something.

**`tourFeatures` carries `at`, and that is the load-bearing part.** The tour is started by index, and `tourFeatures` is `tourSteps` FILTERED: `welcome` and `done` have no name and drop out, and two more steps drop out for a non-admin. So the nth feature is not the nth step, and the gap widens down the list. The failure that would cause is the quiet kind — every index is a valid step, so a picker built on the filtered list opens a real screen with real copy, just not the one asked for, and nothing errors. `at` is taken before the filter and asserted against `tourSteps` at both admin levels.

**Instead of** a per-screen "show me this again" button on every screen. That is a control on twelve screens to serve a need that arises on one visit in fifty, and the tour already knows how to navigate itself.

**Approved.** The owner's: "Onboarding does not need the list of pages with infodots. all it needs is a replay button (already there, needs a glyph), and another button (with glyph) to open a popup where the user can specify the section for which they want the refresher."

<sub>1.15.2 — `web/frontend/src/Settings.jsx` · `web/frontend/src/tour.jsx` · `web/frontend/test/dom/onboarding-card.test.jsx` · `web/frontend/test/pure/tour-sections.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
