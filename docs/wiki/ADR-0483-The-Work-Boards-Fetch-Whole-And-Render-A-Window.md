# ADR-0483: The work boards fetch whole and render a window

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** `GET /books` and `GET /movies` still return the entire collection in one response, and every chip, sort, group-by, count and select-all still reads all of it. What is bounded is how much becomes DOM: `useBoardWindow` mounts sixty tiles and grows by sixty when a sentinel 600px before the end of the board comes into view, resetting whenever the filtered list changes. Grouped boards are windowed at both levels — twelve sections, sixty tiles inside each. Covers carry `loading="lazy"`. Without `IntersectionObserver` the window opens to the whole list instead of stopping at the first page.

**Why.** Measured in a browser on a four-hundred-book library, which is not a large one: 401 tiles, 7,492 elements, one 707ms blocking task, and 401 cover requests totalling 31.1 MB — for a viewport that holds about eighteen covers. Each tile carries a context menu, a selection tick and a shelf control, so the cost is per tile and it is not small. After: 61 tiles, 1,625 elements, 25 covers, 1.9 MB, and all 401 by the time you have scrolled to them.

Server-side paging was the obvious alternative and is the wrong one *here*: this board filters, sorts, groups and counts on the client, over the whole collection, and a page of sixty rows cannot answer "how many books are tagged" or sort by last-read across the rest. Paging the request would have meant moving all of that to SQL — a much larger change, for a payload that measured 153 KB at four hundred books and was never the bottleneck. `applyPaging` remains on both endpoints for clients that mirror the library rather than filter it.

A "load more" button was rejected: browsing a shelf *is* scrolling, and a button turns the one gesture the board exists for into a decision. Growing on approach costs nothing when the guess is right and one frame when it is wrong. My call.

<sub>`web/frontend/src/works.jsx` · `web/frontend/src/Library.jsx` · `web/frontend/src/Movies.jsx` · `web/frontend/test/dom/board-window.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
