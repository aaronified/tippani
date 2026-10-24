# ADR-0529: A selection drops what leaves the screen, rather than clearing or persisting

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** `useSelection(orderedIds)` holds picked ids against the board's own visible list. When that list changes it removes ids that are no longer in it, keeps the rest, and clears the kind when nothing is left. One kind at a time — picking a second kind replaces the selection. Nothing is persisted across a reload.

**Why.** The bar says "12 selected" and then acts on twelve things, so the number has to be one it can act on. Select thirty quotes, change the colour filter, and the ids that left the screen are things nobody can check any more — the bin makes acting on them recoverable, it does not make it honest.

Clearing the WHOLE selection on any list change is the blunter rule and it is wrong for the commonest case: a board refetching itself after a patch, where every id is still there. Every bulk action reloads, so that rule would wipe the selection each action just used, and bulk editing would be impossible.

One kind, because search shows books and quotes in one view and a selection spanning both has no coherent action — you cannot set a series on a quote.

**Instead of** persisting a selection. Resuming one after a reload is a way to act on a library that changed while you were away.

**Approved.** Mine.

<sub>1.10.0 — `web/frontend/src/selection.jsx` · `web/frontend/test/dom/selection.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
