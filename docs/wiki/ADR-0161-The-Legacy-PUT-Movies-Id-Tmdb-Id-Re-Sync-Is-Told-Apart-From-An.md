# ADR-0161: The legacy PUT /movies/:id {tmdb id} re-sync is told apart from an id edit by the title

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/movie_handlers.go`

**Decided.** `PUT /movies/:id` re-syncs from a supplier when the body carries `source`+`source_id`, or when it carries `tmdb_id` **and no title**. Anything with a title is an ordinary save, where `tmdb_id`/`tvdb_id` are two more editable columns.

**Why.** A bare `{"tmdb_id": N}` was the re-sync verb before `source`/`source_id` existed, and external clients may still send it. Making the ids editable gave the same field a second meaning, and the two had to be separated without breaking the old one. The title does it exactly: a full-state save is refused without a title, so a body carrying `tmdb_id` and no title cannot be an edit — there is no ambiguous case to guess at, which is why this is a discriminator rather than a heuristic. `POST /movies` was deliberately left alone: a create with `tmdb_id` still means create-from-source whether or not a title rides along, because nothing asked for a manual add that carries an id and changing it would be a silent break for the sake of symmetry.

<sub>`internal/httpapi/movie_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
