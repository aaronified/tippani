# ADR-0515: The Quotes screen was a flat list on the premise that a parentless quote has nothing to group by

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/Quotes.jsx`

**Decided.** Reversed. Standalone quotes shipped as a flat list, on the reasoning that the other two screens group by their parent work and this kind has no parent. **Why I was wrong.** It is the same error the standalone-quote review-deck prediction made: I reasoned from what this kind *lacks* instead of from what it has. What a book gives you is a **title**, and this kind has four things of that sort — who said it, through what medium, where, and when. None is a parent row, and all four are piles worth making. The premise was true and the conclusion did not follow from it. Mine.

<sub>`web/frontend/src/Quotes.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
