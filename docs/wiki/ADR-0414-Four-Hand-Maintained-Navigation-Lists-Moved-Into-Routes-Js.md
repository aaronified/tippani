# ADR-0414: Four hand-maintained navigation lists moved into routes.js

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.5.1

**Decided.** The desktop strip's content and utility halves, the phone's bottom bar and the drawer now live in `routes.js` beside the routing table, and are asserted against each other: every content tab reachable from the drawer and the bottom bar, no tab named twice, content and utility disjoint, every nav tab surviving `statePath → parsePath`, and every collapsing row carrying a hover label of five words or fewer.

**Why.** 1.5.0 updated three of the four. On a phone the Quotes tab existed, routed, held data and sat in the bottom bar, while the drawer — whose whole job is to list everything — did not mention it. Invisible on a desktop, which is where the screen was built.

**Approved.** My call after the bug, and I approved the cross-assertions rather than only moving the lists together.

<sub>1.5.1 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
