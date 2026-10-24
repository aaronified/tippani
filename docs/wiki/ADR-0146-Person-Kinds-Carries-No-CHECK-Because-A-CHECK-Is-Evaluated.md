# ADR-0146: person kinds carries no CHECK, because a CHECK is evaluated against data already out in the world

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `person_kinds.kind` is a bare `TEXT NOT NULL`. Validation lives in `validPersonKind`, which gates every write.

**Why.** A CHECK added in a migration is evaluated against whatever is already in the column, so one unexpected value in one existing database turns the migration into a failure — and a failed migration means `Migrate()` returns an error and the app does not start. A constraint that can stop startup in order to reject a value the API already refuses to write is a bad trade. 0012 made the same call for the same reason, and 0004 had already dropped `annotations.source`'s CHECK when the source list grew. I approved keeping the invariant in Go where it can be changed without a schema rebuild.

<sub>`internal/store/migrations/0027_people_one_row.sql` · `internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
