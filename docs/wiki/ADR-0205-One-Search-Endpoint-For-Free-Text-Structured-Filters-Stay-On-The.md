# ADR-0205: One /search endpoint for free text; structured filters stay on the lists

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** `GET /search?q=&scope=&limit=` handles free text. Structured filters — tag, colour, `book_id`, `movie_id` — live on `GET /annotations` and `GET /dialogues`, where the UI actually uses them, and are deliberately not duplicated onto `/search`. Two implementations of "quotes tagged grief" is two places to fix a bug and two places for the answers to disagree. Every query is scoped to the session user without exception. My call, taken at plan time under a KISS argument, and the facet work in 7.20 is careful not to break it: facets narrow the free-text search, they do not become a second list API.

**Instead of.** One universal query endpoint doing both.

<sub>from 0.1.0 — `docs/wiki/Design-decisions.md` · `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
