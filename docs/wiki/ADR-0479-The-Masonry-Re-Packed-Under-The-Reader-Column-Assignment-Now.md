# ADR-0479: The masonry re-packed under the reader; column assignment now latches on the rising edge of an expand

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** `Masonry` measures real card heights, holds the assignment in `assignRef`, and latches it (`frozenRef`) on the **rising edge** of `lockOrder` — the first expand of a settled board. A structural signature `n|cols|seed|pinnedCount|keyHash` re-opens free packing when the card set, its identities, the column count, the seed or the pinned prefix changes.

**Why.** A height-packed masonry places tallest-first onto the currently-shortest column, so expanding one card re-sorted every other card — everything you were not looking at moved. Freezing on the rising edge specifically, and never on a pass where a structural change just re-opened packing, is what stops the columns being frozen *around* the currently-expanded tall card. The key hash folds card identities into the signature, so swapping the set for a same-size one — a filter that happens to keep the count — still re-opens packing rather than reusing a stale assignment. Heights are rounded for the ordering only, so sub-pixel measurement noise cannot reorder a tallest-first sort while tops still flow from exact pixels. My call, and the rising-edge detail is the one that took two attempts.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
