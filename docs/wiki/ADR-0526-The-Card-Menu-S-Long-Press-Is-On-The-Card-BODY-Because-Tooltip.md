# ADR-0526: The card menu's long press is on the card BODY, because Tooltip already owns the control

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.9.0

**Decided.** `useCardMenu` binds right-click, long-press and Shift+F10 to a card, and IGNORES any event whose target is inside `.tp-tip-wrap, button, a, input, textarea, select, label`. A press on a control gets that control's tooltip label; a press on the card gets the menu.

**Why.** Long-press was already taken. Tooltip opens a label after 500ms on touch because a phone has no hover and the glyph-only buttons of 1.5.0 would otherwise be unlabelled — and a card CONTAINS those buttons. Bound to the whole card, every press on a glyph would race a tooltip against a menu, and the winner would depend on event order, which is the kind of bug that reproduces on one device and not the next.

Three smaller ones came with it. A press that moves past `LONG_PRESS_SLOP` is a scroll (the existing constant, not a second one). The trailing click is eaten with the mechanism Tooltip already uses, or letting go opens the quote behind the menu you just asked for. And iOS raises its own callout over text, so `-webkit-touch-callout: none` — but NOT `user-select`, because selecting part of a quote by hand is a thing people do here.

**Instead of** long-press-to-select and right-click-for-menu, which is what a file manager does. The menu is the more general gesture and it contains the selection entry, so it wins the collision.

**Approved.** Mine.

<sub>1.9.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/card-menu.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
