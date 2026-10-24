# ADR-0103: TV shows are movie rows with a media type flag, not a third medium duplicating the whole stack

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** pre-1.0

**Decided.** Migration 0006 folded shows into `movies` with `media_type TEXT NOT NULL DEFAULT 'movie'` ('movie' | 'show'), plus a `tvdb_id` for the second supplier with its own partial unique index mirroring `tmdb_id`.

**Why.** A show and a film differ in their locator and their metadata source, not in their shape — both have a title, a year, a poster, credits, a collection and quoted lines. A third table would have duplicated the whole catalogue stack, and every join, filter, sort and export with it. `media_type` is validated in app code rather than by a CHECK, because 0004 had already established that SQLite cannot evolve one and open-ended vocabularies therefore live in the app layer.

**Instead of.** A separate `shows` table — rejected as duplication.

**Approved.** Mine, and it has paid for itself repeatedly: a collection can hold a film and a show together because they are rows in one table, which needed no schema change at all.

<sub>pre-1.0 — `internal/store/migrations/0006_enrich_books_movies.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
