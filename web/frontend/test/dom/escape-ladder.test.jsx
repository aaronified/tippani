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

  it('uncovers the one below, so a second press reaches it', () => {
    // One layer at a time. Two presses close two surfaces, in order — which is
    // what makes the ladder a ladder rather than a switch.
    const outer = vi.fn()
    const inner = vi.fn()
    const { rerender } = render(
      <>
        <Surface onEscape={outer} />
        <Surface open onEscape={inner} />
      </>,
    )
    esc()
    rerender(
      <>
        <Surface onEscape={outer} />
        <Surface open={false} onEscape={inner} />
      </>,
    )
    esc()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('does nothing at all when nothing is open', () => {
    const never = vi.fn()
    render(<Surface open={false} onEscape={never} />)
    esc()
    expect(never).not.toHaveBeenCalled()
  })

  it('ignores every other key', () => {
    const onEscape = vi.fn()
    render(<Surface onEscape={onEscape} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(onEscape).not.toHaveBeenCalled()
  })
})

describe('the stack matches what is on screen', () => {
  it('is empty before anything opens and after everything closes', () => {
    // A LEAK IS THE QUIET FAILURE. A surface that unmounts without
    // unregistering leaves a dead entry on top, and the next Escape calls a
    // callback for something that is no longer there — so Escape appears to do
    // nothing at all, on every surface, for the rest of the session.
    const before = escapeDepth()
    const { unmount } = render(
      <>
        <Surface onEscape={() => {}} />
        <Surface onEscape={() => {}} />
      </>,
    )
    expect(escapeDepth()).toBe(before + 2)
    unmount()
    expect(escapeDepth(), 'a surface unregistered late or not at all').toBe(before)
  })

  it('drops a surface that merely closes, without unmounting', () => {
    const before = escapeDepth()
    const onEscape = vi.fn()
    const { rerender } = render(<Surface open onEscape={onEscape} />)
    expect(escapeDepth()).toBe(before + 1)
    rerender(<Surface open={false} onEscape={onEscape} />)
    expect(escapeDepth()).toBe(before)
    esc()
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('calls the CURRENT handler, not the one it registered with', () => {
    // The callback is held in a ref on purpose: a surface whose close function
    // is rebuilt each render must not go on calling the first one it ever had —
    // that is a stale closure over state from before the panel had anything in
    // it.
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Surface onEscape={first} />)
    rerender(<Surface onEscape={second} />)
    esc()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
