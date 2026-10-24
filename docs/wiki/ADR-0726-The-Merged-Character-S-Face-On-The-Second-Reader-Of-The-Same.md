# ADR-0726: The merged character's face, on the second reader of the same data

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Follow-up to the owner's report. The quote card was fixed in the same session; this is
the surface that was still wrong, and the reason it was a separate fix rather than the
same one.*

- **Reproduced as a test before anything else.** `TestTheOwnersMergeSequence…` drives the
  literal sequence — give book A's cast row a still, promote it to the record with
  `PUT /characters/{id}/image`, merge, then read a quote from each book — in BOTH merge
  directions, because which record a reader keeps is not something the fix may depend on.
  Breaking the fallback makes it fail with the owner's own words: "the second book: 0
  faces on the quote".
- **THREE THINGS HAVE TO HOLD TOGETHER**, and each was a place it could fail: the promote
  writes `characters.image_path`; the merge carries that column onto the survivor when
  the survivor's is empty (`characterMergeFillable` already listed it); and a reader of
  the data falls back to it when the work has no per-work picture. Only the third was
  missing, which is why the first book drew a face and the second did not.
- **There were two readers, and only one was fixed.** `cast_images.go` builds the quote
  card's chip; `useCharacterPicture` builds the cast panel's. Both read
  `work_cast.character_image_path` and neither read the record. Fixing one and shipping is
  how the same bug gets reported twice, so the cast row now reports
  `character_record_image` beside the per-work path and the panel's ladder is three rungs:
  this work's picture, then the record's default, then the performer's headshot.
- **The record outranks the headshot**, and that is a real ordering rather than an
  accident: the record's default is a picture of the CHARACTER, promoted by the reader
  from one of their appearances. A headshot answers "who plays them" — a different
  question, and one a book cannot ask at all.
- **A correlated subquery, not a join.** `castCols` is shared by six reads and every one
  of them selects `FROM work_cast` unaliased, so a join would mean qualifying every
  column in all six. A cast list is a few dozen rows.
- **The character's OWN panel must not get the new rung**, and its comment now says so.
  `AppearanceCard` builds its row by hand precisely so `character_record_image` is absent:
  that panel exists to show which appearances have no picture, and substituting the
  record's face there takes away the one thing it is for. Spreading the row in to
  "simplify" it would turn every empty slot into the record's face.
- **An unlinked row reports nothing.** `work_cast.character_id` is nullable and most rows
  on a library that has not been through the cast panel carry none, so that case has its
  own test rather than resting on the subquery happening to return empty.

<sub>Unreleased — `internal/httpapi/cast.go` · `cast_images.go` ·
`web/frontend/src/cast.jsx` · `identity.jsx` ·
`internal/httpapi/character_merge_test.go` · `test/dom/cast-panel.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
