# ADR-0154: Wikidata was dropped as a metadata source, then re-admitted for one portrait fallback

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** V2 of the plan dropped Wikidata outright — "weak fuzzy data, extra integration + throttling rules". It is back, used only to reach a P18 image and a Wikipedia link for an author already pinned by identity.

**Why.** What I rejected was Wikidata as a *search* surface, and that rejection still stands: a bare name query hits namesakes. What came back is different — the QID arrives from Open Library's remote ids on an author I have already disambiguated, so there is no fuzzy matching left to do. The narrow re-entry is the sparse-record case: an author with no Open Library photo and no wikidata link (David Reich is the standing example) is resolved by anchoring on a book they wrote and reading the work's author, P50, which is unambiguous where a name search is not. The portrait order is mine and deliberate: Open Library photo, then the Wikipedia lead image, then the P18. Two hosts were added to the cover allowlist for it. I approved the re-admission on the condition that it never runs from a name alone.

<sub>`docs/wiki/Design-decisions.md` · `internal/metadata/people.go` · `internal/metadata/covers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
