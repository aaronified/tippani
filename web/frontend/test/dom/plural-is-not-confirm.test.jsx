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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { IconCheck, IconCheckAll, IconClose, IconCloseAll } from '../../src/ui.jsx'
import { MergeScreen } from '../../src/WorkDetails.jsx'

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

  it('draws the pair at all, which a source scan cannot tell you', () => {
    open()
    expect(key(/take every field/i), 'the list-wide tick is not on the screen').toBeTruthy()
    expect(key(/take no fields/i), 'the list-wide cross is not on the screen').toBeTruthy()
    cleanup()
  })

  it('and ticks the whole list with one press, which is what its name says', () => {
    open()
    expect(taken(), 'the fixture starts with something already taken').toBe(0)
    fireEvent.click(key(/take every field/i))
    expect(taken(), 'pressing "take every field" did not take every field').toBe(rows())
    fireEvent.click(key(/take no fields/i))
    expect(taken(), 'pressing "take no fields" left fields taken').toBe(0)
    cleanup()
  })

  it('and neither half wears the mark a form\'s Save wears', () => {
    open()
    const single = drawing(<IconCheck key="s" />).join(' ')
    const singleX = drawing(<IconClose key="x" />).join(' ')
    for (const [name, one] of [[/take every field/i, single], [/take no fields/i, singleX]]) {
      const marks = [...key(name).querySelectorAll('path')].map((n) => n.getAttribute('d'))
      expect(marks.length, `${name} draws fewer than two marks, so it reads as emphasis`)
        .toBeGreaterThanOrEqual(2)
      expect(marks.join(' '), `${name} draws the singular mark, which is what commits`)
        .not.toBe(one)
    }
    cleanup()
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

// matchEnd — where the thing that opens at `i` closes.
//
// `{` balances against `}`. `<` is a JSX opening tag, which ends at the first `>`
// OUTSIDE any braces — so an arrow function in an `onClick={() => …}` cannot end
// it, which is the only `>` that turns up inside one of these.
function matchEnd(text, i) {
  if (text[i] === '{') {
    let depth = 0
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) return j
    }
    return -1
  }
  let depth = 0
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '{') depth++
    else if (text[j] === '}') depth--
    else if (text[j] === '>' && depth === 0) return j
  }
  return -1
}

// declarationAround — the control a name belongs to, taken by balancing outward
// from the name until a span is reached that also DRAWS something.
//
// WHY NOT A WINDOW. This read 400 characters either side of the key, which is a
// guess at how these three controls happen to be written today: a prop reordered
// or a comment added moves the glyph out of range and the case passes on a
// control it stopped reading. Balancing outward asks for the declaration itself,
// and stopping at the first span that names a glyph is what makes it the
// CONTROL's declaration rather than the `{t(…)}` immediately around the key.
function declarationAround(text, at) {
  for (let i = at; i >= 0; i--) {
    if (text[i] !== '<' && text[i] !== '{') continue
    const end = matchEnd(text, i)
    if (end <= at) continue
    const span = text.slice(i, end + 1)
    if (/<Icon[A-Za-z]*\b/.test(span)) return span
  }
  return ''
}

describe('the controls that act on a whole list', () => {
  it.each(LIST_WIDE)('%s: %s draws the plural mark and not the confirming one', (file, key) => {
    const text = src(file)
    const at = text.indexOf(key)
    expect(at, `${key} is not in ${file} any more — this row needs re-pointing, not deleting`)
      .toBeGreaterThan(-1)
    const decl = declarationAround(text, at)
    // A CASE THAT CANNOT FIND ITS SUBJECT MUST SAY SO. An empty span passes every
    // `not.toMatch` below it, which is how a guard goes on reporting green over a
    // control it has stopped reading at all.
    expect(decl, `no declaration drawing a glyph was found around ${key} in ${file}`)
      .not.toBe('')
    expect(decl, `${key} still draws <IconCheck />, which is what a form's Save draws`)
      .not.toMatch(/<IconCheck\s*\/>|<IconCheck\s+size/)
    expect(decl, `${key} still draws <IconClose />, which is what closing a screen draws`)
      .not.toMatch(/<IconClose\s*\/>|<IconClose\s+size/)
    // AND THE HALF THAT WAS MISSING. Every assertion here was a NOT, so a
    // list-wide control that drew no glyph at all — or drew some third mark
    // nobody has ruled on — passed as though it had been fixed. The rule is that
    // it wears a plural mark, so that is what is asked.
    expect(decl, `${key} draws no plural mark, so nothing says the press is about every row`)
      .toMatch(/<IconCheckAll\b|<IconCloseAll\b/)
  })
})
