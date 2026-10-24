# ADR-0472: Every popup is portalled and viewport-positioned by one measured primitive

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx` · `web/frontend/test/rules/popup-offsets.test.js`

**Decided.** `placeAnchored` (pure arithmetic) and `useAnchoredPosition` (the DOM half) place every dropdown in the app. No popup class may set an offset at all, and a test asserts it.

**Why.** CSS cannot do this, and not for want of a cleverer rule: to know it is off the screen a popup has to measure the **viewport**, and an absolutely-positioned element is placed against its offset parent, which knows nothing about where on the page it ended up. Anchor positioning would do it natively and is not yet safe to rely on. So placement moved into JS, and with it into a portal — a card that sets `container-type` or `transform` is a containing block *and* a stacking context, and a popup inside one cannot escape however it is positioned. The arithmetic is a separate pure function because jsdom applies no layout and reports every rectangle as zeros: a test driving this through the DOM would assert that nothing fits inside nothing. The invariant is now the strong form — not "these two composed classes do not contradict each other" but "no popup class places itself at all" — and writing a `top` back fails three tests by name. It applies to the selects, the multi-selects, the tag and work suggestion lists, the ⋯ menus, the shelf chip, the calendar and the import format picker at once. My call, and one primitive rather than nine local patches is the whole argument.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/test/rules/popup-offsets.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
