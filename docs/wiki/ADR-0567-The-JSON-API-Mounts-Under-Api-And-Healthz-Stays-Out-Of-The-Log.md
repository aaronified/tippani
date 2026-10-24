# ADR-0567: The JSON API mounts under /api, and /healthz stays out of the log

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 1.0.0

**Decided.** One mux owns every JSON and covers route, mounted under `/api` with `http.StripPrefix` so the SPA router owns the root path space and a client-side route can never collide with an API route. `/healthz` stays at the root for ops, unauthenticated, because a container healthcheck and a monitoring probe should not have to know about a prefix. The request log writes one line per request to stdout so it is visible in `docker logs`, and skips `/healthz` — a probe every 30 seconds would otherwise be the only thing in the log, which is the same as having no log. I approved both the mount point and the exclusion.

**Instead of.** Serving the API at the root and reserving path prefixes for the SPA, which makes every new route a potential collision.

<sub>1.0.0 — `internal/httpapi/server.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
