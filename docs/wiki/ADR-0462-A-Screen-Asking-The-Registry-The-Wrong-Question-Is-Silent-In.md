# ADR-0462: A screen asking the registry the wrong question is silent in every direction

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** Home's favourite tiles map their own kind to the registry's kind through a table (`actionKind`) instead of passing it through. A book favourite reports itself as an `annotation`, which is what it is.

**Why — and this one took two attempts, which is the point of writing it down.** `FavouriteTile` called `actionsFor(f.kind, …)`, and a favourite of kind `book` is a highlight *out of* a book. `book` is what the registry calls the book itself, and copy and share are gated on precisely that distinction — `available: !isWork && !!ctx.copy`, because a work has no words of its own to put on a clipboard. So every book favourite came back with an empty action row.

Nothing anywhere reported it. The tile rendered correctly, the handlers were wired and correct, and `QuoteTools` returns `null` for an empty list — which looks exactly like a row nobody has added yet. That is what let it survive being fixed: 1.15.3 moved the tools row onto the collapsed tile, on the reasoning that copy and share should not cost a tap on the one board that exists to hold the lines you liked most. The row was genuinely added. It still drew nothing, and the report came back a release later in the same words.

Library and Catalogue never met it because they pass `'annotation'` and `'dialogue'` as literals. Home was the only screen deriving the kind, and the only one that could get it wrong.

**The test is registry-level and source-level, not render-level**, because the defect was in what the screen *asked* rather than in what it drew. A render test would have needed the exact tile, the exact hover state and the exact CSS, and would have proved less: it reads Home's table, asserts no entry names a work kind, and asserts the call site uses the table. Reverting either half fails it.

**Instead of.** A ternary at the call site, which is what was there — `f.kind === 'screen' ? 'dialogue' : f.kind` — and which handled the one case somebody had thought about while passing the other two straight through.

<sub>1.16.0 — `web/frontend/src/Home.jsx` · `web/frontend/test/pure/favourite-tools.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
