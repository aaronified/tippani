# ADR-0816: Two numbers that were each right, and a ceiling neither declared

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's third report: a work page's quotes *"stop at two columns and do not
use the width it has"*, and a column picker to go with it.

Neither number was wrong on its own:

```
index.css   .tp-detail-stream > * { max-width: 880px }   /* a prose MEASURE */
ui.jsx      QUOTE_COLUMNS_IN = [[2000,5],[1600,4],[1200,3],[800,2]]
```

The cap's own comment defends 880 as the width a line of prose stays comfortable
at, and it is right about that. The ladder's own comment defends its rungs from the
owner's earlier report that a 1080p board was drawing four columns of 170px, and it
is right about that too. What neither says is that the ladder is measured against
the BOARD and the board lives inside the cap — so 880, being under the 1200 rung,
was a hard ceiling of two columns on any screen ever built. **The product of two
defensible numbers, and nothing in the code states it.**

So 880 becomes a DEFAULT rather than a ceiling: `max-width: var(--board-measure,
880px)`, and a reader who chooses a count sets the property on the board itself.
The custom property is read off the element the rule applies to, so setting it on
the board's own root reaches the cap that caps it — and the head above the board
widens with it, which is the pack's rule that a head and its rows share one right
edge.

### The invariant is the relation, not either number

`board-columns.test.js` asserts that the measure a chosen count is given is wide
enough for the ladder to return that count. That is the one assertion the old code
fails, at three, four and five — and the one a future edit to either list has to
keep, whichever of them it edits.

### An override was written and taken out again

`useColumnsIn(ladder, override)` was the first shape: the reader's count wins over
the measurement. It went, and the reason is worth keeping. It would force five
columns into a 900px window, where measuring gives the honest answer — you asked
for five, there is room for two, here are two. With the override gone, Auto and a
chosen count run through ONE mechanism: the choice changes how wide the board is
ALLOWED to be, and the same ResizeObserver answers in both cases.

**A MUTATION RUN IS WHAT SETTLED IT.** Removing the override survived the whole
suite, which read at first as a missing case. It was not: the path was redundant,
because the measure alone already produces the count on a window wide enough for
it. A second mechanism nothing can distinguish from the first is a second
mechanism to get wrong later.

### What the 8/10 pass found, and the one finding that was about the ask

Four findings, and three of them are the same shape as the work they were rating —
a fix applied where the report pointed and nowhere else.

**THE FIX FOR THE COLUMN BUG HAD NO TEST, AND THE RATER PROVED IT** by reverting
`index.css`'s cap to a bare `max-width: 880px` — the exact pre-fix state — in a
scratch worktree. The whole suite passed, 4,257 of 4,257. The dom cases read the
picker's value off the STYLE ATTRIBUTE, so the board went on writing
`--board-measure: 1200px` into markup that nothing consumed: a control that
changes nothing, green. `category-dot-class.test.js`, written four commits
earlier in this same stretch, is exactly the function-names-it / stylesheet-
declares-it guard that was needed here — and it was not written, because that
bug came in through a colour and this one came in through a number.

**AUTO STILL DREW TWO COLUMNS**, which is the finding that was about the ASK
rather than the code. `columnMeasure(0)` returned null, so every reader who never
opens ⋯ kept the 880 cap — and the CHANGELOG filed it under *Fixed* as "stopped at
two columns on any screen", which reads as a default repair. It was a workaround
made available. Auto returns `none` now: the cap is a PROSE measure and a board of
cards is not prose, which is the argument the table beside it already won ("the
table needs to utilise the full width of the screen"). A chosen count NARROWS from
there, which is what makes the picker useful in both directions rather than only
one.

**THE SAME PINNED BUTTON AT TWO MORE SITES**, found by reading rather than
running: `StatsPage.jsx` drew a Tooltip + bare `<button>` + `NameScroll` three
times, and the superlative fix went into one of them. No test could see the other
two, because `.name-scroll` declares `min-width: 0` on itself and a flex item's
`min-width: auto` silently overrides the chain above it. So the three become
`NameDoor`, one component that owns the shrink and cannot be opted out of — and a
source-level case fails on a fourth written out by hand, which is the half that
keeps it from happening again. This is the repo's own "similar things act
similarly" failing at the site that had just invoked it.

**AND ONE CLAIM IN A COMMIT BODY WAS ABOUT THE WRONG TREE.** `27a4d4f5` said vet
and the Go suite passed "on the head this builds on" — true, and not a statement
about that commit. The rater ran them on the commit itself: both 0. Worth
recording because a verification sentence that quietly means the previous commit
is the kind of thing a reader takes for more than it says.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
