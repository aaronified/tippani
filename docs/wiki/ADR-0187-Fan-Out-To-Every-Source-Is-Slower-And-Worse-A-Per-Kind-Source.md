# ADR-0187: Fan-out to every source is slower and worse; a per-kind source picker is the planned answer

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `docs/roadmap.html` · `internal/httpapi/metadata_handlers.go`

**Decided.** Today a lookup fans out to whatever happens to be configured, in an order baked into the code, and you find out what it consulted by reading the result. The roadmap's [choose your metadata sources](Roadmap.md#metadata-sources) section plans checkboxes per lookup, remembered per kind.

**Why.** Fan-out spends every provider's quota on every query and gives the reader no way to say "just Open Library", which is the honest answer to a source that is simply wrong about a particular book. It also makes an unkeyed provider look broken: TMDB and TheTVDB do nothing without a key — their rule, not mine — and an unkeyed instance answers a 503 from a lookup that looked like it should work. Half of that half has shipped: Settings now says the state out loud with a chip reading "Built-in key" or "No key" plus a chip for whether the last book lookup worked, so it is no longer discovered by a failed lookup. What is open is the picker itself. Recorded as mine and still owed.

<sub>`docs/roadmap.html` · `internal/httpapi/metadata_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
