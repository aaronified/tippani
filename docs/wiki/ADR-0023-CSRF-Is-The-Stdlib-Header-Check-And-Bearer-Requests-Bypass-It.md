# ADR-0023: CSRF is the stdlib header check, and bearer requests bypass it

Source of truth: this wiki page.

- **Area:** [§2 Ownership, Authentication and Exposure](ADR-Index.md#area-2)
- **Status:** Accepted

**Decided.** `http.NewCrossOriginProtection()` wraps every route. `exceptBearer` routes a request carrying `Authorization: Bearer` around that wrapper and everything else through it.

**Why.** Cross-origin protection exists to stop a hostile page making a browser spend an *ambient* credential. A bearer token is never attached automatically — it has to be read from storage and set deliberately, which a cross-origin page cannot do — so the check buys nothing on that path. Today a header-less request already passes (no `Sec-Fetch-Site`, no `Origin`, nothing to reject), so this makes the native client's exemption explicit rather than incidental, and a stricter stdlib default in a future Go release cannot silently break every phone. It deliberately does not weaken the cookie path: a cookie-only request goes through the wrapper cross-site or not, and there is a test named for exactly that. Skipping CSRF is also not skipping auth — a forged header buys a 401. I approved the bypass only once the second half was pinned by a test.

**Instead of.** Double-submit tokens (rejected: state, deps, and a stdlib answer exists).

<sub>`internal/httpapi/server.go` · `internal/httpapi/bearer_auth_test.go` · `internal/httpapi/csrf_native_test.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
