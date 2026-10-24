# ADR-0085: Ratings retired in two stages, with two dead columns deliberately left

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 0.4.3 and 0.8.5

**Decided.** 0.4.3 removed the 1–5 stars from the UI and left them stored. 0.8.5 removed them from every request and response, the `min_rating` list filter, the importers, the Markdown bindings and Stats, and migration 0018 dropped the `rating` column from `annotations` and `dialogues` by table rebuild, preserving tags, the repetition schedule and full-text search. `books.rating` and `movies.rating` stay as inert dead columns.

**Why.** The favourite ♥ is the one keep/love signal and two of them is one too many. The columns stayed on `books` and `movies` because those tables are foreign-key parents, and rebuilding them to drop a hidden column would risk the library — a dead column costs a few bytes and a comment; a bad rebuild costs everything under it.

**Approved.** Mine at both stages. I approved leaving the two columns rather than tidying them, and the schema comment says they are inert so nobody reads them as live.

<sub>0.4.3 and 0.8.5 — `CHANGELOG.md` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
