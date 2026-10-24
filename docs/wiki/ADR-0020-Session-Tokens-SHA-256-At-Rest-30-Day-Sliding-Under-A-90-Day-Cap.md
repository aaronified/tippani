# ADR-0020: Session tokens: SHA-256 at rest, 30-day sliding under a 90-day cap, swept lazily

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/auth/auth.go` · `docs/wiki/Design-decisions.md`

**Decided.** A session token is 256 bits of randomness; only its SHA-256 is stored. `SessionLifetime` is 30 days sliding, `sessionRefreshAt` bumps expiry when under 15 days remain, and `SessionMaxLifetime` caps the whole thing at 90 days from creation. Expired rows are deleted on the next `Create`.

**Why.** Storing the hash means a database read — a backup archive, a stolen file — does not yield a usable cookie. The sliding window keeps a daily user signed in; the absolute cap stops a token renewing itself indefinitely, which is the failure mode a purely sliding window has. The sweep runs inside `Create` rather than on a timer because a cleanup cron is a background process, and §8's CPU budget says idle CPU is approximately zero — a login is the only moment the table needs tidying and the only moment anyone is waiting on it anyway. My decision, approved with the constants written into `auth.go` rather than config, so a reader sees the policy and not a knob.

<sub>`internal/auth/auth.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
