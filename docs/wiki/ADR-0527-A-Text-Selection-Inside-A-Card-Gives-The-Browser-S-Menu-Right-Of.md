# ADR-0527: A text selection inside a card gives the browser's menu right of way

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.9.0

**Decided.** `onContextMenu` checks for a non-collapsed selection whose anchor is inside this card and, if there is one, does NOT `preventDefault` — so the platform menu opens instead of ours.

**Why.** Somebody who has dragged across a quote and right-clicked wants Copy. They also have Look Up, Translate, Search With and Speak, none of which this app reimplements. Replacing that with a four-item menu in a note-keeping app is a straight downgrade at the exact moment the reader is doing the thing the app is for.

Scoped to a selection INSIDE the card, because a selection in another card or in the search box is not this card's business and would suppress the menu everywhere.

**Approved.** Mine, and this is the one I would defend hardest in the whole feature.

<sub>1.9.0 — `web/frontend/src/ui.jsx` · `web/frontend/test/dom/card-menu.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
