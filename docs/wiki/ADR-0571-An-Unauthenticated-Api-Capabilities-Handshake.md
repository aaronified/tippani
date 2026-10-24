# ADR-0571: An unauthenticated /api/capabilities handshake

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 1.1.0

**Decided.** The SPA ships inside the binary, so it is always exactly as new as the server and never needed a handshake. An installed Android APK does not: it and the server on a NAS update on entirely separate schedules, so sooner or later one is older than the other, and without somewhere to ask, the app discovers that as an unexplained 404 halfway through saving a capture. `GET /api/capabilities` returns the running version, an integer `apiRevision`, a named feature list and `minClientRevision`. It is unauthenticated and cheap because the app needs it before it holds a token — during pairing, and on resume. The revision is deliberately one integer rather than a version per route: a client only ever needs "is this server new enough for me". Feature names are stable once published, because an old app keeps looking for the string it was built against. I approved the handshake and the single-integer shape together.

**Instead of.** Per-route versioning, or probing for 404s.

<sub>1.1.0 — `internal/httpapi/capabilities_handler.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
