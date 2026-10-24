# ADR-0336: Imported dialogue anchors onto a pre-existing same-title film, and the anchor is previewed before approval

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** Imported film and show dialogue attaches to the best pre-existing same-title row rather than spawning a poster-less duplicate. `anchorScore` ranks candidates: an exact release-year match dominates, then a curated poster, then existing dialogues, then recency. The decision happens at approval, but is previewed on the staging reply and in the queue.

**Why.** A page's title rarely matches a curated title on the year alone — IMDb's release year and TMDB's often differ by one — so year-strict matching would create duplicates of things you already have. The preview exists because the library may have changed while the quotes waited, so "this will attach to your existing Casablanca (1942)" can be seen and corrected before anything is written, and an ambiguous match (more than one same-title film) is flagged as such.

**Instead of.** Matching on title and year together — rejected on the off-by-one.

**Approved.** I signed this off in response to a user request, and approved moving the resolution to approval time once staging existed, since the answer is only correct at the moment it is acted on.

<sub>1.2.0 — `internal/httpapi/import_movies.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
