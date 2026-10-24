# ADR-0150: Credits are stored verbatim and split at read time

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/credits.go`

**Decided.** `books.author`, `dialogues.actor`, `movies.director` and `utterances.speaker` store whatever arrived. `SplitCredits` splits at read for the people views; `ReplaceCredit` splices one component in place when a rename lands.

**Why.** This is the whole safety argument for multi-author support: a wrong split costs a wrong grouping on a screen, and a wrong join costs a corrupted field with no undo. Because the stored string is never rewritten by the setting, the separator preference is safe to flip at any time. `ReplaceCredit` splices in place rather than re-serialising, so separators, "et al." markers and every co-credit stay byte-for-byte as stored — no lossy round trip and no component cap. When the rename makes a component collide with an existing spelling of the target, the later duplicate drops with its separator, which is what lets the merge tools recombine a bad split. The split rules carry their own guards: " and " only cuts in list context or between two things that both look like full names, so "Daniels and Sons" and "William and Mary" stay whole; suffix tokens re-attach ("Martin Luther King, Jr."); "et al" is dropped. I approved storing verbatim first and worrying about splitting second, and that ordering is why every later mistake here was recoverable.

<sub>`internal/metadata/credits.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
