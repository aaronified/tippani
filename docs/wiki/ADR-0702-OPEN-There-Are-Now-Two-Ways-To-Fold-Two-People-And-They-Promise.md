# ADR-0702: OPEN — there are now two ways to fold two people, and they promise different things

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **The state.** `POST /people/merge` (this pass) re-points link rows, files the dropped
  name as a spelling, changes no cover and parks a reversal in the bin. The Metadata
  console's duplicate card still calls `POST /people/rename`, which rewrites the credit
  STRING on every book and dialogue, drops the row, files no alias and writes no bin entry.
  Both are on screen, and the second is on the screen a reader uses to tidy duplicates.
- **Why it was not simply re-pointed at the new endpoint.** `/people/rename` is the only
  thing that can merge an ACTOR or a SPEAKER: `dialogues.actor` and `utterances.speaker`
  have no link table, so `work_person` cannot express them and the new merge would silently
  do nothing for two of the console's five kinds. That is the same blocker the credit work
  already recorded — *making the rename link-native belongs with the person panel, once
  `dialogues.actor` and `utterances.speaker` are decided* — and deciding it is the owner's
  call, not something to settle inside a commit that was closing.
- **The two candidate answers.** Either give actor and speaker their own link rows (a
  fifth and sixth `CreditRole`, and the rename becomes link-native for everything), or keep
  the rename for those two kinds and route the other three through the merge — which leaves
  one screen with two behaviours and has to say which is which.

<sub>Unreleased — open · `web/frontend/src/MetadataPage.jsx` (DupCard) · `internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
