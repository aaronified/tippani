# ADR-0201: Changing indexed columns means dropping and rebuilding the table

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 0.9.x (migration 0010)

**Decided.** `books.series` and `movies.series` were added in `0006` and never wired into the FTS tables, so a search for a franchise or reading-order name — "Malazan", "Middle-earth" — returned nothing. External-content FTS5 cannot `ALTER` in a new column, so `0010` drops the triggers and the virtual table, recreates it with the extra `series` column, re-points the triggers, and repopulates via `'rebuild'`. Dropping the virtual table drops its shadow tables too, and the rebuild re-derives the whole index from content, so no data is lost. NULL series columns index as empty. I signed this off once I had established that the rebuild is non-destructive; on a derived index it is the cheap operation, not the scary one.

**Instead of.** A second index alongside, or matching series through a denormalised text column as `genre_text` does. The second column would have been a fifth thing to keep in sync.

<sub>0.9.x (migration 0010) — `internal/store/migrations/0010_fts_series.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
