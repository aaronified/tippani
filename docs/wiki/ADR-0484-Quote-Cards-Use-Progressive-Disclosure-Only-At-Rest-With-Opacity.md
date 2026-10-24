# ADR-0484: Quote cards use progressive disclosure — only ♥ at rest — with opacity rather than display

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/index.css`

**Decided.** `.card-actions` and `.card-colors` are `opacity: 0` and `pointer-events: none` at rest, revealed on `:hover` or `:focus-within`, pinned by `.is-visible` where a card stands alone. Phones use the ⋯ overflow and never see the rule.

**Why.** A resting board should show quotes, not a control panel per quote — a hundred cards each wearing share, edit, delete and six colour dots is a screen of buttons with some text in it. Opacity rather than `display: none` is the load-bearing choice: the cluster keeps its layout box, so revealing it never changes the card's height and therefore never re-packs the masonry under the pointer. Keyboard users tabbing into the hidden buttons trip `:focus-within`, which reveals and re-enables them, so the disclosure is not an accessibility trap. Mine.

The class is `.card-tools` since 1.7.9, holds copy and share, and is revealed on a phone too — see the entry below.

<sub>`web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
