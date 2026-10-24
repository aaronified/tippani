# ADR-0109: Shelf status is drawn as a colour bar under the artwork, never a badge over it, and --accent is deliberately not the in-flight colour

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `StatusBar` is a 5px strip below the cover or poster, never overlapping it. In flight it is a progress bar filled to `progress` with the rest of the track a 22% wash of the same colour; every settled state is solid, because there is no partial "completed". Colours follow Radarr's convention — blue in flight, green done, red given up, amber held.

**Why.** The whole cover stays visible, so nothing is hidden behind a status. The unfilled track is the state's own colour at low opacity rather than neutral grey, so a barely-started book still reads as "reading" and not as an empty slot. `--accent` (terracotta) is deliberately not used for *reading*: it sits a few degrees from `--error`, and a bar you have to squint at to tell "reading" from "abandoned" is no bar at all.

**Instead of.** A badge over the artwork — rejected; it hides the thing the grid exists to show.

**Approved.** Mine, including the accent exclusion, which I approved specifically because using the brand colour there would have been the obvious choice and the wrong one.

<sub>1.3.0 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
