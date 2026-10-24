# ADR-0224: Filter sheets are rewired onto the facet state rather than replaced

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** The Library and Catalogue filter sheets keep their checkboxes, and setting one writes a chip. Sheet and bar become two editors of one state, so they cannot disagree. This is the largest single piece of work in the release and the only one that touches screens outside search, and it is worth it for one reason: with facets able to express everything a sheet can, leaving them separate would mean two ways to say *tagged stoicism* that do not know about each other. The nine `useState`s per board collapse into the facet state and `onReset` becomes clearing it. It gets its own commit, last, after the facets are proven — it is where a regression would actually land. I approved both the scope and the ordering.

**Instead of.** Deleting the sheets in favour of chips, or leaving them independent.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
