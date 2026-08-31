// A rest state may not depend on anything firing.
//
// THE RULE, and the test the design pack states for it: disable every animation and
// tap the control — if what you tapped is not visible, the entrance is holding the
// rest state hostage. An entrance is a flourish on the way to a state; it is never
// the thing that produces the state. The failure it guards is total rather than
// cosmetic: content that animates in from `opacity: 0` and never gets its cue is not
// a missing animation, it is a blank page with no error and nothing to click.
//
// `.reveal` is the only place in this app where a rest state is withheld pending a
// signal — `opacity: 0` until `useReveal` adds `is-in` — so it is where the rule can
// actually be broken, and this pins the three ways out of it.
import { render } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'

import { useReveal } from '../../src/ui.jsx'

function Revealed() {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal">
      the words
    </div>
  )
}

const realIO = globalThis.IntersectionObserver
const realMM = window.matchMedia
afterEach(() => {
  globalThis.IntersectionObserver = realIO
  window.matchMedia = realMM
  vi.restoreAllMocks()
})

function withReducedMotion(reduce) {
  window.matchMedia = (q) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
}

describe('the entrance rule', () => {
  it('shows the words at once when the reader has asked for no motion', () => {
    withReducedMotion(true)
    const { container } = render(<Revealed />)
    // Not "eventually", and not after a scroll: a reader who turned motion off has
    // turned off the only thing that would have delivered the content.
    expect(container.firstChild.classList.contains('is-in')).toBe(true)
  })

  it('shows the words when the browser has no IntersectionObserver to fire', () => {
    withReducedMotion(false)
    delete globalThis.IntersectionObserver
    const { container } = render(<Revealed />)
    // The fallback runs its check immediately rather than waiting for a scroll that
    // may never come — on a screen shorter than the viewport, there is no scroll.
    expect(container.firstChild.classList.contains('is-in')).toBe(true)
  })

  it('still waits for the cue when there IS one, so the entrance is not pointless', () => {
    withReducedMotion(false)
    let fire = null
    globalThis.IntersectionObserver = class {
      constructor(cb) {
        fire = cb
      }
      observe() {}
      disconnect() {}
    }
    const { container } = render(<Revealed />)
    expect(container.firstChild.classList.contains('is-in')).toBe(false)
    fire([{ isIntersecting: true }])
    expect(container.firstChild.classList.contains('is-in')).toBe(true)
  })
})
