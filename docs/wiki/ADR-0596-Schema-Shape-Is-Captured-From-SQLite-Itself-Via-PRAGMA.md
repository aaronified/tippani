# ADR-0596: Schema shape is captured from SQLite itself, via PRAGMA

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.x

**Decided.** `TestSchemaShape` reads columns with types, nullability, defaults and primary-key position; CHECK expressions; indexes with their key columns; and foreign keys with their referential actions — all from `PRAGMA table_info` / `index_list` / `index_info` / `foreign_key_list` plus the `CREATE TABLE` text in `sqlite_master`, never from a hand-maintained mirror.

**Why.** Every other migration test in the package is behavioural: it INSERTs a row and checks whether a CHECK or a UNIQUE fires. That only ever catches the rules somebody remembered to write an INSERT for. A rebuild that quietly drops a column default, widens a CHECK by one value or forgets an index is invisible to it — the INSERT still succeeds, the test still passes, and the damage shows up months later as a column full of NULLs or a table scan on the review deck. Reading from SQLite means the capture cannot drift the way a duplicated schema constant would.

**Approved.** Mine, and I approved the PRAGMA source specifically over a checked-in expected schema.

<sub>1.7.x — `internal/store/schema_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
