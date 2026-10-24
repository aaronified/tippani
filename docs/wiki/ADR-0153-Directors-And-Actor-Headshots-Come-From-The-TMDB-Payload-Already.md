# ADR-0153: Directors and actor headshots come from the TMDB payload already cached on the film

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/portrait_handlers.go` · `docs/wiki/Design-decisions.md`

**Decided.** Both read out of what the movie fetch already stored — the parsed cast for actors, `credits.crew` inside `source_metadata` for directors — at no extra provider call. A by-name person search is the fallback only for films synced without a payload.

**Why.** TMDB details use `append_to_response=credits`, so one call returns details, cast and crew. The film *is* the disambiguator: it is that film's cast, so there is no same-name problem to solve and nothing to ask a provider. The director's person id and `profile_path` are sitting in the raw credits even though only the name was flattened onto the movie row. Approved: the cheapest correct answer in the whole metadata layer, and it costs a JSON walk.

<sub>`internal/httpapi/portrait_handlers.go` · `docs/wiki/Design-decisions.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
