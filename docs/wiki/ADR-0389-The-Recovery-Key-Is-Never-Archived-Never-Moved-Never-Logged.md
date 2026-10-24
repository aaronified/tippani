# ADR-0389: The recovery key is never archived, never moved, never logged

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** `controlEntry()` lists `.recovery-key`, and that one line buys both halves of what it needs. `writeBackupArchive` skips control entries, so the key never travels inside the archive it opens — an archive carrying its own key is not an encrypted archive. `moveTopLevel` skips them too, so a restore swaps the whole data directory around it and the key survives. A factory reset deletes the database and leaves the key, which is deliberate: "I reset to clear a corrupt database, now let me restore last night's archive" is the scenario a recovery key exists for. It is never logged and never returned by any endpoint; the only thing the API says about it is a boolean — whether an archive can be recovered on this box. It is not itself encrypted, because anyone who can read it can read the database beside it, and the envelope exists to defend the archive once it *leaves*. I approved every one of those exclusions individually.

**Instead of.** Encrypting the key at rest, which protects nothing on this threat model and adds a second thing to lose.

<sub>1.4.2 — `internal/httpapi/backup_recovery.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
