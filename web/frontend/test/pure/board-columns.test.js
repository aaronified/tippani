// A CHOSEN COLUMN COUNT HAS TO BE REACHABLE.
//
// THE BUG THIS CLOSES, in the owner's words: a work page's quotes "stop at two
// columns and do not use the width it has". Not a ladder problem — the ladder was
// right — a CAP problem, and the two were written far enough apart that neither
// knew about the other:
//
//   index.css   .tp-detail-stream > * { max-width: 880px }   (the prose measure)
//   ui.jsx      QUOTE_COLUMNS_IN = [[2000,5],[1600,4],[1200,3],[800,2]]
//
// and useColumnsIn measures the BOARD, which lives inside that cap. 880 is under
// 1200, so the third rung was unreachable on any screen ever built. Two numbers,
// each defensible, and the product of them is a ceiling nothing declares.
//
// SO THE INVARIANT IS THE RELATION BETWEEN THEM, not either number: whatever
// measure a chosen count is given, it must be wide enough for the ladder to
// return that count. That is the assertion the old code fails and the one a
// future edit to either list has to keep.

import { describe, expect, it } from 'vitest'

import { QUOTE_COLUMNS_IN, columnMeasure } from '../../src/ui.jsx'

// The ladder, as useColumnsIn reads it: the first rung whose minimum the width
// meets, else one column.
const columnsAt = (w) => {
  for (const [min, cols] of QUOTE_COLUMNS_IN) if (w >= min) return cols
  return 1
}

describe('columnMeasure', () => {
  it('is wide enough for the ladder to actually return the count asked for', () => {
    // THE WHOLE FILE IS THIS CASE. 880 — the cap before this change — fails it at
    // three, four and five.
    for (let n = 1; n <= 5; n += 1) {
      expect(columnsAt(columnMeasure(n)), `${n} columns asked for, ${columnMeasure(n)}px allowed`).toBe(n)
    }
  })
})

// THE PROPERTY IS A NAME TWO FILES HAVE TO AGREE ON, AND NOTHING CHECKED IT.
//
// A rater reverted index.css's cap to a bare `max-width: 880px` — the exact
// pre-fix state — and the whole suite passed, 4,257 of 4,257. Every case above
// still held, and the dom cases read the picker's value off the STYLE ATTRIBUTE,
// so the board went on writing `--board-measure: 1200px` into markup that nothing
// consumed. The fix was inert and green.
//
// This is the same shape as category-dot-class.test.js in the same stretch of
// work — a function producing a name and a stylesheet declaring it — and it is
// the guard that should have been written with the fix rather than after a rater
// went looking.
