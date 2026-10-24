# ADR-0548: A board of quotes is ordered and grouped, and each dimension runs in the order it is read in

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `sortAnnotations` and `groupAnnotations` (Library.jsx) put a work's quotes in order and cut them into sections; `AnnotationBoard` draws one set in whichever view is chosen, so the grouped and ungrouped paths render through one component. Sort: date added · chapter · location · length · category, plus the server's own order, either direction. Group: chapter · category · tag · date. Both sit in the board header beside the view, outside the chip scroller.

**Why.** The reader's report, in their words: *"there is no sorting or grouping of annotations."* Correct on both counts — the sort existed for the TABLE view alone, as clickable column headers, and the two card views (which is where a reader reads) had none and no grouping at all. A book with three hundred highlights opened in whatever order they were saved.

**ONE ORDER FOR EVERY VIEW.** `sortedRows` was guarded by `view !== 'table'`, which is the shape of decision that reads as a feature and behaves as a gap: the control existed, in the one place a reader was least likely to be.

**GROUPING AND SORTING ARE ONE DECISION MADE TWICE,** which is why they sit together — "by chapter, in reading order" is a single thought. The direction is its own key rather than a second select, because a two-value select is a toggle with a lid. Both are settings rather than filters — chosen once, then read from for an hour — so they keep their place outside the chip scroller, the same rule the colour control follows.

**EACH DIMENSION RUNS IN THE ORDER IT IS ACTUALLY READ IN, and that is why this is not `groupWorks`.** That function orders its buckets by LABEL, which is right for a shelf of series and authors and wrong for all four of these: chapters run in reading order, categories run in the order the swatches are drawn, days run newest first, and tags run by how many quotes wear them. Four dimensions, four orders, none alphabetical. Bending `groupWorks` would have been a fifth option on a function that already takes eight, and the result would order a shelf and a board by rules neither call site could read off it.

**MISSING SINKS, IN BOTH DIRECTIONS, so it is a partition and not a sentinel.** A quote with no location is not "location zero", and a board that opened with every unlocated quote on top would look broken; a sentinel puts them all on top of the OTHER end the moment the arrow flips, which is the same complaint in a mirror. Three dimensions can be absent — chapter, locator, date — and a colour and a length always exist.

**A chapter is a number for some quotes and a name for others,** so its comparable is a string with the rank in the first character. The comparator uses `<`, and JavaScript will tell you that `''` is less than 2 — which is how an unchaptered quote came top of a chapter sort in the first draft of this.

**GROUPING IS NOT A VIEW.** A section holds whichever view the reader chose, including the table. A control that worked in one view and silently did nothing in another would be worse than no control — and that is exactly what the old table-only sort was. `AnnotationBoard` exists for this: a grouped board draws its view once per section, and two copies of "how a quote is drawn" is two places for a card prop to go missing in the view nobody was looking at.

**And the category filter became the control its own comment described.** The header said, in as many words, that "a colour is a filing decision with six values, so it opens a list rather than sitting there as six toggles" — over six toggles. A reader NAMES their categories (theme.js), so the swatch cannot say whether the blue one is "Fact" or "Disagree" or nothing at all, and six dots ask them to remember which. One control that names what the board is filtered to answers that without being pressed, and the dot rides with the name rather than instead of it — recognising the one you already know is what a colour is good at. Hidden slots stay hidden except the one currently chosen: a board narrowed by a retired category must still be able to say so.

**Sections are windowed as well as their contents,** the same two-level bound the Library's grouped shelf uses: each section stops at the page size, and a hundred small sections is still the whole book mounted.

<sub>3.1.0 — `web/frontend/src/Library.jsx` · `web/frontend/src/index.css` · `web/frontend/test/pure/annotation-order.test.js` · `web/frontend/test/dom/annotation-group-sort.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
