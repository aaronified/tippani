# ADR-0210: The last token is corrected in prefix mode with no upper length bound

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.6.9

**Decided.** `Window` returns the indexed-term length range worth harvesting, and for the final token — when `lastIsPrefix` — it returns `hi == 0`, the no-upper-bound sentinel. This is a typeahead box, so the last token is a word still being typed, and it is scored in prefix-distance mode: "shawsq" has to reach "shawshank". Capping the harvest length would silently drop exactly those targets, which is the correction most worth making. The lower bound still holds, because matching a much shorter term needs deletions beyond the budget, and the handler pairs `hi == 0` with a popularity `LIMIT` so an unbounded length range cannot harvest the entire vocabulary. I approved the asymmetry — bounded below, unbounded above — once the `LIMIT` was in place to pay for it.

**Instead of.** A generous fixed cap, which is the same bug with a longer fuse.

<sub>0.6.9 — `internal/search/correct.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
