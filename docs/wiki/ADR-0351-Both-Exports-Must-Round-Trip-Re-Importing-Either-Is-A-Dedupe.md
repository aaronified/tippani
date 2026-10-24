# ADR-0351: Both exports must round-trip: re-importing either is a dedupe no-op

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `internal/httpapi/export_test.go`

**Decided.** A stated property, asserted by tests: a library's own export, re-imported and approved, changes nothing. A book export is valid §5b(a) input; a catalogue export is read by the movie-markdown importer.

**Why.** An export that its own importer cannot read is a backup you find out is worthless at the worst moment, and one that duplicates on re-import is worse than one that fails, because it fails quietly. Making it a property rather than a habit is what catches the omissions — every field added to a work since has had to answer "does it survive the trip", and three of them did not. When import staging landed, the round-trip tests were kept asserting exactly what they asserted before, through an import-then-approve helper, rather than being relaxed to fit the new flow. Mine, and it is the single most useful invariant in the repository.

<sub>`docs/wiki/Design-decisions.md` · `internal/httpapi/export_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
