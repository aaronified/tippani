# ADR-0046: No convenience trigger on a table backing an external-content FTS index

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.1.1

**Decided.** When I found that `books.updated_at` and `movies.updated_at` were never written, my first attempt was a trigger — the robust-looking answer for tables written from a dozen places. It is not. Both tables carry FTS5 external-content sync triggers, and a trigger that updates the row it was fired by drives those out of step with the content table; SQLite reports it as `database disk image is malformed` on the next insert. I backed the triggers out and did the work at the call sites instead. The changelog says the thing I want the next person to read: worth knowing before anyone adds a convenience trigger to a table with an external-content index. My call, and the reversal is the useful part of it.

**Instead of.** The trigger, which is what I tried first.

**Reversal.** Yes: attempted with triggers, reverted, replaced by explicit writes (3.15).

<sub>1.1.1 — `internal/store/migrations/0026_utterances.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
