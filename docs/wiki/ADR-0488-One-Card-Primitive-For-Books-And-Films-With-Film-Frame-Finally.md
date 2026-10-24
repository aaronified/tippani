# ADR-0488: One card primitive for books and films, with .film-frame finally given its material

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/index.css`

**Decided.** Books and films render through the same card component, and `.film-frame` gained the texture tile, the dither and an answer to the aesthetic toggle.

**Why.** `.film-frame` was the only card primitive in the app with no material at all — and its own CSS comment had promised the material for three releases, which is the sharpest possible evidence that a comment is not an implementation. Film posters were not cards either: a bare bordered span with the card's shadow bolted on, while a book cover sat in a hand-card, on two boards built from the same component and one tap apart. Two boards from one component that look like two apps is the failure the whole material system exists to prevent. Mine, and the three-release-old comment is the part I keep quoting to myself.

<sub>`web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
