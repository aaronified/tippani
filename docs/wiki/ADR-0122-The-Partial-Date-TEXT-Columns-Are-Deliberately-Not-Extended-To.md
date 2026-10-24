# ADR-0122: The partial-date TEXT columns are deliberately not extended to BCE, because a leading minus breaks lexical order

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** `work_reads.started_at` / `finished_at` (0024) and `utterances.occasion_date` (0026) stay CE-only. The timeline parses a leading '-' when reading them so nothing crashes, but it is not a supported input.

**Why.** Those columns are TEXT precisely so 'YYYY', 'YYYY-MM' and 'YYYY-MM-DD' compare against each other lexically, and a leading '-' breaks that outright: '-380' sorts before every CE date as a string, which is right by luck, but '-380' and '-63' compare in the wrong order because a shorter BCE year is a *later* one. And they record when you read something and when a speech was given — a rally, a broadcast, a letter — none of which is ancient.

**Instead of.** Extending the era everywhere for consistency — rejected; it would have bought symmetry and cost correct ordering on the columns that actually sort.

**Approved.** My call. Two date conventions in one schema is a wart, and I approved the wart over a sort that silently reverses.

<sub>1.7.4 — `internal/store/migrations/0030_ancient_years.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
