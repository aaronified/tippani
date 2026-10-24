# ADR-0382: Restore is reachable during onboarding without a typed confirmation

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 0.8.3

**Decided.** `POST /auth/restore` and `POST /auth/restore/upload` self-guard exactly like `/auth/signup`: they work only while the users table is empty, so they need no session — and no typed confirmation, because there is nothing yet to lose. The users-empty check at the top is a fast rejection, not the real guard: a slow multi-GB extraction could otherwise finish long after a legitimate signup landed and swap that new admin away. The real guard is a closure re-checked under `backupMu` immediately before the swap, paired with `handleSignup` taking `backupMu` around its INSERT, so a signup cannot commit while a restore holds the lock. Both routes are rate-limited, because restore is expensive and unauthenticated. I approved dropping the confirmation only once the atomic guard existed.

**Instead of.** Requiring a typed confirmation on a box with no data, which is ceremony for its own sake.

<sub>0.8.3 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
