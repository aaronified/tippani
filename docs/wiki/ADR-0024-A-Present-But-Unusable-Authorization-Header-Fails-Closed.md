# ADR-0024: A present-but-unusable Authorization header fails closed

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted
- **Version:** `internal/httpapi/server.go`

**Decided.** `bearerToken` returns `ok = true` with an empty token for `"Bearer"`, `"Bearer "`, or a different scheme entirely — anything except an absent header. `requireAuth` then validates that empty token and 401s.

**Why.** The tempting behaviour is to treat an unusable header as no header and fall through to whatever cookie happens to be attached. That would mean a revoked device keeps working as long as a browser session exists alongside it on the same device, which is precisely the case unpairing is supposed to close. Bearer also wins when both credentials are somehow present, so the identity does not depend on header ordering. My decision, and the failing-closed half is the part I care about.

<sub>`internal/httpapi/server.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
