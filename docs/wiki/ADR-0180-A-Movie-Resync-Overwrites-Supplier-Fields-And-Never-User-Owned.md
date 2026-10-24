# ADR-0180: A movie resync overwrites supplier fields and never user-owned ones

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/movie_handlers.go`

**Decided.** `resyncMovieFromSource` re-pulls details and credits and overwrites title, director, year, description, cast, genres, series, poster, the source ids and `media_type`. `favorite`, `watching` and `series_index` are left alone.

**Why.** The split is not "old versus new", it is "who owns this fact". A title and a cast list are the supplier's answer and re-syncing is asking for it again. A favourite, a shelf state and your position in a collection are yours and the supplier has no opinion about them — overwriting those would be the app editing your library to match a provider. Mine, and the rule generalises: every place metadata lands, the question is ownership rather than freshness.

<sub>`internal/httpapi/movie_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
