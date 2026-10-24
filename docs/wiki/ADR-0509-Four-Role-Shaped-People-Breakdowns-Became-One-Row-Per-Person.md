# ADR-0509: Four role-shaped people breakdowns became one row per person

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `internal/store/migrations/0027_people_one_row.sql`

**Decided.** Authors, directors, actors and speakers as four separate breakdowns became a single **People** breakdown, one row per person whatever the role.

**Why.** The breakdowns asked "who" four times and got four half-answers. Somebody with books here and films here was two rows in two sections, each carrying part of their work, and no section could answer "who do I actually quote". Migration 0027 had already stopped keeping a person once per job — this is the UI catching up to storage that had been right for several releases, which is its own small lesson about how long a schema change takes to reach the screen. Mine.

<sub>`internal/store/migrations/0027_people_one_row.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
