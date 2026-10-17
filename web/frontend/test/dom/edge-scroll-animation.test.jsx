// A SCROLLER'S FADE ANSWERS TO WHERE ITS CONTENT ENDS UP, NOT WHERE IT IS MID-ENTRANCE.
//
// What a reader saw: the quiz popup's body wore a bottom fade "always, no matter how
// small the screen is", with nothing to scroll. The card enters rising 6px, the
// scroller measured it during the rise (6px of overflow, past the 1px slack), and
// when the animation ended nothing resized, so nothing measured again: the fade
// stayed on over content that fitted.
//
// jsdom has no layout, so the box is told what a browser would report, and the test
// presses what a browser does: the scroller is measured while the child is displaced,
// and then the child lands.
//
// WHAT THIS KNOWS, declared: the `data-scroll-v` attribute the fade is drawn from
// (it is what index.css keys on), the Scroller component, and the animationend event.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

import { Scroller } from '../../src/ui.jsx'

afterEach(() => cleanup())

function boxOf(el, { client, full }) {
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => client })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => full.value })
}

describe('the vertical fade of a scroller with an entering child', () => {
  it('goes away when the entrance ends and the content fits', async () => {
    const full = { value: 106 } // the child, 6px displaced mid-rise, over a 100px box
    const { container } = render(
      <Scroller axis="v" className="body">
        <div className="card">hello</div>
      </Scroller>,
    )
    const body = container.querySelector('.body')
    boxOf(body, { client: 100, full })
    // Measured mid-rise: a ResizeObserver or the mount would have done this.
    fireEvent.scroll(body)
    await new Promise((r) => requestAnimationFrame(r))
    expect(body.getAttribute('data-scroll-v'), 'the displaced child should read as overflow').toBe('end')

    // The animation ends; the content is 100px; nothing resized.
    full.value = 100
    fireEvent.animationEnd(container.querySelector('.card'))
    await new Promise((r) => requestAnimationFrame(r))
    expect(body.getAttribute('data-scroll-v'), 'the fade stayed on over content that fits').toBeNull()
  })

  it('stays on when the content really overflows', async () => {
    const full = { value: 400 }
    const { container } = render(
      <Scroller axis="v" className="body">
        <div className="card">hello</div>
      </Scroller>,
    )
    const body = container.querySelector('.body')
    boxOf(body, { client: 100, full })
    fireEvent.scroll(body)
    await new Promise((r) => requestAnimationFrame(r))
    fireEvent.animationEnd(container.querySelector('.card'))
    await new Promise((r) => requestAnimationFrame(r))
    expect(body.getAttribute('data-scroll-v')).toBe('end')
  })
})
