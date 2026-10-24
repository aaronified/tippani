# ADR-0508: Stats counts all three kinds of quote, and the colours card finally counts dialogues

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/test/dom/stats-quotes.test.jsx`

**Decided.** Totals, favourites, busiest month, activity calendar, tag leaderboard, recall states and the colour breakdown all count annotations, dialogues and utterances.

**Why.** The server had counted standalone quotes from the day they arrived — in the totals, the colours, the tags, the calendar, the recall states, and in two whole breakdown kinds of their own — computed and sent on every request and rendered by nothing. The header said "50 saved" when 57 were. Separately and for longer, the card headed "Highlight colours" counted only book annotations, though dialogues have worn a colour since migration 0021, so two thirds of the coloured things in the library were invisible to the card that exists to count them. Both are the same defect: a screen that was correct when it was written and never revisited when a kind was added. I approved fixing them together and adding a test that names the three kinds.

<sub>`web/frontend/test/dom/stats-quotes.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
