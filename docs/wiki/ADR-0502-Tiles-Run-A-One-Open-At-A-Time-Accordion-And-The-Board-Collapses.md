# ADR-0502: Tiles run a one-open-at-a-time accordion, and the board collapses before any set change

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/Library.jsx` · `Library.jsx` · `Movies.jsx`

**Decided.** The parent owns `expandedId`; expanding one collapses the rest; `expandedId` is cleared before a filter change, a refetch, a delete, or a column-count crossing, and cleared if the open card leaves the set.

**Why.** Locking the masonry column order while one card is open is what keeps the board from reshuffling under the reader, but a dangling `expandedId` keeps `lockOrder` stuck true and defeats the rising-edge freeze on the next expand. Collapsing first means the board re-packs and re-freezes off collapsed heights rather than around one still-expanded card. I approved the parent owning the state precisely because the clearing rules are about events the card cannot see.

**Instead of.** Per-card independent expansion (multiple tall cards fight the packing).

<sub>`web/frontend/src/Library.jsx` · `Library.jsx` · `Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
