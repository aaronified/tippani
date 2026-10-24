# ADR-0536: Home's favourites reorder once per visit, not once per reload

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.11.1

**Decided.** One seed drawn when Home mounts, spent through `shuffleSeeded`, which ranks each favourite from that seed and its OWN KEY rather than by walking the list. The clamp heights are seeded off the same draw.

**Why.** The wall reordering is deliberate — it is a re-surfacing wall, not a feed — but it reordered on every LOAD, and every in-place edit reloads it. Recolouring one quote redealt the whole wall: the four tiles on screen became four different tiles and the card just acted on was gone, which reads as the app losing the change rather than saving it.

A per-item rank rather than Fisher–Yates because that is the property that survives the list changing: drop one member from a walk-the-list shuffle and the permutation is entirely different, so un-hearting one tile would still redeal everything. Ranked independently, a removed card leaves a gap and everything else stays where the reader last saw it.

**Instead of.** Shuffling once and caching the array (moves the problem to the next remount, and cannot place a newly-hearted quote). Not shuffling at all (loses the feature).

**Approved.** Mine, on the reader's report.

<sub>1.11.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/Home.jsx` · `web/frontend/test/pure/seeded-shuffle.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
