# ADR-0523: Two things the context-menu plan had wrong, and one it could not have known

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1 · completed 1.14.2

**Decided.** Recorded here for the same reason section 7 records the facet plan's misses: a plan corrected without trace reads as a plan that was right.

**Home favourites were declared out of scope, and are in it.** The plan excluded search results and Home's favourites because "their rows vary in kind, so the menu would have to pick a registry per row". True of search, where a result list mixes books, films and three kinds of quote. Not true of Home, where the row carries its own kind and picking the registry is one expression — `f.kind === 'screen' ? 'dialogue' : f.kind`. The exclusion was one argument applied to two surfaces that only look alike, and the cheaper of the two has had the menu since.

**One registry served one half of the app for three releases.** The plan's first commit built `actionsFor` and `bulkActionsFor` together, before either feature, so that a menu and a bar could not answer the same question differently — and that is exactly what happened anyway, in the direction nothing was watching. 1.11.1 gave the bulk list a work branch; the item list stayed quote-only. The selection bar could fill a book's gaps, skip it in the quiz, edit it and delete it with one thing selected, and the cover that one was selected from offered nothing at all. Every test in the file walked item → bulk. None walked bulk → item, so the asymmetry the registry exists to prevent was invisible to the tests written to prevent it.

The lesson is not "write more tests". It is that a symmetry check has a direction, and one written from the surface that currently has more actions will keep passing as the other surface falls behind.

**And the thing it could not have known.** `WorkCard` carried a comment explaining that it had no menu because a work's actions live elsewhere and "a menu that opened on a gesture and offered nothing would teach the gesture and then refuse it". That reasoning is sound and the conclusion was wrong, because the premise had quietly stopped being true — the actions existed, on the other list. A comment justifying an absence is worth re-reading whenever the thing it describes gains a neighbour.

**Approved.** Mine, written after building the last of it at 1.14.2.

<sub>1.10.0 · works 1.11.1 · completed 1.14.2 — `web/frontend/src/actions.jsx` · `web/frontend/src/works.jsx` · `web/frontend/src/Home.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
