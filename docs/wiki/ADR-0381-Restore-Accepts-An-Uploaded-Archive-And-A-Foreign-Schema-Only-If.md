# ADR-0381: Restore accepts an uploaded archive, and a foreign schema only if older

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 0.8.3

**Decided.** Restore previously only re-applied the single archive this server kept in `<data>/backups`, so a backup downloaded from a *different* Tippani box could not be restored — which is not what "restore" should mean, and makes moving to a new machine an SSH job. It now accepts an uploaded file through the same hardened pipeline, on both the admin route and the first-run onboarding route. A foreign archive is accepted only when its `schema_version` is not newer than this build's `MaxMigrationVersion`; older schemas migrate forward automatically. That gate is what makes another server's database safe to accept, and it is the same forward-only rule as 3.11 applied at a different boundary. I approved the upload path and the gate together.

**Instead of.** Refusing foreign archives entirely, which would have left "move to a new box" as a manual file copy.

**Reversal.** Yes, of the kept-archive-only restriction.

<sub>0.8.3 — `internal/httpapi/backup_handlers.go` · `internal/store/backup.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
