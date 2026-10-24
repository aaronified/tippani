# ADR-0387: v1 archives are refused by version, not read

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** The v1 reader was deleted rather than kept. v1 shipped for about an hour and no archive of it exists outside this repository's tests, and keeping a reader would mean keeping the ambiguous `<username>#<password>` secret alive in the codebase — one of the two things v2 exists to remove. So a v1 header is recognised and refused *by name*, which is a clear message rather than a corruption error. Note the asymmetry I did keep: pre-1.4.1 plain gzip archives still restore, because an operator who dropped one into `<data>/backups` for the first-run path must not be stranded by a server upgrade. Refusing v1 while accepting plaintext looks inconsistent until you notice that only one of them requires living code that knows a bad secret. I approved that asymmetry deliberately.

**Instead of.** Keeping a read-only v1 path "just in case".

<sub>1.4.2 — `internal/httpapi/backup_crypto.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
