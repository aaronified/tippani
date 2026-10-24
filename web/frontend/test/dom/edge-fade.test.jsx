// An edge fade means the row scrolls — and it has to be TRUE when it says so.
//
// THE FAILURE THIS GUARDS. A fade is the app's only signal that a row has more
// content: no arrow, no scrollbar, no counter. So a fade painted on a row that
// fits is not a harmless decoration, it is a lie the reader can only discover by
// trying — and once one fade has lied, every other fade in the app is a maybe.
// The attribute must therefore be absent when nothing overflows, and must name
// WHICH end still has content when something does.
//
// jsdom has no layout, so `scrollWidth` and friends are all 0 and every row would
// "fit" forever. The metrics are stubbed per test instead; what is under test is
// the decision the hook makes from them, which is the part that can be wrong.
import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { Scroller } from '../../src/ui.jsx'

// A real rAF would leave the assertion racing the frame. Run the callback now.
let rafSpy
beforeEach(() => {
  rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
})
afterEach(() => rafSpy.mockRestore())

// Give a node the metrics jsdom will not compute. `scrollLeft`/`scrollTop` stay
// writable so a test can park the row somewhere and fire a scroll.
function measure(el, { pos = 0, size = 100, full = 100, axis = 'x' } = {}) {
  const [posKey, sizeKey, fullKey] =
    axis === 'x'
      ? ['scrollLeft', 'clientWidth', 'scrollWidth']
      : ['scrollTop', 'clientHeight', 'scrollHeight']
  let at = pos
  Object.defineProperty(el, posKey, {
    configurable: true,
    get: () => at,
    set: (v) => {
      at = v
    },
  })
  Object.defineProperty(el, sizeKey, { configurable: true, get: () => size })
  Object.defineProperty(el, fullKey, { configurable: true, get: () => full })
}

function scroll(el) {
  act(() => {
    el.dispatchEvent(new Event('scroll'))
  })
}

describe('press-and-drag', () => {
  // `overflow` alone is a touch-only affordance: a plain mouse has no sideways
  // gesture at all, so without this the fade promises content it will not give up.
  function down(el, x = 0, y = 0) {
    const e = new Event('pointerdown', { bubbles: true })
    Object.assign(e, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
    act(() => el.dispatchEvent(e))
    return e
  }
  function move(el, x, y = 0) {
    const e = new Event('pointermove', { bubbles: true, cancelable: true })
    Object.assign(e, { pointerId: 1, clientX: x, clientY: y })
    act(() => el.dispatchEvent(e))
    return e
  }
  function up(el) {
    const e = new Event('pointerup', { bubbles: true })
    Object.assign(e, { pointerId: 1 })
    act(() => el.dispatchEvent(e))
  }

  it('swallows the click that ends a drag, so dragging a row never opens a card', () => {
    const opened = vi.fn()
    const { container } = render(
      <Scroller>
        <button type="button" onClick={opened}>
          a card
        </button>
      </Scroller>,
    )
    const el = container.firstChild
    measure(el, { pos: 0, size: 100, full: 400 })
    down(el, 100)
    move(el, 40)
    up(el)
    act(() => screen.getByText('a card').click())
    expect(opened).not.toHaveBeenCalled()
  })
})

// POINTER CAPTURE IS A DRAG'S TOOL, AND IT IS TAKEN WHEN THE DRAG STARTS.
//
// WHAT WENT WRONG. The hook used to capture on pointerdown — the obvious place,
// and the reason the move/up listeners can sit on the scroller instead of on the
// document. But pointer capture retargets the CLICK as well: Gecko dispatches it
// at the capturing element rather than at the button under the finger, so React,
// which reads the native event's path, never saw the button and never ran its
// handler. Every clickable thing inside every scroller in the app was dead — the
// rail's nine destinations, the annotation tables' rows, the Stats calendar, the
// cast strip — and the two rail rows that sit OUTSIDE the scrolling <nav> still
// worked, which is how it was found.
//
// jsdom implements neither pointer capture nor the retargeting, so it cannot
// reproduce the symptom. What it CAN pin is the cause, which is the only part
// this file could have got wrong: capture must not be taken by a press alone.
