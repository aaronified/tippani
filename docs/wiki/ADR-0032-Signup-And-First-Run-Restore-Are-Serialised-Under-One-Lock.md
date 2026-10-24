# ADR-0032: Signup and first-run restore are serialised under one lock

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/httpapi/auth_handlers.go` · `internal/httpapi/backup_handlers.go`

**Decided.** `handleSignup` takes `backupMu` with `TryLock` around its whole check → hash → insert, and the onboarding restore holds the same mutex across its swap, re-checking users-empty in a guard closure immediately before the point of no return.

**Why.** Both routes are unauthenticated and both are gated on "the users table is empty", which is a fact that can stop being true while you are working. A slow multi-gigabyte extraction could finish long after a legitimate signup landed and swap that new admin away; equally, a signup could commit an admin during a restore that then discards it. The users-empty check at the top of the restore is a fast rejection, not the guard — the guard is the closure under the lock, and it only closes the race *because* a signup cannot commit while the lock is held. `TryLock` rather than `Lock` so a running restore answers a clean 409 instead of blocking a signup for minutes. The `INSERT … WHERE NOT EXISTS` stays as the atomic backstop. I signed this off once both halves were named in each other's comments.

<sub>`internal/httpapi/auth_handlers.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
