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
  it('gives Auto no measure at all, so the stylesheet’s own stands', () => {
    // `undefined` rather than 880: repeating the number here would be the third
    // place it lives, and the one nothing would update.
    for (const auto of [0, null, undefined, -1]) expect(columnMeasure(auto)).toBeNull()
  })

  it('is wide enough for the ladder to actually return the count asked for', () => {
    // THE WHOLE FILE IS THIS CASE. 880 — the cap before this change — fails it at
    // three, four and five.
    for (let n = 1; n <= 5; n += 1) {
      expect(columnsAt(columnMeasure(n)), `${n} columns asked for, ${columnMeasure(n)}px allowed`).toBe(n)
    }
  })

  it('never narrows the board below the measure a reader already had', () => {
    // Choosing two must not make the board narrower than Auto's 880 just because
    // the ladder's own rung for two is 800.
    expect(columnMeasure(2)).toBeGreaterThanOrEqual(880)
  })

  it('gives one column a single card’s width, not two cards’ worth of empty page', () => {
    // One is the ladder's FLOOR rather than a rung, so it has no minimum of its
    // own — and a reader who asks for one column wants a wide card to read, not
    // an 880px box with 430px of nothing beside the text.
    expect(columnMeasure(1)).toBeLessThan(columnMeasure(2))
    expect(columnMeasure(1)).toBeGreaterThan(400) // still the ~400 a quote is read at
  })

  it('grows with the count, so no two choices draw the same board', () => {
    const widths = [1, 2, 3, 4, 5].map(columnMeasure)
    expect(widths).toEqual([...widths].sort((a, b) => a - b))
    expect(new Set(widths).size).toBe(widths.length)
  })
})
