# The screen audit: what is left

Source of truth: this wiki page.

An adversarial pass over every screen, each finding handed to a second reader whose job was to refute it. Most of the 29
findings that survived are fixed (the last open one, the Board heading with no control under it, shipped in 3.7.0); this page holds only what is left and is deleted when the list is empty. The fixed half
is in the changelog and the tests. Rechecked against the code on 6 November 2026.

## Not located, so unconfirmed

Each survived refutation when it was found, and none could be located in the code on 6 November. Re-read before fixing, and
delete the line if the defect is not there.

- Nine strings reach the screen in English under a non-English locale, behind states the `screens-i18n` sweep does not mount
  (an error state, an empty state, a second dialog page).
- Boxes and labels sized in px that must hold scaling text; `typescale.test.js` reads screens at rest and does not see them.
- Bare `overflow` where `Scroller` or `useEdgeScroll` should give an edge fade.
- An anthology dialog that renders its empty state through `ErrorText`, so "nothing here yet" arrives in red.
- The Library export writes an English fragment into a file whose surrounding text is translated.

## The themes

Fixing the instances does not fix these.

1. **Failure folded into the rest state.** Six of nine screens are fixed. Open question: should `api.js` make the three-state
   split (reading, failed, empty) hard to avoid, instead of leaving each caller to remember it?
2. **A guard keyed to a hand-kept list leaks at the rate the list goes stale.** The typescale baseline names thirteen
   screens, and its own `_notCovered` text admits it cannot see panels and dialogs.
3. **The i18n and typescale guards test only the default mount.** Both stop at the front door.
4. **Nothing asks whether every screen handles every media kind.** `game` was first-class from migration 0040 and Home was
   never walked for it until it was found by reading.
