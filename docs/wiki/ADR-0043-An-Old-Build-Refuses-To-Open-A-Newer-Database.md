# ADR-0043: An old build refuses to open a newer database

Source of truth: this wiki page.

- **Area:** [§3 The SQLite Contract: Durability, Locking, Migrations and Deletion](ADR-Index.md#area-3)
- **Status:** Accepted
- **Version:** 1.7.3

**Decided.** Because migrations are forward-only, an older binary's failure mode is not an error — it is a *success*. It looks for work, finds all of its own migrations applied, skips them, returns cleanly, and serves an app in which every table added since its release does not exist. No warning, no log line, nothing to search for. This happened: a stray `v1.3.0` tag went up alongside `v1.7.2`, both fired the image workflow, the older build finished about two minutes later and so claimed `:latest`, and a 1.3.0 container came up against a schema-0029 database reporting no quotes at all. Nothing was damaged, but establishing that took an audit of four migrations. `Migrate` now compares the recorded version against the highest it carries and stops with both numbers in the message. Stopping is the safe direction; starting is the direction with no way back. I approved this the same day, and asked for it to be mutation-tested before it was kept.

**Instead of.** Starting with a warning. Rejected: the warning is the thing nobody reads, and an empty screen is indistinguishable from data loss.

<sub>1.7.3 — `internal/store/migrate.go` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
