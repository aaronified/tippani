# ADR-0152: Portraits resolve a pinned identity rather than a name

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/portrait_handlers.go` · `internal/metadata/people.go`

**Decided.** `POST /people/portrait` resolves a portrait from a stable external id and persists `source` + `source_id` on the person, leaving bio, born and links untouched.

**Why.** A by-name lookup grabs the wrong same-name person — the "several David Reichs" problem, where the more-published namesake wins. So each kind is disambiguated by something that is not the name: an actor from the film's cast (`work_cast` since 0048 — every row carries the supplier's person id, a headshot URL and the supplier's own name; it was `movies.cast_json`, which held nothing the reader had corrected and nothing at all on a game, so exactly those actors fell through to the namesake-prone search), a director from the crew in the cached TMDB payload, an author through Open Library cross-checked against the books that author wrote in *this* library. Pinning the id means a re-fetch cannot drift.

**Reversal.** The fix landed in one modal and I called it done. The Metadata → People console — both per-row and the "Fetch missing" bulk — was still on the old name + work-count lookup, so the same wrong person came back on the screen most likely to be used for this. What I got wrong is a repeat of the same class of mistake as `personCreditSQL`: a rule implemented at one call site is not a rule. It was moved onto the shared path a release later, which also gained it photos rather than only links.

<sub>`internal/httpapi/portrait_handlers.go` · `internal/metadata/people.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
