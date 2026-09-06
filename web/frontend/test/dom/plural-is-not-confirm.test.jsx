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
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { IconCheck, IconCheckAll, IconClose, IconCloseAll } from '../../src/ui.jsx'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const src = (f) => readFileSync(join(SRC, f), 'utf8')

const drawing = (el) =>
  [...render(el).container.querySelectorAll('path')].map((p) => p.getAttribute('d'))

describe('the plural glyphs', () => {
  it.each([
    ['tick', <IconCheckAll key="a" />, <IconCheck key="b" />],
    ['cross', <IconCloseAll key="c" />, <IconClose key="d" />],
  ])('draw a %s that is not the singular one', (_name, plural, singular) => {
    const many = drawing(plural)
    expect(many.length, 'the plural glyph has no path data at all').toBeGreaterThan(0)
    expect(many.join(' '), 'the plural glyph is the singular one under another name')
      .not.toBe(drawing(singular).join(' '))
  })

  it.each([
    ['tick', <IconCheckAll key="a" />],
    ['cross', <IconCloseAll key="b" />],
  ])('and the %s is drawn twice, so it reads as plural rather than as emphasis', (_name, el) => {
    // TWO MARKS, NOT ONE HEAVIER ONE. The reader is being told "this applies to
    // every row", and a single mark cannot say that however it is styled.
    expect(drawing(el).length).toBeGreaterThanOrEqual(2)
  })
})

// Every control whose press changes the state of a WHOLE LIST rather than
// committing anything, with the file it lives in and the key that names it.
const LIST_WIDE = [
  // The metadata merge screen's header pair: tick every differing field, untick
  // every differing field. The owner's report.
  ['WorkDetails.jsx', "common.work.merge.all.aria"],
  ['WorkDetails.jsx', "common.work.merge.none.aria"],
  // A board's card menu, starting multi-select over the board. Same defect,
  // unreported: pressing it selects nothing and commits nothing — it opens the
  // mode in which a reader picks several cards.
  ['Library.jsx', "book.select.menu.label"],
]

describe('the controls that act on a whole list', () => {
  it.each(LIST_WIDE)('%s: %s does not draw the confirming tick or the way out', (file, key) => {
    const text = src(file)
    const at = text.indexOf(key)
    expect(at, `${key} is not in ${file} any more — this row needs re-pointing, not deleting`)
      .toBeGreaterThan(-1)
    // The glyph and the name of a control are written within a few lines of each
    // other in every one of these — an `icon=` prop beside its `ariaLabel`, or one
    // menu-item object literal on one line.
    const near = text.slice(Math.max(0, at - 400), at + 400)
    expect(near, `${key} still draws <IconCheck />, which is what a form's Save draws`)
      .not.toMatch(/<IconCheck\s*\/>|<IconCheck\s+size/)
    expect(near, `${key} still draws <IconClose />, which is what closing a screen draws`)
      .not.toMatch(/<IconClose\s*\/>|<IconClose\s+size/)
  })
})
