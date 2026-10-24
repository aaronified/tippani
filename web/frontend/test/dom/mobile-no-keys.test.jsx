// No keyboard chrome on a phone.
//
// Every shortcut in this app is drawn in one of four ways: a Kbd cap (drawer rows,
// quiz buttons, MCQ options), a suffix on a Tooltip label ("Search · /"), the
// ShortcutSheet, and exactly one interpolated string (the cloze placeholder). A
// phone has none of the keys and all of the clutter, and the app's own rule for the
// drawer applies unchanged: describing a control the reader does not have is worse
// than saying nothing.
//
// BOTH DIRECTIONS ARE ASSERTED. A gate that hides the legends everywhere is not a
// fix, it is a regression with a good excuse — so every case here has a pointer
// twin proving the legend is still drawn when there is a keyboard to draw it for.
//
// The bindings themselves are untouched, which is the other half of the decision: a
// Bluetooth keyboard on a narrow window keeps working, and the omission is cosmetic
// in exactly the way Settings → Features is.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Kbd, ShortcutSheet, ToastHost, Tooltip } from '../../src/ui.jsx'
import { withShortcut } from '../../src/keys.js'
import { helpFor } from '../../src/help.jsx'

const realMatchMedia = window.matchMedia

// The breakpoint the whole shell swaps on. `matches` answers every query the same
// way, which is what the other mobile tests do — ui.jsx asks only this one.
const setViewport = (mobile) => {
  window.matchMedia = (media) => ({
    matches: mobile,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('Kbd — the key cap', () => {
  it('draws nothing on a phone', () => {
    setViewport(true)
    const { container } = render(<Kbd keys="G then L" />)
    expect(container.querySelector('kbd')).toBeNull()
    expect(container.textContent).toBe('')
  })

})

// The composed label goes to the bubble rather than into the tree, so these read
// the bubble the way hint-lifetime.test.jsx does: mount the host, hover, look.
const hover = (mobile) => {
  setViewport(mobile)
  render(
    <>
      <ToastHost />
      <Tooltip label="Search" shortcut="search">
        <button type="button">go</button>
      </Tooltip>
    </>,
  )
  fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' })
  // A HOVER LABEL WAITS TO BE ASKED (HOVER_TIP_MS in ui.jsx): a pointer has to rest
  // on the control before the bubble appears, so that crossing a bar of five
  // controls does not fire five labels. This suite is about WHAT the bubble says,
  // not when, so it waits out the delay rather than asserting about it —
  // hint-lifetime.test.jsx owns the timing.
  act(() => { vi.advanceTimersByTime(500) })
  return document.querySelector('.hint-bubble, .tp-hint, [data-hint]')?.textContent || ''
}

describe('ShortcutSheet — the whole legend', () => {
  it('does not open on a phone', () => {
    setViewport(true)
    render(<ShortcutSheet open onClose={() => {}} />)
    // Asserted against the DOCUMENT, not the render container: HelpSheet mounts in
    // a portal, so `container.firstChild` is null whether the sheet opened or not —
    // which is a check that cannot fail, and did not.
    expect(screen.queryAllByText('Keyboard shortcuts')).toHaveLength(0)
    expect(document.querySelectorAll('kbd')).toHaveLength(0)
  })

})

