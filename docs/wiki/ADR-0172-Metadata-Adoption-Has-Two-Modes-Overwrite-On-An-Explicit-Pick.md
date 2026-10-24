# ADR-0172: Metadata adoption has two modes: overwrite on an explicit pick, fill-empty-only on a one-click fetch

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/metadata_handlers.go` · `web/frontend/src/WorkDetails.jsx`

**Decided.** Picking a candidate and ticking fields overwrites those fields. The bulk refetch backfills empty author, description, year, genres and art and never overwrites anything.

**Why.** The mode follows the intent, and the intent is legible from which control you used. Choosing an edition from a list is a statement that this record is the right one, so honouring it means overwriting. Pressing a button that says it will fill in what is missing is not a statement about any particular field, so it must not touch one that is already filled. A title-only book skips the metadata backfill entirely in that path — a bare title match is too loose to trust — while still trying a candidate cover. Mine, and stating it as two named modes rather than one fuzzy policy is what stops the next endpoint picking a third.

<sub>`internal/httpapi/metadata_handlers.go` · `web/frontend/src/WorkDetails.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
