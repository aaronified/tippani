# ADR-0441: Hover affordances do not exist on touch, which is the counterweight to every info-dot compaction

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.0

**Decided.** Two things had to be built before "move it into an info dot" was honest on a phone at all: the info dot had to work without hover, and the tooltip had to work without a pointer. Both were, and the second turned into a sweep — 69 controls that had only an `aria-label` or a native `title=` now say what they are.

**Why.** An info dot was a hover bubble, and there is no hover on a phone, which quietly made the whole decluttering strategy a non-answer on the device this app is built for. Moving prose behind an affordance nobody can reach is not compaction, it is deletion.

**Approved.** My call, and I approved building the two mechanisms *first* rather than shipping the compaction and fixing the affordances after — which was the tempting order, and would have left the phone worse for a release.

<sub>1.4.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
