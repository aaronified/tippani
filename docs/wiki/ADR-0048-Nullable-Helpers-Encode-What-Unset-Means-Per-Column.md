# ADR-0048: Nullable helpers encode what "unset" means per column

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** from 1.0.0, extended as columns were added

**Decided.** There is no single rule for what an absent value looks like, because `0`, `''` and `NULL` mean different things in different places. So there is a small family of helpers rather than one: `nullable` maps `""` to NULL so the partial unique indexes on `isbn`/`asin`/`tmdb_id` behave, since an absent value is not an identity; `nullableInt` maps `0` to NULL; `nullableCount` is its counterpart for columns where `0` is a value in its own right, as a dialogue's season is, so only a blank reads as unset; `nullableFloat` maps `0` to NULL for `series_index`, where "unset" and "position 0" are not meaningfully distinct in a reading order; `nullableInt64` covers the partial-unique id columns. I approved having five near-identical functions rather than one clever one, because the difference between them is the documentation.

**Instead of.** One generic helper plus a convention. Rejected: the convention is exactly what would drift.

<sub>from 1.0.0, extended as columns were added — `internal/httpapi/server.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
