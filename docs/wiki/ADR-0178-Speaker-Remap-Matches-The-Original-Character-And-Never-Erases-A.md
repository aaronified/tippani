# ADR-0178: Speaker remap matches the original character and never erases a speaker

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/metadata_library.go`

**Decided.** `POST /movies/{id}/remap-speakers` reads every dialogue's character once up front and matches against that. `from` matches exactly, not case-folded. Mappings whose target character is empty are skipped.

**Why.** Reading the originals first is what stops chained renames cascading: with A→B and B→C in one request, matching against live values would carry A all the way to C. Exact matching on `from` is right because it is a stored label the UI handed back, and case-folding would collapse "Evey" and "EVEY" into one bucket with last-write-wins. Skipping an empty target is the important one: remap renames a speaker, and letting it blank one would be silent, unrecoverable data loss from a bulk operation. Mappings are capped at 500 and each field at 128 characters. My call.

<sub>`internal/httpapi/metadata_library.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
