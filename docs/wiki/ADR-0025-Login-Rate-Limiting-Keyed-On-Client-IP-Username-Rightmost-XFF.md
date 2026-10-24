# ADR-0025: Login rate limiting keyed on (client IP, username), rightmost XFF only

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted

**Decided.** `golang.org/x/time/rate`, keyed on `clientIP + "|" + username`. `X-Forwarded-For` is read only when `TIPPANI_TRUSTED_PROXY=1`, and then only its **rightmost** entry.

**Why.** A single reverse proxy appends the real client IP to whatever the client already sent, so everything left of the last comma is client-forgeable. Reading the leftmost entry — the usual mistake — lets an attacker rotate a fake IP per request and mint a fresh limiter bucket each time, which defeats both the brute-force protection and the bcrypt-DoS protection it doubles as. Without a declared proxy the header is ignored entirely and `RemoteAddr` is used. Signup and onboarding restore ride the same limiter under their own key suffixes, because both are unauthenticated routes that spend real CPU. I approved this after the rightmost/leftmost distinction was written down as a test rather than a comment.

<sub>`internal/httpapi/server.go` · `internal/httpapi/auth_handlers.go` · `internal/httpapi/security_test.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
