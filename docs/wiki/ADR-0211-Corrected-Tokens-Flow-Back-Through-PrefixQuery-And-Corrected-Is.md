# ADR-0211: Corrected tokens flow back through PrefixQuery, and corrected is scoped

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.6.9

**Decided.** Two invariants, both about not leaking. Corrected tokens are re-escaped through `PrefixQuery` on the way back, so the raw-input-never-reaches-`MATCH` rule of 7.4 survives the fuzzy path — there is a test whose only job is that (`TestCorrectOutputIsMatchSafe`). And although the vocabulary is index-wide rather than user-scoped, the re-run stays `user_id`-filtered and the response's `corrected` field is set **only** when this user actually received rows. Without that, "did you mean *Bhagavad*?" would report the existence of another user's book. I approved the index-wide harvest on the condition of the scoped report; the two are not separable.

**Instead of.** Per-user vocab views, which fts5vocab cannot express, or filtering the harvest in Go, which would mean reading every user's terms anyway.

<sub>0.6.9 — `internal/search/correct.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
