# ADR-0506: A credited person is always a doorway, and everything named on Stats clicks through

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** Every credited name — on a card, in a group heading, in a Stats breakdown, on a superlative tile, on an activity-calendar dot — opens the person or the search that explains it.

**Why.** A name that is only text is a dead end on a screen whose entire job is "what have I collected", and the reader's next question after seeing a name at the top of a leaderboard is always the same one. Activity dots click through to that day's additions via the date facet; breakdown rows carry cover, poster or portrait art so the row is recognisable before it is read. The gap this closed was specific: the share *image* had drawn speaker portraits since 1.5.0 because `speaker` became a people kind in that release, so a speaker you had enriched showed their portrait in the picture you exported and stayed inert text on the card you exported it from. I approved making it a rule rather than a per-screen decision.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
