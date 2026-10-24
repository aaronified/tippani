# ADR-0416: Home is one narrow reading column at every size, and capture is not on it

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.4.0, capture removed 0.9.1

**Decided.** Date and greeting, the Daily Quiz card, the Practice card, two stat tiles and the most recent favourites, in one narrow column on every screen size. Quote capture is not here; it is the Capture tab of the ＋ Add surface.

**Why.** The ritual should read the same on a phone and a desktop — a wide Home would be a different screen at the same URL. Capture left because it belongs to the one Add surface, not because Home had no room for it.

**Approved.** My call, and I approved the single column as a deliberate refusal of the space rather than an unfinished layout.

<sub>0.4.0, capture removed 0.9.1 — `web/frontend/src/Home.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
