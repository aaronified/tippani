# ADR-0166: Covers are downloaded once and served locally, never hotlinked

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `docs/wiki/Design-decisions.md` · `internal/metadata/covers.go`

**Decided.** Every cover, poster and portrait is fetched once into `data/MediaCover/` and served from `/covers/{file}` under a server-generated filename. The CSP stays `default-src 'self'`.

**Why.** Hotlinking would put a third party in the render path of every board in the app: a runtime dependency on someone else's CDN, a leak of every reader's IP to it, and a CSP that has to name image hosts and then keep naming them. The cost is a few kilobytes stored per work, which on a library of any size is nothing next to the database. It also means a work keeps its art when the provider reorganises. My call, made in the plan and never revisited, and it is what lets the headers stay as short as they are.

<sub>`docs/wiki/Design-decisions.md` · `internal/metadata/covers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
