# ADR-0209: Typo correction runs only on zero hits, over zero-storage vocab views

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.6.9

**Decided.** When the exact pass returns zero hits across every requested scope and the query is correctable — at least one token of 3 runes or more, at most 8 tokens, at most 64 runes — the handler harvests indexed terms from per-index `fts5vocab` views and corrects each token by bounded Levenshtein in Go, then re-runs the same `MATCH` once. Three properties I insisted on. It runs only on zero hits, so a search that worked is never second-guessed. The vocab views (migration `0016`) are zero-storage — they read each FTS index's own term dictionary, so there is nothing new that can corrupt, and `store.Recover()` skips them via the `%_fts_%` name pattern. And a vocab read that fails even after the one-shot index repair logs `TIP-SRCH-004` and degrades to the plain empty result: search never 500s because fuzzy broke. I approved it on that last condition specifically.

**Instead of.** A stored spelling dictionary, or correcting on every query. The first is a table that can corrupt; the second is a search that overrules you.

<sub>0.6.9 — `docs/wiki/Design-decisions.md` · `internal/httpapi/search_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
