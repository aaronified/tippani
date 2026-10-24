# ADR-0147: The orphan sweep un-files a role instead of deleting a person, and its switch has no defaulting arm

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/people_handlers.go`

**Decided.** `gcOrphanPeople` deletes the `person_kinds` row for the swept kind and removes the person only once no role is left. `orphanRefQuery` returns `""` for an unrecognised kind and the sweep does nothing.

**Why.** Under 0027 deleting a person because their last book went would take a portrait and a bio the speaker side is still using — that is not a refinement, it is the difference between right and wrong under the new schema. The empty default is the whole reason the function was extracted: it used to be written inline as the `books.author` query with a switch overriding it for actor and director, which is correct for exactly three kinds and correct only for that reason. A fourth kind would have silently inherited the books query, and every person of it whose name was not also one of your book authors would have been deleted and their portrait unlinked — by a best-effort sweep that logs at Warn and still answers 200. Failing to sweep leaves clutter; sweeping wrongly loses a bio and a portrait. The keep-set also holds every credit's split components under both the user's separator config and the default one, so flipping that setting can never turn saved people into orphans. My decision, made after the fourth kind proved the shape of the hazard.

<sub>`internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
