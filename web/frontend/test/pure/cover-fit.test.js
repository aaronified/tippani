// How many specimen covers fit the room there is.
//
// THIS FILE KNOWS A MODULE PATH, and the tier it sits in is where that is the
// point: `coversThatFit` IS the observable unit — a width, a cell size and a gap
// in, a count out — and there is nothing a browser could show that this does not
// say more precisely. The behaviour it produces on a real screen was measured
// separately and is recorded in the commit that added it.

import { describe, expect, it } from 'vitest'

import { coversThatFit } from '../../src/coverFit.js'
// The ladder lives with the hook that reads it, in ui.jsx.
import { coverSizeOnLadder } from '../../src/ui.jsx'

// THE GAP IS A PARAMETER HERE, NOT A CONSTANT OF THIS FILE. It was `const GAP =
// 14`, which put the stylesheet's number back into the suite on the same day the
// component stopped hard-coding it — so the one thing the change was for went
// untested. The cases below vary it, and the boundary case is the point: two 150s
// need 314 with a 14px gap and 330 without, so a room of 320 answers 1 or 2
// depending on whether the gap was read at all.
const GAP = 14

describe('how many covers fit', () => {
  // THE NUMBERS FROM THE SCREEN THAT PROVOKED THIS. The owner, from their phone:
  // "we have 3 posters for the poster size panel, when no mobile screen can hold
  // three at the lowest size even." At 390 the specimen's column measures 316.
  //
  // 165 IS THE DESK'S DEFAULT, NOT THE PHONE'S — a phone starts at 100, and this
  // case is what a reader who dragged the handle up sees there. The phone's own
  // default is the case below it.
  it('draws one cover in a phone column at the size a desk starts on', () => {
    expect(coversThatFit(316, 165, GAP, 3)).toBe(1)
  })

  it("draws two at the size a phone actually starts on", () => {
    expect(coversThatFit(316, 100, GAP, 3)).toBe(2)
  })

  // And the same column takes two posters, because a poster's default is smaller.
  // The two answers differing is the whole point: a fixed count cannot be right
  // for both, which is what the hard-coded three got wrong.
  it('draws two posters in the same column at the default poster size', () => {
    expect(coversThatFit(316, 150, GAP, 2 + 1)).toBe(2)
  })

  it('draws the full three on a desk', () => {
    expect(coversThatFit(954, 165, GAP, 3)).toBe(3)
    expect(coversThatFit(954, 150, GAP, 3)).toBe(3)
  })

  // THE BOUNDARY, EXACTLY. Two cells cost 2*size + gap, so at 314 two 150s fit
  // and at 313 they do not. A specimen one pixel over its room is the wrap this
  // function exists to prevent.
  it('counts the gaps between cells and not after the last one', () => {
    expect(coversThatFit(314, 150, GAP, 3)).toBe(2)
    expect(coversThatFit(313, 150, GAP, 3)).toBe(1)
  })

  // THE CASE THAT MAKES READING THE GAP LOAD-BEARING. Mutating the component's
  // `getComputedStyle(el).columnGap` to a flat 0 left every other case in this
  // file and in cover-specimen-fits.test.jsx green, because none of them sat in
  // the band where the gap decides the answer.
  //
  // THE BAND: two 150px cells cost 314 with the gap and 300 without, so any room
  // from 300 to 313 holds two if the gap was ignored and one if it was read.
  it('answers differently when the gap is real and when it is not', () => {
    expect(coversThatFit(305, 150, GAP, 3)).toBe(1)
    expect(coversThatFit(305, 150, 0, 3)).toBe(2)
  })

  it('never goes above the works there are to show', () => {
    expect(coversThatFit(4000, 96, GAP, 3)).toBe(3)
    expect(coversThatFit(4000, 96, GAP, 1)).toBe(1)
  })

  // NEVER ZERO. Before the first measurement the room is 0, and a specimen of
  // nothing says nothing — one cover fits any width this app supports.
  it('shows one when the room is not known yet, or is absurd', () => {
    expect(coversThatFit(0, 165, GAP, 3)).toBe(1)
    expect(coversThatFit(-50, 165, GAP, 3)).toBe(1)
    expect(coversThatFit(20, 240, GAP, 3)).toBe(1)
  })

  it('shows one rather than dividing by a size it was not given', () => {
    expect(coversThatFit(954, 0, GAP, 3)).toBe(1)
  })
})

// ── A STORED SIZE IS PUT ON THE LADDER BEFORE IT IS USED.
//
// WHAT THIS GUARDS. Sizes were saved for a long time before the slider had a step,
// so a browser holding 123 is ordinary. A range with `min=95 step=5` snaps that to
// 125 in the DOM and fires no event — so the handle sat on 125 while React's
// state, the readout beside it and the grids reading the same key all still said
// 123. Three places disagreeing with the control, and no press to blame it on.
describe('putting a stored size on the ladder', () => {
  it('leaves a size that is already on it alone', () => {
    for (const v of [95, 100, 150, 165, 240]) {
      expect(coverSizeOnLadder(v, 95, 240, 5)).toBe(v)
    }
  })

  // The number the browser itself picks, which is the whole point of doing it here
  // rather than letting the DOM do it silently.
  it('moves one that is not to the nearest rung', () => {
    expect(coverSizeOnLadder(123, 95, 240, 5)).toBe(125)
    expect(coverSizeOnLadder(122, 95, 240, 5)).toBe(120)
    expect(coverSizeOnLadder(164, 95, 240, 5)).toBe(165)
  })

  it('never leaves the ends', () => {
    expect(coverSizeOnLadder(94, 95, 240, 5)).toBe(95)
    expect(coverSizeOnLadder(999, 95, 240, 5)).toBe(240)
  })
})
