# ADR-0226: What a board filter means to a search is decided before the filter ships

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.14.2

**Decided.** A board publishes its filters to the search box as a seed, so adding a filter is also a promise about what pressing Search will do. Every filter therefore has to answer that question before it ships, and there are three legitimate answers: seed it unchanged; drop it at the boundary (`BOARD_ONLY_FACETS`, for `tagged`, `noted` and `media`, which the server has no facet for); or change what the filter is built on so the two agree.

**Why.** The Catalogue's actor filter is what made the rule explicit. Two sources were available and they are not the same set — the cast a metadata fetch wrote, and the credits on the lines actually saved — and they diverge for exactly the films that have been fetched and not quoted, which in a library that imports covers before highlights is most of them. `actor:` in search reads the line credits. A board built on the cast would therefore have filtered to one set of films and seeded a search that answered with another: a filter whose meaning changes on the way to the search box, silently, and in the direction of *more* results, which reads as the search being broken rather than as the filter being wrong. So the board reads what the facet reads.

The third answer is the one worth naming, because it is the one nobody reaches for. `tagged` and `noted` are dropped because no honest mapping exists; the actor filter was not dropped — the filter was rebuilt so a mapping did.

**Instead of.** Sourcing the filter from `movies.cast_json`, which is richer, already fetched, and answers a different question.

<sub>1.14.2 — `internal/httpapi/movie_handlers.go` · `web/frontend/src/facets.js` · `web/frontend/src/Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
