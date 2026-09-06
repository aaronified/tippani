// A POPUP ON A PHONE IS A SHEET FROM THE BOTTOM, AND A DRAG BACK DOWN CLOSES IT.
//
// THE REPORT, the owner's: "in mobile, make the popups fill the entire width and
// start from the bottom with edgemask if needed to be scrolled… also, scrolling
// down will close the popup now (which becomes an intuitive thing). any edits
// pending save will trigger the same warning as it does now."
//
// THE PART THAT IS EASY TO GET WRONG is the last clause. A second way out that
// skips the unsaved-changes question is not a convenience, it is a way to lose
// typing — so the gesture must go through the SAME guarded exit as Escape and
// the ✕, and that is what these cases ask. The other half is telling the gesture
// apart from reading: a downward drag part-way down a scrolled body is the
// reader reading, and only at offset zero can it be a dismissal.
//
// THE WIDTH AND THE CORNERS are the stylesheet's and are checked in
// `test/pure/` — jsdom lays nothing out, so a rendered sheet reports every box
// at zero and would "fill the width" however it is declared.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that `useSwipeDown`
// lives in `ui.jsx` and takes the scrolling element, the exit, and whether it is
// on at all; and that jsdom dispatches touch events but computes no scrolling,
// so `scrollTop` is set directly.

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSwipeDown } from '../../src/ui.jsx'

afterEach(() => cleanup())

function Body({ onDismiss, enabled = true, at = 0 }) {
  const ref = useRef(null)
  useSwipeDown(ref, onDismiss, { enabled })
  return <div data-testid="body" ref={(el) => { ref.current = el; if (el) el.scrollTop = at }} />
}

const body = () => document.querySelector('[data-testid="body"]')

const touch = (y) => ({ touches: [{ clientY: y, identifier: 1, target: body() }] })

const dragDown = async (by) => {
  await act(async () => {
    fireEvent.touchStart(body(), touch(100))
    fireEvent.touchMove(body(), touch(100 + by))
  })
}

describe('dragging a sheet back down', () => {
  it('closes it, from the top of its body', async () => {
    const out = vi.fn()
    render(<Body onDismiss={out} />)
    await dragDown(140)
    expect(out, 'a drag down from the top of the sheet did not close it').toHaveBeenCalledTimes(1)
  })

  it('and a short drag does not — that is a reader changing their mind', async () => {
    const out = vi.fn()
    render(<Body onDismiss={out} />)
    await dragDown(20)
    expect(out, 'a 20px drag closed the sheet').not.toHaveBeenCalled()
  })

  it('and a drag part-way down a scrolled body is reading, not leaving', async () => {
    const out = vi.fn()
    render(<Body onDismiss={out} at={300} />)
    await dragDown(200)
    expect(out, 'scrolling back up inside a long sheet closed it')
      .not.toHaveBeenCalled()
  })

  it('and an upward drag is never a dismissal', async () => {
    const out = vi.fn()
    render(<Body onDismiss={out} />)
    await dragDown(-200)
    expect(out).not.toHaveBeenCalled()
  })

  it('and nothing happens where the sheet is not a sheet', async () => {
    const out = vi.fn()
    render(<Body onDismiss={out} enabled={false} />)
    await dragDown(140)
    expect(out, 'the gesture fired on a desk, where the panel is a card in the middle of the screen')
      .not.toHaveBeenCalled()
  })

  it('and it closes once, not once per frame of the drag', async () => {
    const out = vi.fn()
    render(<Body onDismiss={out} />)
    await act(async () => {
      fireEvent.touchStart(body(), touch(100))
      fireEvent.touchMove(body(), touch(240))
      fireEvent.touchMove(body(), touch(300))
      fireEvent.touchMove(body(), touch(360))
    })
    expect(out, 'the exit was taken once per touchmove past the threshold').toHaveBeenCalledTimes(1)
  })
})
