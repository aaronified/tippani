# ADR-0904: Decisions are records, one page each, built from the log they came from

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

One long decision log grew to nine hundred entries in eighteen sections. It could not be linked into, an entry could not be
superseded without editing prose around it, and a reader looking for one decision read a section to find it. Each entry is now an
ADR page, split mechanically from the log, grouped in the [index](ADR-Index.md) by the log's own sections, with the log's numbers
kept as area numbers so every `Design-decisions.md §N` citation still resolves.

**Why this shape.** It is the layout the sibling project fluenough settled on: flat Title-Case wiki pages, `ADR-NNNN-*`, an index,
plans listed in their own index and folded into an ADR when built.

**Rejected.** Keeping the log and adding an index of anchors: it fixes the finding and not the editing. Renumbering by date: it
breaks every citation in code and pages.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
