# ADR-0104: Collections shipped with no migration at all — the column had existed since 0006 and only the affordance was missing

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.0.1

**Decided.** Grouping the Catalogue by collection shipped in 1.0.1 with zero schema change.

**Why.** 0006 had added `series` to `movies` with its own comment calling it a "franchise / collection name", and `media_type` sits on the same row, so cross-type membership — Twin Peaks with Fire Walk With Me, Firefly with Serenity — needed nothing new. TMDB's `belongs_to_collection` was already filling the column on lookup. What was missing was the control: the Catalogue had no group-by, so you could filter to one collection but never see the structure.

**Approved.** I approved this one quickly, and it is worth logging precisely because it was cheap: the earlier decision to name the column generically is what made it cheap.

<sub>1.0.1 — `CHANGELOG.md` · `internal/store/migrations/0006_enrich_books_movies.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
