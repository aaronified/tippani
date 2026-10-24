# ADR-0219: AND or OR is a property of the facet, not a global rule

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** A quote has one colour. `colour:doubt colour:joy` under an all-AND rule means "has two colours", which nothing does, so that query returns nothing forever and looks broken. Under per-facet rules it means "either", which is what you would say out loud. Meanwhile `tag:stoicism tag:death` *must* be an intersection, because narrowing by two tags is a real question in a quote library and OR would widen it. One rule cannot serve both, so the rule is a property of the facet: multi-valued facets (`tag`, `genre`) get one `EXISTS` per value, ANDed; single-valued ones (`colour`, `shelf`, `series`, `year`) get one `IN (…)`, OR within it. I approved the per-facet rule over a global one, and over exposing the choice to the user, which would be a toggle nobody wants to think about.

**Instead of.** A global AND/OR, or a user-facing switch.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
