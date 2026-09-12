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

import { measureStyle } from '../../src/boardHead.jsx'
import { QUOTE_COLUMNS_IN, columnMeasure } from '../../src/ui.jsx'
import { cssRules } from '../css-rules.js'
import { readSource } from '../src-files.js'

// The ladder, as useColumnsIn reads it: the first rung whose minimum the width
// meets, else one column.
const columnsAt = (w) => {
  for (const [min, cols] of QUOTE_COLUMNS_IN) if (w >= min) return cols
  return 1
}

describe('columnMeasure', () => {
  it('lets Auto use the width, rather than leaving the prose cap in place', () => {
    // THE HALF A PICKER DOES NOT ANSWER. This returned null for a while — Auto
    // kept the stylesheet's 880px, so a reader who never opened ⋯ still had two
    // columns and the fix was opt-in. `none` is the answer: lift the cap and let
    // the ladder read the width the page actually has.
    for (const auto of [0, null, undefined, -1]) expect(columnMeasure(auto)).toBe('none')
  })

  it('narrows for a chosen count rather than only widening', () => {
    // The picker is useful in both directions: Auto is as wide as the page
    // allows, and asking for two on a 1920 screen has to be able to say so.
    for (let n = 1; n <= 5; n += 1) expect(typeof columnMeasure(n)).toBe('number')
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
describe('the stylesheet consumes what the board writes', () => {
  const rules = cssRules(readSource('index.css'))
  const streamChild = rules.filter((r) =>
    r.sel.split(',').some((sel) => /\.tp-detail-stream\s*>\s*\*/.test(sel.trim())),
  )

  it('caps the stream’s children through --board-measure', () => {
    expect(streamChild.length, 'no `.tp-detail-stream > *` rule at all').toBeGreaterThan(0)
    const decls = streamChild.map((r) => r.body).join(';')
    expect(decls, 'the cap does not read the property the picker writes').toMatch(
      /max-width:\s*var\(\s*--board-measure\b/,
    )
  })

  it('keeps a prose measure as the fallback, for anything that is not a board', () => {
    // The stream holds more than the board, and a page with nothing setting the
    // property must still hold prose to a readable line.
    const decls = streamChild.map((r) => r.body).join(';')
    expect(decls).toMatch(/var\(\s*--board-measure\s*,\s*\d+px\s*\)/)
  })

  it('and the board writes exactly that property', () => {
    // Both halves of the name, checked against each other. A rename on either
    // side fails here rather than shipping a control that changes nothing.
    for (const n of [0, 1, 3, 5]) {
      expect(Object.keys(measureStyle(n))).toEqual(['--board-measure'])
      expect(String(measureStyle(n)['--board-measure'])).toBeTruthy()
    }
  })

  it('leaves the table exempt, which is the precedent this rests on', () => {
    // "the table needs to utilise the full width of the screen" — the owner's
    // words, and the reason a board may be exempt too.
    const table = rules.filter((r) => /ann-table-wrap/.test(r.sel))
    expect(table.map((r) => r.body).join(';')).toMatch(/max-width:\s*none/)
  })
})
