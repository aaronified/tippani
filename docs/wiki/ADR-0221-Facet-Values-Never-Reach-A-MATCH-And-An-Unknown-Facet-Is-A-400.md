# ADR-0221: Facet values never reach a MATCH, and an unknown facet is a 400

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** The facets are ordinary SQL predicates on ordinary columns; only the free-text `q` reaches FTS, and it reaches it the way it does today (7.4). That keeps the escaping surface exactly one function wide. Separately, an unknown facet name is a 400 rather than a silent ignore, because a typo'd facet that is quietly dropped returns a *wider* result set that looks like a correct answer — the failure mode where the user cannot tell they were not answered. `fuzzyCorrect` keeps its zero-hit behaviour and corrects free text only: a facet value came from a list the user was shown, so correcting it would be second-guessing a choice rather than a typo. All three are mine, and all three are the same instinct — never widen silently.

**Instead of.** Ignoring unknown facets for forward compatibility.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
