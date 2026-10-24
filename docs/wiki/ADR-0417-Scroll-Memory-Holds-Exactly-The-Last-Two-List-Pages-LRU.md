# ADR-0417: Scroll memory holds exactly the last two list pages, LRU

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.6.8

**Decided.** Opening a detail or hopping tabs and coming back restores the list's scroll position. The memory holds the last two list pages, LRU; everything else starts fresh at the top.

**Why.** Two is what the actual gesture needs — you leave a list, look at one thing, come back. An unbounded memory restores a position from a session you no longer remember having, which reads as the page being broken.

**Approved.** Mine, and I approved the specific number rather than "keep them all".

<sub>0.6.8 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
