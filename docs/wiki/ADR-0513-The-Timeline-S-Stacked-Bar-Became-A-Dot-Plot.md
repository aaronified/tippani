# ADR-0513: The timeline's stacked bar became a dot plot

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted

**Decided.** Reversed. It was one stacked bar per bucket — works at the foot, quotes on top, the pair summing to the bar's height. Each series now gets its own column of dots rising from the same floor, sharing one scale, with `TIMELINE_MAX_DOTS = 12` and `dotUnit` rounding up so anything at all draws at least one dot. **Why I was wrong.** Only the bottom segment of a stack starts from a common baseline, so the quote counts — the series you actually came for — each began at a different height and could not be compared across buckets by eye. Worse, the two series were being *added together*, which they should never have been: a work and a quote are not two of the same thing, and "3" on that axis meant nothing in particular. A dot plot fixes both, and makes the unit explicit in a way a continuous bar does not — the count is something you can read off by counting, with the legend stating what one dot is worth when the library outgrows one each. Both series share one scale, because two scales in one frame is two charts wearing a disguise. Rounding up matters: a decade holding a single book must not render as an empty column, since empty is the mark this chart reserves for holding nothing. Mine, and stacking was the kind of default I should have questioned before drawing it.

<sub>`web/frontend/src/StatsPage.jsx` · `web/frontend/test/pure/timeline-dots.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
