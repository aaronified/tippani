# ADR-0203: Raw input never reaches an FTS5 MATCH, and LIKE '%…%' is banned

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** Parameter binding does not stop syntax interpretation. Input passed to `MATCH` is parsed as FTS5 *query syntax* even when bound — `AND`, `OR`, `NOT`, `NEAR`, `col:`, `-`, `*`, `^`, quotes — so malformed input errors and crafted input changes semantics. Every query goes through `search.Query` / `PrefixQuery`, which double-quotes each whitespace token (doubling embedded quotes) and joins with implicit AND. The package comment carries the rule at the top of the file so it is unmissable. The plan's other search rule is just as absolute and for a different reason: never use `LIKE '%…%'` anywhere, because a leading wildcard cannot use an index and turns a millisecond lookup into a table scan on a box that cannot spare the CPU. Both are mandatory, both are mine.

**Instead of.** Stripping operator characters rather than quoting tokens. Quoting preserves the user's words; stripping silently changes their query.

<sub>from 0.1.0 — `internal/search/fts.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
