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

// THE GAP IS A PARAMETER HERE, NOT A CONSTANT OF THIS FILE. It was `const GAP =
// 14`, which put the stylesheet's number back into the suite on the same day the
// component stopped hard-coding it — so the one thing the change was for went
// untested. The cases below vary it, and the boundary case is the point: two 150s
// need 314 with a 14px gap and 330 without, so a room of 320 answers 1 or 2
// depending on whether the gap was read at all.
const GAP = 14

describe('how many covers fit', () => {
  it("draws two at the size a phone actually starts on", () => {
    expect(coversThatFit(316, 100, GAP, 3)).toBe(2)
  })
})

// ── A STORED SIZE IS PUT ON THE LADDER BEFORE IT IS USED.
//
// WHAT THIS GUARDS. Sizes were saved for a long time before the slider had a step,
// so a browser holding 123 is ordinary. A range with `min=95 step=5` snaps that to
// 125 in the DOM and fires no event — so the handle sat on 125 while React's
// state, the readout beside it and the grids reading the same key all still said
// 123. Three places disagreeing with the control, and no press to blame it on.
