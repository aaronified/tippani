# ADR-0206: Results are sectioned by what matched, with a cross-column fallback

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.9.1

**Decided.** A query that hits an author name lands in *Authors* — the name, heading their books — not as bare book rows; a note match lands in *Notes*, not *Annotations*. The sections are Books, Annotations, Movies, Dialogues, Quotes, Authors, Directors, Actors, Speakers, Notes, Tags and Genres, each independent, and the client renders only the non-empty ones. Sectioning by column has one failure mode, and I did not want to discover it in use: a query whose tokens span two columns matches nothing in either. So `runMixedPass` re-runs the unrestricted queries — implicit AND across all indexed columns of a row, the pre-facet behaviour — when no single facet matched, and "casab mich" still finds *Casablanca* by Curtiz. I approved the fallback in the same release as the sectioning, because sectioning without it is a regression.

**Instead of.** Always running both passes and merging, which costs a second query on every search for a case that is rare.

<sub>0.9.1 — `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
