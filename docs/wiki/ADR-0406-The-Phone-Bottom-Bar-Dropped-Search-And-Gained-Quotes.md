# ADR-0406: The phone bottom bar dropped Search and gained Quotes

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** Search left the four-icon bar; the Quotes tab took its place.

**Why.** The mobile top bar has carried ＋ · Search · ? · avatar since 1.4.1, so the bar held three content screens and a duplicate while the fourth content screen had nowhere to live. A control that exists in the shell on every screen does not need a second seat.

**Approved.** Mine, and I approved it as a consequence of 1.4.1 rather than a fresh judgement.

<sub>1.5.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
