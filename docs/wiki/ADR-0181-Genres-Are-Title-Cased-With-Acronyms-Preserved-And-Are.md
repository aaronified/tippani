# ADR-0181: Genres are Title-Cased with acronyms preserved, and are garbage-collected where tags are not

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/taxonomy_handlers.go`

**Decided.** `titleCaseGenre` normalises on write, leaving an all-caps token (YA, SFF) untouched. `gcGenres` deletes genres nothing references. Tags are never swept.

**Why.** Genres arrive from providers in whatever casing the provider used, so without normalisation one library ends up with "science fiction", "Science Fiction" and "SCIENCE FICTION" as three facets. Tags are the opposite: they are typed by a person and the casing *is* the person's, so they keep whatever you wrote. The sweep follows the same distinction — a genre is derived, so one nothing references is debris, while a tag is a managed vocabulary with a colour and a style you chose, and a tag dropping to zero uses is not a reason to throw away that choice. `cleanNames` already dedupes case-insensitively, so title-casing cannot introduce a new collision. My call, and the asymmetry is deliberate rather than an oversight in one of the two.

<sub>`internal/httpapi/taxonomy_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
