# ADR-0018: bcrypt cost 10 for logins, Argon2id for archive keys

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted

**Decided.** Passwords hash with bcrypt at cost 10. Argon2id was rejected for logins on memory grounds — and then used anyway for backup-archive key wrapping, at the OWASP floor (m = 19 MiB, t = 2, p = 1).

**Why.** Cost 10 is ~60–100 ms on weak ARM, which is fine for a rare event, and its acknowledged downside is that it is not memory-hard. Argon2id's ~64 MiB per hash is exactly wrong on a NAS whose systemd unit sets `GOMEMLIMIT` to 64 MiB and which shares RAM with about a hundred other services. The apparent contradiction is a budget question, not a cryptography one: a login happens often and concurrently, an archive is sealed once and deliberately, so the 19 MiB scratch buffer is affordable exactly where the 64 MiB one is not. The three Argon2 parameters are fixed rather than stored, because `p` changes the output and a portable archive cannot let it vary by machine. Mine, and the `internal/auth` comment names `internal/httpapi/backup_crypto` explicitly so neither half reads as an oversight.

**Instead of.** Argon2id everywhere (rejected on RSS); scrypt (never argued for).

<sub>`internal/auth/auth.go` · `internal/httpapi/backup_crypto.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
