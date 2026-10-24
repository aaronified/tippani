# ADR-0401: rebindDB repoints every auth store after an in-process swap

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.1.0

**Decided.** Restore closes the live database and reopens a different file. The session store was rebound as part of that; anything else holding the old `*sql.DB` kept it, so a restored box answered a valid credential with an inexplicable 401. The rebinding is now one function that covers every store — sessions and device tokens — called on the success path and on the rollback path both, and `Recover` and `Reset` carry the same warning in their doc comments because they swap the handle the same way. I approved centralising it rather than adding the missing line, because the class of bug is "someone added a store and did not know", and a single function is the only shape that makes the next one obvious.

**Instead of.** Rebinding each store at each call site.

**Reversal.** Yes, of the partial rebinding shipped in 1.0.x.

<sub>1.1.0 — `internal/httpapi/server.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
