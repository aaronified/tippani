# ADR-0108: Dialogue order is season, then episode, then clock, then id — one definition shared by the list and the export

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `dialogueOrder(p)` returns a single `ORDER BY` fragment, used by the list query and by the Markdown export, with NULLs last within each group.

**Why.** A file should read in the order the screen shows. One definition, taking the table alias as an argument, is what makes that true by construction rather than by two people remembering. A film's season and episode are always NULL, so it collapses to the timestamp order dialogues have always had; an un-episoded show line falls to the end of its group rather than the front, while season 0 sorts first, which is where specials belong.

**Approved.** My call. Sharing the fragment rather than the query is the smallest thing that stops the two from drifting, and I approved it on that basis.

<sub>1.3.0 — `internal/httpapi/dialogue_handlers.go` · `internal/httpapi/export_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
