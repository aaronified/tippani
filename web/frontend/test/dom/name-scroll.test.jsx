// NameScroll — a name that scrolls under the fade rather than being cut short.
//
// WHAT THE TEST CAN AND CANNOT SEE. jsdom has no layout, so scrollWidth is always
// clientWidth and the fade never fires here — which means the useful assertions
// are the ones about the CONTRACT rather than the pixels: the whole name is in the
// document, nothing is abbreviated, the element is the scroller (so the fade has
// something to attach to), and a click through it still reaches what is inside.
// The pixels are the browser harness's job (make typescale).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NameScroll } from '../../src/ui.jsx'

afterEach(() => cleanup())

const LONG = 'Bibhutibhushan Bandyopadhyay'

describe('a name that will not fit', () => {
  it('is in the document in full, not abbreviated', () => {
    render(<NameScroll>{LONG}</NameScroll>)
    // The exact string, not a prefix: an assertion on a prefix would pass on an
    // element that had genuinely dropped the end.
    expect(screen.getByText(LONG).textContent).toBe(LONG)
  })

  it('is itself the scroller, so the fade has something to sit on', () => {
    render(<NameScroll>{LONG}</NameScroll>)
    expect(screen.getByText(LONG).className).toContain('name-scroll')
  })

  it('keeps the caller class beside its own', () => {
    render(<NameScroll className="cast-opt-name">{LONG}</NameScroll>)
    const el = screen.getByText(LONG)
    expect(el.className).toContain('name-scroll')
    expect(el.className).toContain('cast-opt-name')
  })

  // A NAME IS OFTEN ALSO A DOOR. Wrapping one must not swallow the click that
  // opens it — the failure that took out every scroller in the app once already,
  // when pointer capture was taken on press rather than on movement.
  it('does not swallow a click on what it wraps', () => {
    const onClick = vi.fn()
    render(
      <NameScroll>
        <button type="button" onClick={onClick}>{LONG}</button>
      </NameScroll>,
    )
    fireEvent.click(screen.getByText(LONG))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('can be an element other than a span where a span is wrong', () => {
    render(<NameScroll as="h2">{LONG}</NameScroll>)
    expect(screen.getByText(LONG).tagName).toBe('H2')
  })
})
