# ADR-0044: Column order in base tables is append-only

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.2.0 (recorded), applies from 0001

**Decided.** `store.Recover()` copies base tables with `INSERT INTO main.t SELECT * FROM old.t`, which needs a freshly-migrated database's physical column order to match an upgraded one. So a new column goes on the end, and a table rebuild that reorders columns is a recovery bug that only appears the day recovery is needed. The rule is written into the migrations themselves — `0023` states it and `0026` restates it — rather than living only in the plan, because the person adding column twelve is reading a migration, not a design document. Mine, and one I would defend hard: the cost of the constraint is tidiness and the cost of breaking it is silent.

**Instead of.** Naming columns explicitly in `Recover`, which would decouple the two. That trades one silent failure for another: a copy that names columns by hand stops carrying the column added next release.

<sub>1.2.0 (recorded), applies from 0001 — `internal/store/repair.go` · `internal/store/migrations/0023_import_staging.sql` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
