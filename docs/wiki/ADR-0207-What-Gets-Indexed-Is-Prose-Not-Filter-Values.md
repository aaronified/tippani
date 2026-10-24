# ADR-0207: What gets indexed is prose, not filter values

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** `utterances_fts` indexes `quote`, `note`, `speaker` and `occasion`. The occasion is in because it is the title this kind of quote has, and a title you cannot search for is the gap the whole feature would be judged on — "who said the thing about freedom", "that Burma broadcast". `place` and `medium` stay out. They are filter values, like a genre, not prose: indexing them would let a search for "radio" return every quote ever broadcast, ranked above the one that is actually *about* radios. I approved the line at exactly that boundary, and it is the line the facet plan (7.20) then builds on — filter values become facets, not index columns.

**Instead of.** Indexing everything on the row, which is the default instinct and produces exactly the ranking failure above.

<sub>1.5.0 — `internal/store/migrations/0026_utterances.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
