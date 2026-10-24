# ADR-0029: Switching accounts requires that account's password, and retires the session you arrive with

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted, then changed or withdrawn: the entry says how
- **Version:** `internal/httpapi/auth_handlers.go`

**Decided.** Switching goes through `POST /auth/login` like any other sign-in, and the cookie session presented on the way in is deleted — after the password check, before the new session is minted.

**Why.** Switching from Profile logs in over a session that is still valid, and `startSession` only overwrites the cookie. The old row would sit in the `sessions` table until it expired, reachable by anyone holding that token — a session you believed you had left. Deleting it *after* the check is the load-bearing detail: a failed switch must leave the session you are still using alone. Being an admin does not let you into another account without its password either. My call.

<sub>`internal/httpapi/auth_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
