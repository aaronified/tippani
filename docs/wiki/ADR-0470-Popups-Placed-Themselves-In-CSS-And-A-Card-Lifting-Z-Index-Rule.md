# ADR-0470: Popups placed themselves in CSS, and a card-lifting z-index rule existed to work around it

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/test/rules/popup-offsets.test.js`

**Decided.** Reversed. Every dropdown, menu and suggestion list used `position: absolute; top: calc(100% + 4px)`, and a separate rule raised a whole card above its neighbours whenever a menu was open inside it. **Why it was wrong.** `top: calc(100% + N)` is right exactly once — when there is room below the trigger. Open a Select near the bottom of a phone screen and the panel rendered below the fold, so choosing an option meant scrolling the page to reach options that were supposed to be in front of you. A menu you have to go looking for is a menu that has failed. The z-index rule is the tell: it dragged the card's cover, its quote and its shadow up along with the menu, because an absolutely-positioned menu cannot escape its own card. A workaround that has to move four things to reveal one is a workaround for a structural mistake. Both were mine, and the second is the evidence I should have read years earlier.

<sub>`web/frontend/test/rules/popup-offsets.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
