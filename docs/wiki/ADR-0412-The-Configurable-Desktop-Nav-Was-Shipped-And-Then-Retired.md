# ADR-0412: The configurable desktop nav was shipped and then retired

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** Added 0.4.3, retired 0.6.7

**Decided.** 0.4.3 added a Settings › Interface toggle putting Tags and Metadata either on the navbar or behind a ⋯ More menu, stored as `navUtilities`. 0.6.7 retired the toggle and the preference: those two always sit in the top bar's utility group, and the mobile drawer moved Tags into its bottom utility group to match.

**Why.** Two supported layouts is two layouts to test, to explain in the help registry, and to keep the collapse measurement honest against. The value it bought was one row of horizontal space on a narrow desktop, which the overflow collapse now handles by itself.

**Reversal.** Of my own setting. What I got wrong is that "make it configurable" was a way of not deciding.

**Approved.** Mine both times, and I approved the removal as a simplification rather than a regression.

<sub>Added 0.4.3, retired 0.6.7 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
