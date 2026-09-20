// How many specimen covers fit the room there is.
//
// THIS FILE KNOWS A MODULE PATH, and the tier it sits in is where that is the
// point: `coversThatFit` IS the observable unit — a width, a cell size and a gap
// in, a count out — and there is nothing a browser could show that this does not
// say more precisely. The behaviour it produces on a real screen was measured
// separately and is recorded in the commit that added it.

import { describe, expect, it } from 'vitest'

import { coversThatFit } from '../../src/coverFit.js'

const GAP = 14 // .cover-specimen's own gap

describe('how many covers fit', () => {
  // THE NUMBERS FROM THE SCREEN THAT PROVOKED THIS. The owner, from their phone:
  // "we have 3 posters for the poster size panel, when no mobile screen can hold
  // three at the lowest size even." At 390 the specimen's column measures 316.
  it('draws one cover, not three, in a phone column at the default book size', () => {
    expect(coversThatFit(316, 165, GAP, 3)).toBe(1)
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
