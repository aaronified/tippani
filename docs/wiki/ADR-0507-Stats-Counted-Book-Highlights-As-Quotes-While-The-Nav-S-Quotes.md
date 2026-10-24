# ADR-0507: Stats counted book highlights as "Quotes" while the nav's Quotes tab meant something else

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** Reversed. The counts row called book annotations "Quotes". **Why it was wrong.** The nav has a Quotes tab meaning the standalone kind, so a tile borrowed a screen's name without counting what that screen counts — while the kind it was named after had no tile at all. A label that is correct in isolation and wrong against the tab strip two inches away is worse than a clumsy one, because the reader reconciles them and gets a false answer. This is the copy-outliving-behaviour failure again, and it is the third time in this document. Mine.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
