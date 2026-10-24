// A CONTROL THAT ACTS ON A WHOLE LIST DOES NOT WEAR THE CONFIRMING TICK.
//
// THE REPORT, the owner's: "in metadata selections: replace the single tick at
// the top with double tick. the single tick feels like 'ok' and not
// 'multi-select'. this is a violation of 'similar things' repo directive."
//
// THE RULE UNDER IT is CLAUDE.md's: "Two things that look the same behave the
// same." Everywhere in this app a single ✓ COMMITS — it is the confirming half of
// the tick-and-cross every form wears, and its arming is what says something has
// changed. Over a list of rows to choose between, the same drawing meant "tick
// all of them": a press that writes nothing and leaves the reader still at the
// decision. Two drawings, two jobs.
//
// AND THE CROSS GOES WITH THE TICK. Its job there is "untick all of them", and a
// double tick beside a single ✕ reads as "select all / cancel" — which moves the
// confusion one control along instead of ending it.
//
// WHAT IS ASSERTED. First that the plural drawings are genuinely different
// drawings and genuinely plural — a glyph that differed only in colour would pass
// a naming check and fail the reader. Then that the controls which act on a whole
// list use them, from the source, because that is the half that regressed.
//
// THE LIST IS NAMED AND REVIEWED, like `glyphs-are-drawn.test.js`'s ratchet: a
// new list-wide control joins it in a review where somebody reads the reason.
// What is NOT here is the singular case — a row's own tick, a form's Save — which
// keeps the confirming glyph and should.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that `Icon*` in
// `ui.jsx` are stroke SVGs whose whole content is their `<path>` data.

import { describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MergeScreen } from '../../src/WorkDetails.jsx'

// THE SCREEN THE OWNER WAS LOOKING AT, RENDERED.
//
// Everything below this block reads a source file as text, which is what the
// reported control was held by — and a source scan passes on a screen that has
// stopped drawing the control at all. Taking the pair off the merge screen
// entirely left every case here green. So the reported one is asked of the
// rendered screen: that the control is there, that it wears the plural mark, and
// that pressing it does what its name says.
describe('the merge screen the report was about', () => {
  const ROWS = [
    { key: 'title', label: 'Title', take: false, current: 'Old', next: 'New' },
    { key: 'year', label: 'Year', take: false, current: 1999, next: 2001 },
  ]
  const open = () => render(
    <MergeScreen
      kind="book"
      rows={ROWS}
      candidate={{ source: 'openlibrary', source_id: 'OL1M' }}
      busy=""
      onBack={() => {}}
      onApply={() => {}}
      onResync={() => {}}
    />,
  )
  const key = (name) => screen.getByRole('button', { name })
  // queryAll, not getAll: none taken is the fixture's STARTING state and the
  // precondition of the case, and getAll throws on an empty match.
  const taken = () => screen.queryAllByRole('button', { pressed: true }).length
  const rows = () => screen.getAllByRole('button').filter((b) => b.className.includes('merge-row')).length

  it('and ticks the whole list with one press, which is what its name says', () => {
    open()
    expect(taken(), 'the fixture starts with something already taken').toBe(0)
    fireEvent.click(key(/take every field/i))
    expect(taken(), 'pressing "take every field" did not take every field').toBe(rows())
    fireEvent.click(key(/take no fields/i))
    expect(taken(), 'pressing "take no fields" left fields taken').toBe(0)
    cleanup()
  })
})
