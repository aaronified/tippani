// The first question the add surface asks, and what each answer can reach.
//
// THE OWNER'S CORRECTION: "now i cannot choose if i want to add a work, a board
// for quote, an anthology, a quote, or import stuff. that should be the first
// screen. if a work/board/anthology is chosen, i will also need to select the
// work/board/anthology there."
//
// The bug this table guards against is a mode that leads nowhere — a door on the
// first screen that opens onto an empty panel. That cannot be seen by reading the
// chooser, because the chooser only knows the list; it needs the mapping.
import { describe, expect, it } from 'vitest'
import { ADD_MODES, doorsFor, modeIsHeld } from '../../src/addModes.js'

describe('the five modes', () => {
  // EVERY MODE MUST GO SOMEWHERE. A mode reaches a form, or it is held with a
  // reason, or it owns its own surface — and a mode that is none of those three is
  // a button that opens nothing.
  it('and every one of them leads somewhere', () => {
    for (const mode of ADD_MODES) {
      const reaches = doorsFor(mode, { type: 'book' }).length > 0 || modeIsHeld(mode) || mode === 'import'
      expect(reaches, `${mode} opens onto nothing`).toBe(true)
    }
  })
})

