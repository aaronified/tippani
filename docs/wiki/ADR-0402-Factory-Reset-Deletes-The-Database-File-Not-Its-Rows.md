# ADR-0402: Factory reset deletes the database file, not its rows

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 0.4.6

**Decided.** `Reset` closes the handle, removes `-wal`, `-shm` and then the main file, reopens and re-migrates an empty schema. Deletion is by *file* and not row by row, for a specific reason: a corrupt FTS index can block `DELETE` and `DROP`, because the sync triggers touch the bad index — and the whole point of a factory reset is a guaranteed-clean slate for someone whose database is already broken. A reset that can fail because the thing you are resetting is damaged is not a reset. `removeWithRetry` tolerates Windows briefly holding the handle after `Close`, and a failure to delete reopens the existing database so the server is not left handle-less. Everything goes — users, sessions, settings, preferences, all library content — so the app returns to first-run onboarding, and the warning says so. I approved the file-level deletion on the corrupt-index argument.

**Instead of.** `DELETE FROM` per table, which is the tidy answer and fails in exactly the case that matters.

<sub>0.4.6 — `internal/store/repair.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
