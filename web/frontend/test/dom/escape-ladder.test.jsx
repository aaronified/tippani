// Escape closes the innermost surface, one layer at a time.
//
// THE BUG: seventeen keydown listeners were attached to `document`
// independently, and every one that recognised Escape acted on it. None yielded
// to the others and none stopped propagation, so one press reached all of them.
//
// The failure a reader meets: open a work's Details panel, press a row's pencil,
// type, press Escape. The row's edit is cancelled AND the panel closes — the
// words go, and so does the screen you were typing them on. Nothing throws;
// there is simply less on the screen than there was, and one of the things
// missing is what you just wrote.
//
// The design pack states it in capitals — "ESCAPE CLOSES THE INNERMOST SURFACE,
// ONE LAYER AT A TIME" — with an ordered ladder: confirm, back one panel, close
// the panel, popover, dialog.
//
// So the assertions here are about ARBITRATION, not about any one surface. Two
// things are registered, one press arrives, and exactly one of them hears it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { escapeDepth, useEscape } from '../../src/ui.jsx'

// A surface is anything that claims Escape while it is open.
function Surface({ open = true, onEscape }) {
  useEscape(open, onEscape)
  return null
}

const esc = () => fireEvent.keyDown(document, { key: 'Escape' })

afterEach(cleanup)

describe('one press, one surface', () => {
  it('goes to the one registered last, and to nothing else', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <>
        <Surface onEscape={outer} />
        <Surface onEscape={inner} />
      </>,
    )
    esc()
    expect(inner, 'the innermost surface did not hear it').toHaveBeenCalledTimes(1)
    expect(outer, 'the layer underneath heard it too — this is the whole bug').not.toHaveBeenCalled()
  })
})

