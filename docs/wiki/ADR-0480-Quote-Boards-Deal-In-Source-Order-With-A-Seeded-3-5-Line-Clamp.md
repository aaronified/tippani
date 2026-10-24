# ADR-0480: Quote boards deal in source order with a seeded 3–5 line clamp

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/Library.jsx` · `web/frontend/src/ui.jsx`

**Decided.** Quote boards pass `order="source"` — newest first, pinned prefix on top — and each card's clamp height comes from `clampSequence` seeded off the work's id, with no three adjacent cards the same.

**Why.** Height-packing a board of quotes bands it: all the long ones end up together and the board reads as two populations rather than one collection. Source order is also the order the reader expects — a quote added a minute ago should be where a quote added a minute ago goes. The variety then has to come from somewhere else, so it comes from the clamp: 3 to 5 lines, seeded off the book so a given book always lays out the same way across reloads, and the no-three-in-a-row rule reads along the same source order the board is laid out in. One seed drives both the masonry jitter and the clamp, so the two cannot drift. Approved by me; it is the opposite trade from the Catalogue and correct for the opposite reason.

<sub>`web/frontend/src/Library.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
