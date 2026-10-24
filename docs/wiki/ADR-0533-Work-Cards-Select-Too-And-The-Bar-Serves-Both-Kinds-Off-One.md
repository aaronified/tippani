# ADR-0533: Work cards select too, and the bar serves both kinds off one registry

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.11.1

**Decided.** REVERSED from the multiselect plan, which left work-card selection out. Library and Catalogue tiles select by long press, Ctrl/Cmd-click or the tickmark, and the same `SelectionBar` serves both kinds: quotes get colour, tags, one seal, favourite, the quiz toggle and delete; works get fill-the-gaps, a shelf, set-fields, the quiz toggle and delete.

**Why.** The plan's reason for leaving works out was that their bulk endpoints already had a home on the search screen. True, and beside the point: the boards where somebody actually looks at forty books are these two, and the search screen is where you go when you know what you are looking for.

One bar rather than two, because the two selections having almost nothing in common is exactly the argument FOR the registry rather than against it. A colour category is a note about a quote and a work has never had one; a shelf is a fact about a work and a quote has none. Two components would have looked right on both screens and drifted within a release.

**Two bugs this surfaced, both invisible to inspection and both caught by a test.** `useCardMenu` treated the whole tile as a control: a work tile IS a `<button>`, so `closest('button')` matched the card itself and the gesture did nothing at all on either board — quote cards are `div`s and never showed it. And the bar passed a bare `true` where the registry calls a function, as a presence flag for the actions whose control the bar draws itself; that held until something called `run` on one, which the new shelf dropdown did.

**Instead of.** A second bar for works (drift). Selection on the search screen (rows vary in kind there, so one selection would span two registries).

**Approved.** Mine, on the reader's request for the two boards.

<sub>1.11.1 — `web/frontend/src/works.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/actions.jsx` · `web/frontend/test/dom/selection-works.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
