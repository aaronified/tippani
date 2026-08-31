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

describe('the edge fade', () => {
  it('is absent on a row that fits, because a fade with nothing behind it is a lie', () => {
    const { container } = render(<Scroller data-testid="s">short</Scroller>)
    const el = container.firstChild
    measure(el, { size: 100, full: 100 })
    scroll(el)
    expect(el.hasAttribute('data-scroll-x')).toBe(false)
  })

  it('says "end" when the row is parked at its start and has more to the right', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 0, size: 100, full: 400 })
    scroll(el)
    expect(el.getAttribute('data-scroll-x')).toBe('end')
  })

  it('says "both" in the middle', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 150, size: 100, full: 400 })
    scroll(el)
    expect(el.getAttribute('data-scroll-x')).toBe('both')
  })

  it('says "start" at the far end, so the fade moves to the side with the content', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 300, size: 100, full: 400 })
    scroll(el)
    expect(el.getAttribute('data-scroll-x')).toBe('start')
  })

  it('tolerates the sub-pixel a scroller reports when parked at its end', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    // 299.6 + 100 is 399.6, which is not 400 and must still read as "the end".
    measure(el, { pos: 299.6, size: 100, full: 400 })
    scroll(el)
    expect(el.getAttribute('data-scroll-x')).toBe('start')
  })

  it('measures the axis it was asked for', () => {
    const { container } = render(<Scroller axis="v">tall</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 0, size: 100, full: 400, axis: 'v' })
    scroll(el)
    expect(el.getAttribute('data-scroll-v')).toBe('end')
    expect(el.hasAttribute('data-scroll-x')).toBe(false)
  })

  it('wears both attributes when a box outruns its width AND its height', () => {
    const { container } = render(<Scroller axis="both">wide and tall</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 0, size: 100, full: 400, axis: 'x' })
    measure(el, { pos: 0, size: 50, full: 500, axis: 'v' })
    scroll(el)
    expect(el.getAttribute('data-scroll-x')).toBe('end')
    expect(el.getAttribute('data-scroll-v')).toBe('end')
  })
})

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

  it('scrolls the row by the distance the pointer travelled', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 200, size: 100, full: 400 })
    down(el, 100)
    move(el, 60) // dragged 40px left ⇒ the row moves 40px right
    expect(el.scrollLeft).toBe(240)
  })

  it('ignores travel under the slop, so a shaky click stays a click', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 200, size: 100, full: 400 })
    down(el, 100)
    move(el, 98) // 2px — under the 3px threshold
    expect(el.scrollLeft).toBe(200)
    expect(el.hasAttribute('data-dragging')).toBe(false)
  })

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

  it('lets the very next click through, so one drag does not deafen the row', () => {
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
    act(() => screen.getByText('a card').click()) // swallowed
    act(() => screen.getByText('a card').click()) // must land
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('leaves touch alone, because native scrolling has momentum this cannot match', () => {
    const { container } = render(<Scroller>long</Scroller>)
    const el = container.firstChild
    measure(el, { pos: 200, size: 100, full: 400 })
    const e = new Event('pointerdown', { bubbles: true })
    Object.assign(e, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 0 })
    act(() => el.dispatchEvent(e))
    move(el, 40)
    expect(el.scrollLeft).toBe(200)
  })

  it('does not hijack a press that starts inside a field', () => {
    const { container } = render(
      <Scroller>
        <input defaultValue="select me" />
      </Scroller>,
    )
    const el = container.firstChild
    measure(el, { pos: 200, size: 100, full: 400 })
    const e = new Event('pointerdown', { bubbles: true })
    Object.assign(e, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 0 })
    act(() => el.querySelector('input').dispatchEvent(e))
    move(el, 40)
    expect(el.scrollLeft).toBe(200)
  })
})
