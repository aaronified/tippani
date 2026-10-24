# ADR-0482: Settings abandons the masonry for a written-down column layout

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** `SETTINGS_CARDS` is the canonical list and `SETTINGS_LAYOUT` fixes which column each card sits in at 1, 2 and 3 columns. A test asserts the three agree, and a card not named in a layout does not render at all.

**Why.** Two of these cards change height *after* they load: Updates grows when a check finds a release, Backup grows when an archive exists. Under tallest-first packing the page rearranges itself under you, and the worst case is the one that sounds safe — a phone, where there is only one column and the columns therefore cannot change. The tallest-first *order* still can: you tap "check for updates", the answer arrives, the card grows, and it is re-sorted somewhere else on the page while you are reading it, so you have to go and find the thing you just asked for. A board of quotes has no natural order, so packing by height costs nothing and buys a tidy board. A settings page has a natural order and seven cards, and the order is worth more than the packing. Colours sitting directly under Metadata in every layout is a rule rather than an arrangement — both are about what a quote is *labelled* with — so reading down one column reads as one subject. Failing loudly when a card is missing from a layout beats a card appearing somewhere unpredictable. My call.

<sub>`web/frontend/src/Settings.jsx` · `web/frontend/test/pure/settings-layout.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
