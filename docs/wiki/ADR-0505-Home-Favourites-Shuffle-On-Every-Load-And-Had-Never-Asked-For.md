# ADR-0505: Home favourites shuffle on every load, and had never asked for standalone quotes

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/test/pure/home-favourites.test.js`

**Decided.** The favourites section reshuffles per page load, and `loadFavs` now requests all three kinds.

**Why.** Shuffling is the point of the section: it exists to resurface things, and a stable order means you see the same six favourites forever and stop looking. The bug is the more interesting half — Home fetched two lists and merged two lists, and had done since before the third kind of quote existed, with the comment above the loader still saying "both media". Nothing failed: hearting a standalone quote worked, the heart stayed on, the Quotes screen filtered by it, and the quote simply never appeared in the section that exists to resurface exactly that. That is a bug you can only find by owning one and going to look, which is why the test asserts the *sources* — the loader has to ask for all three kinds and the kind table has to know what to do with each — rather than what the tile renders. A render test asserts what a component does with the data it was given, and this component was never given the data. My call to test it that way.

<sub>`web/frontend/test/pure/home-favourites.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
