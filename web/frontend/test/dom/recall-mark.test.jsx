// HOW WELL A QUOTE IS HELD IS A DRAWING, AND IT STANDS WITH THE OTHER GLYPHS.
//
// THE REPORT, the owner's: "the spaced repetition dot is now on an orphan row.
// make it a four way wireframe icon (remembered, forgetting, probably forgotten,
// and not tested) and put in the bottom row (where the icons are) as the first
// icon."
//
// BOTH HALVES ARE THE SAME COMPLAINT. A 7px disc has no shape, so the only thing
// separating its four states was hue — the one channel a reader may not have,
// and one this card already spends two controls away on the six quote colours.
// And a mark with no shape cannot join a row of glyphs, so it had been left on a
// line of its own: on a card with no credits, an empty row with a dot in it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the four
// states are `remembered`, `forgetting`, `probably-forgotten` and `unseen` —
// mirrored from `recallStatus()` on the server, so the client cannot invent a
// fifth or drop one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { IconRecall, ReviewDot, STATUS_META } from '../../src/ui.jsx'

afterEach(() => cleanup())

// The mark's drawing with every colour taken out of it, which is the whole
// question: two states that differ only in `stroke` are one picture painted
// twice.
const shapeOf = (state) => {
  const { container } = render(<IconRecall state={state} />)
  const svg = container.querySelector('svg')
  return svg.innerHTML.replace(/(stroke|fill|color)="[^"]*"/g, '')
}

describe('the recall mark', () => {
  it('draws a different picture for each of the four states', () => {
    const states = Object.keys(STATUS_META)
    expect(states.length, 'the client knows a different number of states than the server').toBe(4)
    const shapes = states.map((s) => [s, shapeOf(s)])
    for (const [a, sa] of shapes) {
      for (const [b, sb] of shapes) {
        if (a >= b) continue
        expect(sa, `${a} and ${b} are the same drawing in two colours`).not.toBe(sb)
      }
    }
  })

  it('is a glyph rather than a coloured disc', () => {
    const { container } = render(<ReviewDot item={{}} />)
    expect(container.querySelector('svg'), 'the mark draws no glyph at all').toBeTruthy()
  })

  it('still says which state it is in words, for a reader who cannot see it', () => {
    const { container } = render(<ReviewDot item={{}} />)
    const label = container.querySelector('[aria-label]')?.getAttribute('aria-label') || ''
    expect(label, 'the mark is drawn and never named').not.toBe('')
  })
})

// ── AND IT LEADS THE ROW OF THINGS YOU CAN DO ─────────────────────────────────
//
// Asserted on the source, and the reason is worth stating rather than hiding: a
// quote card is assembled from a screen's worth of context — tag maps, people
// maps, a menu host, a selection — and a DOM test that stood one up would be
// testing the harness. What "first icon of the bottom row" means is a fact about
// the JSX: the mark is inside the element that holds the card's actions, and it
// comes before the first of them.
describe('where the mark sits on a card', () => {
  const CARDS = [
    ['Library.jsx', 'a book highlight'],
    ['Movies.jsx', 'a film line'],
  ]

  for (const [file, what] of CARDS) {
    it(`leads the action row on ${what}, and is not on a line of its own`, () => {
      const src = readFileSync(join(process.env.TIPPANI_SRC, file), 'utf8')
      const heart = src.indexOf('<Hearts ')
      expect(heart, `${file} has no action row to lead`).toBeGreaterThan(0)
      const mark = src.indexOf('<ReviewDot ')
      expect(mark, `${file} draws no recall mark at all`).toBeGreaterThan(0)
      expect(mark, `the recall mark comes after the row's first control`).toBeLessThan(heart)
      // WITHIN THE SAME ELEMENT, which is what stops this passing on a mark that
      // is merely earlier in the file — where it used to be, up on the credit
      // line. The row opens at the last element start before the heart.
      const rowStart = src.lastIndexOf('<div', heart)
      expect(mark, `the recall mark is outside the row it is supposed to lead`).toBeGreaterThan(rowStart)
    })
  }
})
