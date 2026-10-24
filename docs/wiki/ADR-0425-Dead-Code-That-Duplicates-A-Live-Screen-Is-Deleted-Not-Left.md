# ADR-0425: Dead code that duplicates a live screen is deleted, not left

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.7.2, and 1.4.1 before it

**Decided.** `Settings.jsx` carried an unused second users list, with the same add and the same delete and none of the rules; it went. So did the avatar upload control the retired chip menu used and the `.user-menu-panel` rules positioning it.

**Why.** Dead code that duplicates a live screen reads as the implementation. The next person to change the rules — or the next model asked to — finds two candidates and no way to tell which one ships.

**Approved.** Mine, and I approved deletion as the standing answer rather than a comment marking it dead.

<sub>1.7.2, and 1.4.1 before it — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
