# ADR-0047: A column that looks usable is worse than one that is absent

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.1.1

**Decided.** 1.1.0 added `books.updated_at` and `movies.updated_at` and backfilled them, on the reasoning that a client mirroring the library needs them and that adding a column later is more annoying. It did not *write* them: no INSERT set either, and none of the nineteen UPDATE sites across editing, metadata backfill, bulk edit and import bumped them. Every row created since 1.1.0 held NULL and no edit ever moved the value. That is worse than the column being absent, because the first delta-sync client to trust it would silently have missed every edit — an absent column fails loudly at compile or at parse. All twenty-four write sites now maintain it, and rows created since 1.1.0 were backfilled by migration 0022. I approved shipping the column early and I was wrong to; the principle it taught is the one I would keep.

**Instead of.** Dropping the column until a client needed it. In hindsight that was the right answer for 1.1.0.

**Reversal.** Yes, of my own 1.1.0 decision, one release later.

<sub>1.1.1 — `internal/store/migrations/0022_updated_at_backfill.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
