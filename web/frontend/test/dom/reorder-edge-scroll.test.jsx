// DRAGGING A ROW NEAR THE EDGE OF THE SCREEN SCROLLS THE PAGE.
//
// A list of two hundred passages does not fit on a screen, so a drag that cannot scroll cannot reach
// the other end of it. The scroll is a frame loop that runs while the pointer is held, so a pointer
// held still near an edge keeps scrolling, one in the middle does not, and letting go stops it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useRowReorder } from '../../src/reorder.js'

function List() {
  const r = useRowReorder(() => {})
  return (
    <div ref={r.listRef}>
      {[0, 1, 2].map((i) => (
        <div key={i} {...r.rowProps(i)}>
          <button type="button" aria-label={`grip ${i}`} {...r.gripProps(i)} />
        </div>
      ))}
    </div>
  )
}

let frames
beforeEach(() => {
  frames = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  window.scrollBy = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

const runFrame = () => frames.shift()?.()
const drag = (y) => {
  render(<List />)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'grip 1' }), { button: 0, clientY: y, pointerId: 1 })
}

describe('a row dragged near the edge', () => {
  it('scrolls the page up while the pointer is held near the top', () => {
    drag(10)
    runFrame()
    runFrame()
    expect(window.scrollBy).toHaveBeenCalledWith(0, -16)
    expect(window.scrollBy).toHaveBeenCalledTimes(2)
  })

  it('scrolls down while the pointer is held near the bottom', () => {
    drag(window.innerHeight - 10)
    runFrame()
    expect(window.scrollBy).toHaveBeenCalledWith(0, 16)
  })

  it('does not scroll while the pointer is in the middle', () => {
    drag(window.innerHeight / 2)
    runFrame()
    expect(window.scrollBy).not.toHaveBeenCalled()
  })

  it('stops when the pointer is let go', () => {
    drag(10)
    fireEvent.pointerUp(screen.getByRole('button', { name: 'grip 1' }), { clientY: 10, pointerId: 1 })
    runFrame()
    expect(window.scrollBy).not.toHaveBeenCalled()
  })
})
