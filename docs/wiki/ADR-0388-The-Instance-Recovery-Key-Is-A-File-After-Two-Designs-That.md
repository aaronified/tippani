# ADR-0388: The instance recovery key is a file, after two designs that destroyed it

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** 32 random bytes in `<DataDir>/.recovery-key`, written 0600 via temp file and rename so a crash mid-write cannot leave a half-written key that would seal an unopenable archive, and never rotated, because rotating would orphan every archive already sealed under the old bytes. Two earlier designs were wrong in the same instructive way. A `users.recovery_wrap` column: a restore replaces the users table wholesale, so restoring *any* archive — or a factory reset, or deleting the account — silently destroyed the key, with the only surviving copy in `.pre-restore-<ts>`, which the next restore deletes. Two of the most ordinary operations there are, in order, and no error at any point. Wrapping it under a password: re-wrapping needs both plaintexts, which the HTTP password-change handler has and `tippani user passwd` — the only forgot-my-password route on a self-hosted box — does not, so the documented recovery path destroyed the recovery key at exactly the moment it was needed. I approved both designs before review killed them, and this entry exists because both were plausible.

**Instead of.** The two above.

**Reversal.** Twice, before shipping.

<sub>1.4.2 — `internal/httpapi/backup_recovery.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
