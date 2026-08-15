// Tooltip's right-click suppression, and the opt-out that had to be added
// without weakening it.
//
// The obvious opt-out — skip the suppression when a handler is passed — would
// hand the Android bug back to every caller that wanted a gesture. So the
// handler ADDS to it: preventDefault always runs, propagation is stopped
// explicitly for the opted-in control, and only then is the handler called.
// These assertions keep that ordering, because nothing about the app looks
// different if it is quietly reversed.
//
// WRITING THESE CORRECTED THE COMMENT THEY WERE WRITTEN FROM. It claimed the
// preventDefault was also what stopped a right-click on a card's own buttons
// from opening the CARD's menu. It is not: preventDefault suppresses the
// default, not the propagation, so the event does still reach useCardMenu — and
// what turns it away there is useCardMenu's own `onControl(e.target)` guard.
// Both mechanisms are real and both are needed; they are just not the same one,
// and the third assertion below is the record of which does what.
//
// The search-facets plan and the context-menu plan both need this opt-out, and
// it is written here once so the second one to land finds it already made.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Tooltip } from '../../src/ui.jsx'

// fireEvent.contextMenu returns false when a handler called preventDefault, so
// "was the platform menu suppressed" is directly observable.
const rightClick = (el) => fireEvent.contextMenu(el)

describe('a plain wrapped control', () => {
  it('still swallows the right click whole', () => {
    render(
      <Tooltip label="Share">
        <button type="button">share</button>
      </Tooltip>,
    )
    expect(rightClick(screen.getByRole('button'))).toBe(false)
  })

  // The correction. The event DOES still reach an ancestor — suppressing the
  // default is not suppressing the propagation — so a card listening above a
  // wrapped control hears the right-click and has to decide for itself. That
  // decision is useCardMenu's `onControl(e.target)` guard, and this assertion
  // exists to stop anyone "simplifying" that guard away on the belief that the
  // Tooltip already handled it.
  it('still reaches a card menu listening above, which guards itself', () => {
    const cardMenu = vi.fn()
    render(
      <div onContextMenu={cardMenu}>
        <Tooltip label="Share">
          <button type="button">share</button>
        </Tooltip>
      </div>,
    )
    rightClick(screen.getByRole('button'))
    expect(cardMenu).toHaveBeenCalledTimes(1)
  })
})

describe('a control that opts in to the gesture', () => {
  const setup = () => {
    const onContextMenu = vi.fn()
    const cardMenu = vi.fn()
    render(
      <div onContextMenu={cardMenu}>
        <Tooltip label="Search" onContextMenu={onContextMenu}>
          <button type="button">search</button>
        </Tooltip>
      </div>,
    )
    return { onContextMenu, cardMenu }
  }

  it('receives the right click', () => {
    const { onContextMenu } = setup()
    rightClick(screen.getByRole('button'))
    expect(onContextMenu).toHaveBeenCalledTimes(1)
  })

  // An opt-out that skipped preventDefault would show the browser's own menu
  // over the app's gesture on desktop, and the Android selection handles on a
  // phone.
  it('still gets no platform menu', () => {
    setup()
    expect(rightClick(screen.getByRole('button'))).toBe(false)
  })

  // Here the propagation IS stopped, unlike the plain case above, and the
  // asymmetry is the design: a control that has claimed the right-click should
  // own it outright rather than depend on every ancestor's guard being written
  // correctly. Firing both its handler and a card's would open a menu over the
  // thing it just did.
  it('does not open the card menu it may sit inside', () => {
    const { cardMenu } = setup()
    rightClick(screen.getByRole('button'))
    expect(cardMenu).not.toHaveBeenCalled()
  })

  it('leaves the ordinary click alone', () => {
    const onClick = vi.fn()
    const onContextMenu = vi.fn()
    render(
      <Tooltip label="Search" onContextMenu={onContextMenu}>
        <button type="button" onClick={onClick}>search</button>
      </Tooltip>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onContextMenu).not.toHaveBeenCalled()
  })
})
