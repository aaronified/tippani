# The codebase audit: what is left

Source of truth: this wiki page.

An adversarial pass over the code for duplications, latent defects, test gaps and departures from the design pack. Everything
it fixed is in the changelog and the tests; this page holds only what is left and is deleted when the list is empty. The two items it listed to build (a duplicate warning for a book added by title, and feedback on a slow credit-chip press) shipped in 3.7.0. The
pattern behind it: **a contract honoured at one call site and not at its siblings.** Rechecked against the code on
6 November 2026, and updated on 13 November 2026.

## To decide

- Whether `fandom_wiki` and `cast_role` being films-only is intended; record the decision either way.
- Whether `bookFieldsFrom` and `movieFieldsFrom` have drifted, and whether the dialogue and annotation handlers have:
  `validate()` (`annotation_handlers.go:34` against `dialogue_handlers.go:169`) and the favourite filter need diffing before
  they can be costed.

## Departures from the design pack nobody has ruled on

- The sticky bar's right key is ⋯ where the pack has the account chip.
- The drawer footer has no Log out and no version line.
- The organisation chip is a 9px square, not a circle.
- Credit editing has no typeahead over the library's people; only genre suggestions exist (`WorkDetails.jsx`).
- A film's or show's studio has nowhere to be stored in the credit field. A `director` spec with `personKind: 'studio'`
  exists in `workKinds.js:387`; whether it covers this is unchecked.
- Chapter grouping and the filter strip on `book-detail` were never compared, because the fixture has no chaptered book.
