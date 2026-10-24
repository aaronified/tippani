# ADR-0218: Search facet grammar lives entirely on the client; the wire format stays typed

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** `field:value` is a typing affordance that lifts a token into a chip; the client sends structured parameters (`?q=…&tag=stoicism&tag=death&colour=doubt`). The server never parses the syntax. A grammar the client parses for chips and the server re-parses for SQL is a grammar that drifts, and the drift shows up as a query that renders one way and matches another. Keeping it client-side means a malformed facet is impossible to send rather than merely rejected, and it makes the URL the honest record — every chip is a query parameter, so a search is bookmarkable, shareable, and reusable by a saved view. My call, and I stand by it.

**Instead of.** A shared query grammar parsed on both sides; rejected on the named drift risk.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
