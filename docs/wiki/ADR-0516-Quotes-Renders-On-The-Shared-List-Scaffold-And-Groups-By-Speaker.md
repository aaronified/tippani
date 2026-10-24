# ADR-0516: Quotes renders on the shared list scaffold and groups by speaker, medium, place and date

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** `WorkListScaffold` plus `groupWorks`, with `GROUP_OPTIONS` of speaker, medium, place and decade, and named residual buckets — "No speaker", "No medium", "No place".

**Why.** The three list screens had drifted into looking like three different apps while doing the same job, so Quotes gets the same filter row, counts, empty and no-match states, export confirmation and full-screen phone filter sheet. The residual bucket matters more here than on its neighbours, because a proverb has no speaker, no medium and no date and lands in the catch-all of every one of them — so the label says what is *missing* rather than "None". The speaker dimension translates to `groupWorks`' `author` rather than falling through to the generic facet branch, which reads the raw column: without the translation, a line credited to two speakers filed under the joined string as though that were a person. Extracting `groupUtterances` from the component is what lets that agreement — between the page, the card and the share image — be a test rather than a reading. Filtering also moved client-side to match both neighbours, closing a bug they cannot have: the speaker dropdown was built from the rows on screen, which the server had already filtered. Approved by me.

<sub>`web/frontend/src/Quotes.jsx` · `web/frontend/test/pure/quotes-grouping.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
