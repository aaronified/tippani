# ADR-0069: A quote with no book and no film gets a third table

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** Migration 0026 adds `utterances` rather than making `annotations.book_id` nullable. The UI says "Quotes"; the table says `utterances` because `quote` is already taken by the shared shape, and a `quotes` table would read as the parent of the other two rather than a sibling.

**Why.** The nullable model is genuinely cheaper and I costed it before refusing it: every existing query joins `books` to scope by user, so parentless rows would be excluded automatically and roughly forty call sites would have kept working untouched. It was rejected because it makes `annotations` mean two different things, shares one id space between them, and freezes the busiest table in the schema behind a CHECK a future change can only alter with another full rebuild.

**Instead of.** The nullable `book_id` — cheaper, costed, rejected. The named cost of refusing it is written into the migration: ownership becomes explicit rather than inherited, "the single largest source of risk in the feature".

**Approved.** I took this call and approved it knowing which of the two was cheaper.

<sub>1.5.0 — `internal/store/migrations/0026_utterances.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
