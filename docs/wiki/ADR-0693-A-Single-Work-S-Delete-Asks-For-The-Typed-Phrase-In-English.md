# ADR-0693: A single work's delete asks for the typed phrase, in English

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `WorkDeleteConfirm` in `works.jsx` is the one dialog behind all three
  single-work deletes (board tile, book detail, film detail), and it asks for
  `deletePhrase(kind, 1)` — "delete 1 book" — the same phrase the selection bar uses.
- **This reverses a decision recorded here.** The board tile's own note argued *"one tap,
  not a typed phrase, and the difference from the bulk bar is the point"*, on the grounds
  that twelve is a number you can misread and one is not. The owner overruled it, and the
  argument did not survive being written out: one is a number you can misread too, when
  the one is a book with two hundred highlights and the tap that destroys it is the tap
  that opens it.
- **English only, deliberately.** `deletePhrase` composes from English literals and this
  app ships Bengali. The owner's ruling: *"english only typed phrases are fine since most
  people have English keyboards. it is pragmatic."* Recorded as a choice so it does not
  read as an untranslated string somebody forgot.
- **Not the work's title**, which is the prettier prompt and the unusable one — a Bengali
  title cannot be typed on the keyboard this rule exists to accommodate.
- **The check is the client's, and says so.** The bulk route takes `confirm` in its body
  and the server compares it; `DELETE /books/{id}` takes no body and is not being given
  one for a dialog. This is a guard against the misclick and does not pretend to be an
  authorisation.

<sub>Unreleased — `web/frontend/src/works.jsx` · `web/frontend/src/Library.jsx` · `web/frontend/src/Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
