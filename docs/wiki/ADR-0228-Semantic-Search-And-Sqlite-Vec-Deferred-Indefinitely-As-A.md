# ADR-0228: Semantic search and sqlite-vec deferred indefinitely, as a decision

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** deferred from 0.1.0

**Decided.** PLAN §9 lists semantic search under *Deferred*, and §4 closes with the sentence I want kept: semantic search remains deferred — `sqlite-vec` later, if ever. That is recorded as a decision rather than left as an omission, because the two read identically from outside and only one of them is honest. The costs are a dependency, an indexing pass over every quote, and a model — on a box budgeted at 20–40 MB RSS and effectively zero idle CPU. I made this call and it is the one I am least likely to revisit; 7.25 exists precisely so that the question can be answered without it.

**Instead of.** Shipping it; not writing it down.

<sub>deferred from 0.1.0 — `docs/wiki/Design-decisions.md` · `docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
