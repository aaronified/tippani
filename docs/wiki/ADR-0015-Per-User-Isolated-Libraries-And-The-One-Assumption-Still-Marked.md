# ADR-0015: Per-user isolated libraries, and the one assumption still marked "confirm"

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `internal/store/migrations/0001_init.sql …`

**Decided.** Every book, annotation, tag, genre, quote and person row belongs to exactly one user. Nothing is shared, and there is no shared-library mode.

**Why.** Duplicate book rows across accounts cost kilobytes; the isolation is the strongest available and the queries are the simplest. What is worth recording is that this was never actually settled: §11 still grades it "Assumed — confirm", §12 still carries "Confirm the per-user-isolated library assumption" as open item 3, and thirty migrations (0001 through 0030) have been written on top of it without anyone going back. The honest reasoning is thin — nothing ever pushed back on it, so it hardened by default rather than by argument. I approved it at the start and I have re-approved it by silence ever since, which is the weaker of the two.

**Instead of.** A shared/household library, deferred in §9 and never picked up — it would change §3 materially.

<sub>`docs/wiki/Design-decisions.md` · `internal/store/migrations/0001_init.sql …`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
