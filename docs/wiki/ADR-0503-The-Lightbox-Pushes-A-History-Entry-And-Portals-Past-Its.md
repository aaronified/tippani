# ADR-0503: The Lightbox pushes a history entry, and portals past its filtered ancestor

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** Opening pushes `{tpLightbox: true}`; `popstate` closes it; an explicit close consumes the entry it pushed. It renders through a portal to `<body>`.

**Generalised in 2.1.3** — this is now `useBackToClose`, and every overlay in the app asks for it: `FormModal`, `MobileSheet`, the drawer, the account overlay. The entry carries `tpOverlay` and forwards the route depth below rather than replacing the state object, which the Lightbox's own marker did not. See the next entry but one.

**Why.** On Android the back gesture is how a full-screen thing is dismissed, and without a history entry it leaves the page instead — losing the reader's place in a board they had scrolled. Consuming the entry on an explicit close is the part that is easy to omit: without it, the page's own Back stops working for one press after every lightbox you opened and closed normally. The portal is required for a different reason: the detail hero has a `filter`/`will-change` ancestor, which makes `position: fixed` anchor to *it* rather than to the viewport, so a plain render traps a full-screen overlay inside the cover's box. Mine, and it is the same containing-block trap the popup primitive exists for.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
