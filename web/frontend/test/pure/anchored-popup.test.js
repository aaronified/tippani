// A dropdown stays on the screen.
//
// The bug: every popup in the app placed itself in CSS — `position: absolute;
// top: calc(100% + 4px)` — which is right exactly once, when there is room
// below the trigger. On a phone, opening a Select near the bottom of the screen
// rendered its options below the fold, so choosing one meant scrolling the page
// to reach a menu that was supposed to be in front of you.
//
// placeAnchored is the arithmetic, separated from the DOM on purpose. jsdom
// reports every rect as zeros, so a test driving this through the hook would be
// asserting that 0 fits inside 0 — which passes, and means nothing. The part
// that can actually be wrong is which side, how tall and how far along the
// edge, and that is all here.

import { describe, expect, it } from 'vitest'
import { placeAnchored, POPUP_GAP, POPUP_MARGIN } from '../../src/ui.jsx'

// A phone, portrait.
const PHONE = { w: 390, h: 844 }
// One trigger, 44px tall (the standard control height), 200px wide.
const trigger = (top, left = 20, width = 200) => ({
  top,
  bottom: top + 44,
  left,
  right: left + width,
  width,
})

describe('placeAnchored', () => {
  it('flips above when the trigger is near the bottom', () => {
    // THE REPORTED BUG. A trigger at y=700 on an 844px screen leaves 100px
    // below and 692px above; a 300px list must go up.
    const p = placeAnchored(trigger(700), PHONE, 300, 200)
    expect(p.down).toBe(false)
    // Sits its own height above the trigger, not at the top of the screen.
    expect(p.top).toBe(700 - POPUP_GAP - 300)
  })

  it('slides along the edge instead of hanging off the right', () => {
    // Opened from a corner: a 260px menu anchored at x=300 on a 390px screen
    // would end at 560. It is pulled back inside.
    const p = placeAnchored(trigger(100, 300, 44), PHONE, 200, 260)
    expect(p.left).toBe(390 - 260 - POPUP_MARGIN)
    expect(p.left).toBeGreaterThanOrEqual(POPUP_MARGIN)
  })
})
