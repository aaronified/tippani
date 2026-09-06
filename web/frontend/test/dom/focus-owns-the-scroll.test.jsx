// A SURFACE THAT TAKES FOCUS TAKES IT WHOLE.
//
// THE REPORT, the owner's, over a screenshot of a character sheet standing on a
// film's quote list: "there is no problem on the popup, but the background app.
// it can still scroll! and the chevron from bottom locations is visible above
// the popup as well." Then, as the rule: "stop scrolling screens that are not in
// focus" and "the chevron will only appear when a long scroll surface is in
// focus and has been scrolled significantly down".
//
// THE TWO ARE ONE FACT ASKED TWICE. While something covers the page, the page is
// not what the reader is scrolling — so it must not scroll, and the key that
// offers to scroll it back to the top must not be on screen offering.
//
// WHY THE LOCK LOOKED PRESENT AND WAS NOT. `PanelHost` has called
// `useBodyScrollLock` since it was written, and the hook hid the overflow of
// `<body>`. The element that scrolls a standards-mode document is `<html>`, so
// the lock was hiding the overflow of a box that was not the scroller and the
// page went on moving. Nothing in the source looked missing, which is why this
// asks the DOCUMENT what it can do rather than asking the component what it
// calls.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that
// `useBodyScrollLock`, `useOverlayOpen` and `useBackToTop` live in `ui.jsx`; and
// that jsdom has no layout, so "can this scroll" is read off the scrolling
// element's own overflow and not off a rectangle.

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useBackToTop, useBodyScrollLock } from '../../src/ui.jsx'

afterEach(() => {
  cleanup()
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
})

// An overlay is anything that locks; this is the smallest one there can be.
function Overlay({ on }) {
  useBodyScrollLock(on)
  return null
}

function Key() {
  const { show } = useBackToTop({ enabled: true })
  return <span data-testid="key">{show ? 'on' : 'off'}</span>
}

const showing = () => document.querySelector('[data-testid="key"]').textContent

// The document is tall and scrolled far enough that the key has every reason to
// be up: `useBackToTop` wants a scrollable height over 260 and an offset past a
// quarter of it.
const scrollFarDown = async () => {
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4000, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
  window.scrollY = 2000
  await act(async () => { fireEvent.scroll(window) })
  // rAF is what the hook throttles on, and jsdom runs it on a timer.
  await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
}

describe('the page behind an overlay', () => {
  it('cannot scroll — the element that actually scrolls is the one locked', () => {
    render(<Overlay on />)
    const scroller = document.scrollingElement || document.documentElement
    expect(scroller.style.overflow,
      'the page behind an open overlay can still be scrolled: the lock hid the overflow of a box that is not the scroller')
      .toBe('hidden')
  })

  it('and can scroll again once the overlay goes', () => {
    const { rerender } = render(<Overlay on />)
    rerender(<Overlay on={false} />)
    const scroller = document.scrollingElement || document.documentElement
    expect(scroller.style.overflow, 'the page stayed frozen after the overlay closed').toBe('')
  })

  it('and stays locked while a SECOND overlay is still up', () => {
    const { rerender } = render(<div><Overlay on /><Overlay on /></div>)
    rerender(<div><Overlay on /><Overlay on={false} /></div>)
    const scroller = document.scrollingElement || document.documentElement
    expect(scroller.style.overflow, 'closing one of two overlays unfroze the page under the other').toBe('hidden')
  })
})

describe('the key back to the top', () => {
  it('is up when the page itself is what has been scrolled', async () => {
    render(<Key />)
    await scrollFarDown()
    expect(showing(), 'the key never appears, so this case cannot see the one below it').toBe('on')
  })

  it('goes away the moment something covers the page', async () => {
    const { rerender } = render(<div><Key /><Overlay on={false} /></div>)
    await scrollFarDown()
    expect(showing()).toBe('on')
    await act(async () => { rerender(<div><Key /><Overlay on /></div>) })
    expect(showing(),
      'the key draws over the sheet and offers to scroll a surface that is not in focus')
      .toBe('off')
  })

  it('and comes back when the page is the reader\'s again', async () => {
    const { rerender } = render(<div><Key /><Overlay on /></div>)
    await scrollFarDown()
    expect(showing()).toBe('off')
    await act(async () => { rerender(<div><Key /><Overlay on={false} /></div>) })
    await scrollFarDown()
    expect(showing(), 'the key never returned after the sheet closed').toBe('on')
  })
})
