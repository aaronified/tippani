# ADR-0042: Migrations are forward-only, append-only, and never edited afterwards

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** Files are `NNNN_description.sql`, embedded with `go:embed`, applied in lexical order, each in its own transaction, with the version row written inside that same transaction. A misnamed file is caught before anything is applied, because every version is parsed up front. The rule in `Developing.md` is one sentence and it is the important one: never edit a migration that has shipped — someone is already running it. I hold to this even when the fix would be trivial, and the one repair that genuinely could not be expressed as SQL (re-hashing dialogues that 1.3.0 wrote with a text-only dedupe hash) runs as an idempotent Go backfill from `Migrate` rather than as a rewritten migration.

**Instead of.** Down-migrations. Never built; a downgrade path implies a downgrade is supported, and it is not (3.11).

<sub>from 0.1.0 — `internal/store/migrate.go` · `Developing.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
