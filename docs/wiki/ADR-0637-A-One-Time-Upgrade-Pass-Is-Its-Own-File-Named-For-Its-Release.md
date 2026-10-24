# ADR-0637: A one-time upgrade pass is its own file, named for its release, and deleting it is the whole of retiring it

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** A change that must happen once on a database that already existed goes in `internal/store/onetime_<version>_<what>.go`, registers itself from `init()` into the registry in `onetime.go`, and is recorded in `one_time_passes` inside its own transaction. `Migrate()` names none of them.

**Why a third kind at all.** A numbered migration changes the schema and is forward-only. The two `Backfill*` repairs fix data SQLite cannot express and are deliberately unguarded so they re-run on every start and heal a row a later edit left stale. Neither covers "every instance upgrading to 2.2.0 needs telling that the default film source moved": running it twice would be wrong, and running it on a fresh install would state something untrue.

**The registry exists for the retirement, not for the running.** A pass is dead weight once no supported instance can still be behind it, and dead weight that cannot be removed cheaply is never removed. Had `Migrate()` called each pass by name, deleting a pass would mean editing the one file every other pass also depends on — so the cheap, safe act of deleting old code would carry a risk of breaking startup for everybody. Self-registration makes the deletion local.

**The version is in the FILENAME, not only in the struct**, so the retirement question is answerable from `ls`.

**A failure is logged and skipped, never returned.** This runs from `Migrate()`, where an error means the application does not start; `BackfillCastKeys` settled that argument already for a repair whose failure costs one row's autofill. The pass is left unrecorded, so the next start retries it.

**Recovery has to exclude the table**, which was found by three red tests rather than by reasoning: `Recover()` migrates the temp file before copying base tables into it, so that migrate records every pass and the copy then collides on the primary key. `one_time_passes` joins `schema_version` in the not-copied list. The cost is stated where the exclusion is: a pass that had not yet run on a corrupt database is marked applied without doing its work, while what a pass WRITES lands in an ordinary table and is copied normally.

<sub>2.2.0 — `internal/store/onetime.go` · `internal/store/onetime_2_2_0_tvdb_default.go` · `internal/store/repair.go` · `internal/store/migrate.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
