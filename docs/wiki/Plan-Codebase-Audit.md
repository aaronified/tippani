# The codebase audit: what is left

Source of truth: this wiki page.

An adversarial pass over the code for duplications, latent defects, test gaps and departures from the design pack. Everything
it fixed is in the changelog and the tests; this page holds only what is left and is deleted when the list is empty. The
pattern behind it: **a contract honoured at one call site and not at its siblings.** Rechecked against the code on
6 November 2026.

## To build

- **A book added by title alone gets no duplicate warning; a film does.** `createMovieFromSource` calls
  `similarMoviesForSource` and returns `409 needs_confirm` with the look-alikes. `handleCreateBook` has no analogue: its only
  protection is the `(user_id, isbn)` and `(user_id, asin)` unique index, which cannot fire for a book entered without
  either, which is most hand-entered books. The fix is a `similarBooksByTitle` helper and a `needs_confirm` arm the add-book
  flow does not yet expect.
- **A credit chip's press has no feedback on a cold chunk.** `usePersonOpener` (`personOpen.jsx:198`) routes seven screens'
  chips through `stack.open()` inside a dynamic `import().then()`, an unbounded delay before `go(-n)` with no pending state
  on the control.

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
