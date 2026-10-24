# ADR-0130: People were keyed on (user id, kind, name), making a role part of identity

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** Migration 0012 created `people` with the role in the key, so a person existed once per job they did.

**Why.** Enrichment was layered over free text — `books.author`, `dialogues.actor`, `movies.director` are strings, and `people` was a side table of bios and portraits matched by exact name. Keying on the role made each console self-contained and the queries trivial. It was tolerable because the overlap between authors, actors and directors is genuinely small. I approved it on that basis, and the basis was a fact about my library rather than a fact about people.

**Reversal.** See below: it did not survive the fourth kind.

<sub>`internal/store/migrations/0012_people.sql` · `internal/store/migrations/0027_people_one_row.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
