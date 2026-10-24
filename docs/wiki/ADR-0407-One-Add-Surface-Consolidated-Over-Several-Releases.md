# ADR-0407: One "＋ Add" surface, consolidated over several releases

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 0.4.3 through 0.9.3

**Decided.** 0.4.3 made a single Add surface — book · film · import in one modal — replacing the standalone Import tab, and every entry point was folded into it afterwards: the mobile top-bar ＋ (0.6.8), a Capture quote segment (0.8.7), Capture becoming a tab that swaps in place with the Home capture tile removed (0.9.1), and the drawer's Capture row retired (0.9.3).

**Why.** One obvious way to add anything. An old `/import` link opens the same surface on the Import section rather than a second screen.

**Reversal.** 0.9.1 re-fragmented it while consolidating it: a ❝ capture pill was added beside ＋ Add in both top bars. 0.9.2 removed it one release later — it duplicated the Add surface's own Capture tab, which is the exact thing the consolidation existed to stop.

**Approved.** Mine throughout, including the pill I added and then took back out.

<sub>0.4.3 through 0.9.3 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
