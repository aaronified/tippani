# ADR-0496: Edit forms open in a portalled FormModal, a full-screen sheet on phones

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** `FormModal` portals to `<body>`, renders a `MobileSheet` on phones and a scrim card on desktop, and takes a ref-counted body scroll lock.

**Why.** The portal is not cosmetic: a `.hand-card` is `isolation: isolate`, so an in-tree modal opened from a masonry tile is trapped inside that tile's stacking context and later tiles paint over it. The scroll lock uses `overflow: hidden` rather than the `position: fixed` trick because every overlay here owns its own scroll container, so hiding body overflow removes the bleed-through without the scroll-position save/restore dance and its jump-to-top failure mode. Ref-counting matters because overlays stack — a share dialog over a form sheet — and an unlock from the inner one would free the page under the outer one. Full-screen on a phone because this is the app's densest form and a 90%-width card inside a scrolling scrim wasted both edges. Mine, with `position: fixed` documented as the upgrade path if iOS rubber-banding is ever reported.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
