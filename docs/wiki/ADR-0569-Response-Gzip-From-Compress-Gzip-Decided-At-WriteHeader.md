# ADR-0569: Response gzip from compress/gzip, decided at WriteHeader

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 1.1.0

**Decided.** Quote text compresses roughly eight to one, and the list endpoints a client mirrors return a lot of it. On a LAN this is invisible; over Tailscale or a phone's cellular connection it is the difference between a library sync that feels instant and one that does not. Standard library only — no new dependency. Three details are the decision. Compression is opt-in per request via `Accept-Encoding` and skipped for content that is already compressed — JPEG and PNG covers, sealed archives — where a second pass burns CPU at both ends and can make the payload larger. The decision is deferred to `WriteHeader`, when the handler has set `Content-Type` and the status is known, rather than guessed from the route. And when it compresses it deletes `Content-Length`, because the handler's value describes the uncompressed body. `Vary: Accept-Encoding` is set always, not only when compressing, so a cache cannot serve a compressed response to a client that did not ask. I approved all four.

**Instead of.** A compression middleware dependency, or compressing by route.

<sub>1.1.0 — `internal/httpapi/gzip.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
