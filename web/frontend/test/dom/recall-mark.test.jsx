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
// Asserted on a real card in `card-actions.test.jsx`, which already mounts both
// of them and reads DOCUMENT order — the only place the row's order exists. It is
// there rather than here because that file is where the row's order is stated,
// and one row asserted in two files is two answers waiting to disagree.
//
// The first cut of this asserted the POSITION OF THE JSX in the source, on the
// argument that mounting a card would be testing the harness. That argument was
// wrong and checkable: the harness was fifteen lines away, already written, with
// a `compareDocumentPosition` helper whose own comment says "the JSX can say
// anything".
