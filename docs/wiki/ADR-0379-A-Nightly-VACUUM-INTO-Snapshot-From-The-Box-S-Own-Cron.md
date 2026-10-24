# ADR-0379: A nightly VACUUM INTO snapshot from the box's own cron

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** from 0.1.0

**Decided.** The documented backup is `sqlite3 data/tippani.db "VACUUM INTO 'backup.db'"` from cron, off-peak — a short burst producing a transactionally consistent, compacted snapshot with no `-wal` or `-shm` sidecars, taken under one read transaction so concurrent writers are unaffected. The primary downside is stated rather than hidden: daily granularity. Litestream, which streams the WAL continuously and would give near-zero RPO, was rejected for constant background CPU on a box that cannot spare it. The in-app `POST /admin/backup` uses the same `VacuumInto` primitive. I approved the trade — a day of granularity against a permanent background process — and the README states it plainly rather than selling it.

**Instead of.** Litestream or an equivalent WAL-streaming daemon.

<sub>from 0.1.0 — `docs/wiki/Design-decisions.md` · `README.md` · `internal/store/backup.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
