# ADR-0313: "Who said this" draws its distractors from the film's own cast, and never fetches

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** The options are ACTORS, not characters, at the reader's request. Distractors come from the same film's stored `cast_json` first — the people who were actually in it — and widen to the pool only when that is not enough.

**Why the film's own cast.** It is the difference between a question that is hard because you have to remember and one that is easy because three of the four names are obviously from other decades. It also costs nothing: the cast is already stored, so there is no request at quiz time, which this app does not do anyway.

**Amended by 0048, then amended again.** A work's cast is `work_cast` now. The distractors were left on `movies.cast_json` on purpose, with the gap recorded as a failing-when-fixed test — and then freezing the blob against the unattended bulk fill starved that reader, because an approved cast diff writes the mapping and not the blob. So `quizPools` reads the mapping: the pool stops going stale, a name the reader corrected is visible to it, and a **game's** typed voice cast produces distractors for the first time (the blob is `'[]'` for nearly every game). Tombstones and actorless rows are excluded — a credit somebody deleted and a row with no name are not answers anybody can pick.

**Approved.** The reader's, in the form "for movies/shows, who said this (options will have actor cards, not the character cards)".

<sub>1.15.0 — `internal/httpapi/speaker.go` · `internal/httpapi/review_handlers.go` · `internal/httpapi/speaker_test.go` · `internal/httpapi/cast_speaker_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
