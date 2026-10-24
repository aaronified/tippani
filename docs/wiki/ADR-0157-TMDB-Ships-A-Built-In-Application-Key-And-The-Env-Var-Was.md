# ADR-0157: TMDB ships a built-in application key, and the env var was dropped

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `defaultTMDBKey` is a compile-time constant in `cmd/tippani/main.go`. Resolution order is: a direct programmatic key, then the Settings-saved custom key, then the built-in, then none — and none means a 503 with a clear message while manual entry still works. There is no environment slot.

**Why.** TMDB rate-limits per client IP, at roughly 50 req/s, so a key shared by every install never pools into one quota — which is why the Jellyfin/Kodi pattern of embedding an app key works, and TMDB permits it for open-source apps with attribution. The env var went because a key that can be set in three places is a key whose effective value nobody can state; it is managed in-app, where the Settings page can also report which source is in effect. The constant is empty in the source tree, which the roadmap names as the first thing a new install hits. My call, and the removal of the env slot is the half I was least sure about at the time.

<sub>`cmd/tippani/main.go` · `internal/httpapi/metadata_handlers.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
