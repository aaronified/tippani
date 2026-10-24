# ADR-0145: The lossy people merge has a written survivor rule

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/store/migrations/0027_people_one_row.sql`

**Decided.** Where one name existed under several kinds, the survivor is chosen by `ORDER BY (image_path <> '') DESC, (bio <> '') DESC, created_at ASC, id ASC` — portrait, then bio, then oldest, ties by id. The survivor keeps its id.

**Why.** The merge is lossy, so the choice cannot be "whichever SQLite happens to return first" — that is a different library on a different build. Prefer the row carrying the most; a hand-entered row usually predates an enrichment fetch, which is why oldest is the third key rather than the first. One consequence is stated in the migration rather than discovered later: if two merged rows each had a *different* portrait, the loser's file under `MediaCover` is left unreferenced and nothing routinely sweeps that directory, so it leaks a few kilobytes. Preferring the row with an image means the ordinary case — one enriched row, one bare one — loses nothing at all. My call, and writing the rule into the migration is the part that makes it a decision instead of an accident.

<sub>`internal/store/migrations/0027_people_one_row.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
