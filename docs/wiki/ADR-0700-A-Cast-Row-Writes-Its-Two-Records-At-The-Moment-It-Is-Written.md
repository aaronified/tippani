# ADR-0700: A cast row writes its two records at the moment it is written

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `store.LinkCastRow` runs inside the same transaction as every insert into
  `work_cast`: the hand-typed Add, the revive of a tombstone, a correction, the provider
  fetch, and the adoption of characters off a work's own quotes.
- **Why this was a hole and not a nicety.** 0056's one-time pass gave every *existing* cast
  row a character and a performer, and nothing in the running app did. A library upgraded
  on Tuesday had a character list; every role typed on Wednesday was invisible to it, and a
  quote's speaker had nothing to point at. The model would have been something only the
  upgrade ever populated.
- **The character is per work; the performer is resolved by name.** The asymmetry is
  deliberate and is the backfill's argument moved to the site where rows are actually
  written: resolving a character by name welds every "Narrator" in the library, while
  `people` has been one row per human being since 0027 and every credit already resolves
  into it. A fortieth Narrator is visible and mergeable; the welded one hides thirty-nine.
- **It fills a null link and never re-points one.** A link already on the row is somebody's
  deliberate pick in the picker, or one that survived a delete. Correcting the spelling a
  work prints must not re-aim the record, or a typo fix becomes a silent identity change on
  every other work that record is on.

<sub>Unreleased — `internal/store/identity.go` (LinkCastRow) · `internal/httpapi/cast_handlers.go` · `internal/httpapi/cast.go` · `internal/httpapi/cast_from_quotes.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
