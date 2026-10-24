# ADR-0501: Overlapping list requests are dropped by a sequence guard; freshly-added quotes pin to the top

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/Movies.jsx` · `web/frontend/src/Library.jsx`

**Decided.** Each list loader increments `reqSeq` and discards its response if the counter has moved on. Newly-added quotes form a pinned prefix of the displayed rows until the next sort or refresh.

**Why.** Changing a filter twice quickly issues two requests, and there is no guarantee they return in order — so the slower, older answer can land last and paint a list that matches neither filter. A monotonic counter is the smallest correct fix and needs no cancellation support. Pinning is the other half of the same concern: when a quote is added under a sort that would file it in the middle of a hundred others, the immediate feedback has to be that it exists, so it stays glued to the top until you sort. `pinToTop` is the single source of truth for all three views, so the board, the table and the count cannot disagree. Mine.

<sub>`web/frontend/src/Movies.jsx` · `web/frontend/src/Library.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
