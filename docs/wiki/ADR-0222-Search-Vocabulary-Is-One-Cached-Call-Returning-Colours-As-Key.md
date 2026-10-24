# ADR-0222: Search vocabulary is one cached call, returning colours as key and name

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** `GET /search/vocabulary` returns tags, genres, series, authors, speakers, actors, directors, colours and shelves in one call, fetched on first focus of the search box and held for the session. A personal library's vocabulary is small: this is one request, not one per keystroke, and the dropdown is instant with no flicker behind the typing. Narrowing is prefix-match first, then `editDistance` as a fallback, so an exact prefix never loses to a fuzzy match on a different word. Colours come back as **key and name** — `{"key":"blue","name":"doubt"}` — because 1.7.1 made them user-named: the chip must read `colour:doubt` and the query must send `blue`. A facet that showed the storage token would be showing the user something they deliberately renamed. Per-user isolation applies as everywhere: the vocabulary is `WHERE user_id = ?`, and a name that is not yours is not offered. I approved the whole endpoint, and the key/name pair is the part I would not let slide.

**Instead of.** A per-keystroke suggest endpoint, or returning colours as bare keys.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
