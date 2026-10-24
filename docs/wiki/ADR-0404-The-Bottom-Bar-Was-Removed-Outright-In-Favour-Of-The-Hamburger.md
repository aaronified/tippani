# ADR-0404: The bottom bar was removed outright in favour of the hamburger drawer

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.4.0

**Decided.** 0.4.0 moved primary navigation from the bottom tab bar into a ☰ drawer carrying nav, counts, account and log out, with a slim sticky top bar. The Settings "Start page" toggle was retired at the same time.

**Why.** Five tabs would not fit a 320px viewport, and the drawer holds an unbounded list. The start-page setting went because Home became the landing view and the drawer made every destination one gesture away.

**Reversal.** Partly wrong. Removing the bar took the four screens people actually use out of thumb reach to solve a problem only the fifth tab had.

**Approved.** Mine at the time.

<sub>0.4.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
