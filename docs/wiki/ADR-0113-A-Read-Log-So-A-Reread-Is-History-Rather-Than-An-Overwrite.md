# ADR-0113: A read log, so a reread is history rather than an overwrite

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** Finishing a work closes its read and starting again opens the next one, with a `work_reads` row per read; an abandoned attempt keeps its stop date but does not count as a read.

**Why.** Before this, a reread overwrote the read before it and 'how many times have I read this' was unanswerable. `progress` stays on the work rather than on the open read because it is 'where am I now', not history.

**Approved.** Mine, and I approved keeping `progress` on the work rather than moving it onto the open read — the split between "where am I now" and "what happened" is the whole shape of this table.

<sub>1.3.0 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
