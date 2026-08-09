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
  it('opens below when there is room, which is the ordinary case', () => {
    const p = placeAnchored(trigger(100), PHONE, 300, 200)
    expect(p.down).toBe(true)
    expect(p.top).toBe(144 + POPUP_GAP)
    expect(p.left).toBe(20)
  })

  it('flips above when the trigger is near the bottom', () => {
    // THE REPORTED BUG. A trigger at y=700 on an 844px screen leaves 100px
    // below and 692px above; a 300px list must go up.
    const p = placeAnchored(trigger(700), PHONE, 300, 200)
    expect(p.down).toBe(false)
    // Sits its own height above the trigger, not at the top of the screen.
    expect(p.top).toBe(700 - POPUP_GAP - 300)
  })

  it('caps its height to the room available rather than running off', () => {
    // Flipping alone is not enough: a 40-option list is taller than the window
    // on either side, and without a cap it hangs off whichever way it opens.
    const p = placeAnchored(trigger(700), PHONE, 2000, 200)
    expect(p.maxHeight).toBe(700 - POPUP_GAP - POPUP_MARGIN)
    // It still starts inside the screen, never above the top edge.
    expect(p.top).toBeGreaterThanOrEqual(POPUP_MARGIN)
  })

  it('never places itself off the top when nothing fits anywhere', () => {
    // A short viewport with the trigger dead centre: neither side fits, so the
    // cap does the work and the popup must still begin on screen.
    const p = placeAnchored(trigger(150), { w: 390, h: 360 }, 1200, 200)
    expect(p.top).toBeGreaterThanOrEqual(POPUP_MARGIN)
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(360)
  })

  it('does not thrash between sides when neither side fits', () => {
    // Flipping "whenever it does not fit" would send this one up, where there
    // is LESS room. The rule is: flip only if the other side is roomier.
    const p = placeAnchored(trigger(200), { w: 390, h: 500 }, 900, 200)
    // 256 below vs 188 above — below wins despite fitting neither.
    expect(p.down).toBe(true)
    expect(p.maxHeight).toBeGreaterThan(200)
  })

  it('slides along the edge instead of hanging off the right', () => {
    // Opened from a corner: a 260px menu anchored at x=300 on a 390px screen
    // would end at 560. It is pulled back inside.
    const p = placeAnchored(trigger(100, 300, 44), PHONE, 200, 260)
    expect(p.left).toBe(390 - 260 - POPUP_MARGIN)
    expect(p.left).toBeGreaterThanOrEqual(POPUP_MARGIN)
  })

  it('never pushes itself off the LEFT while fixing the right', () => {
    // A popup wider than the viewport clamps to the margin rather than going
    // negative — the clamp order matters and this is the case that catches it.
    const p = placeAnchored(trigger(100, 300, 44), { w: 320, h: 844 }, 200, 900)
    expect(p.left).toBe(POPUP_MARGIN)
  })

  it('takes the trigger width when asked, and its own when not', () => {
    // A select panel narrower than its trigger looks like a mistake; a menu as
    // wide as a 44px glyph button is unreadable. So it is a choice per popup.
    const wide = placeAnchored(trigger(100), PHONE, 200, 90, { matchWidth: true })
    expect(wide.width).toBe(200)
    const menu = placeAnchored(trigger(100, 20, 44), PHONE, 200, 160)
    expect(menu.width).toBeUndefined()
    expect(menu.minWidth).toBeUndefined()
  })

  it("treats the trigger width as a floor under matchWidth: 'min'", () => {
    // What `min-width: 100%` used to mean, and which stops meaning anything
    // once the panel is portalled — `100%` then refers to <body>. A long option
    // may still grow the panel past its trigger.
    const p = placeAnchored(trigger(100), PHONE, 200, 90, { matchWidth: 'min' })
    expect(p.minWidth).toBe(200)
    expect(p.width).toBeUndefined()
    // And the floor counts when clamping, or a panel widened to the trigger
    // could still be pushed off the right edge.
    const corner = placeAnchored(trigger(100, 260, 120), PHONE, 200, 40, { matchWidth: 'min' })
    expect(corner.left + 120).toBeLessThanOrEqual(390 - POPUP_MARGIN)
  })

  it('aligns its right edge to the trigger when asked', () => {
    // For a menu hanging off a control at the end of a row, where opening
    // rightwards would immediately need clamping.
    const p = placeAnchored(trigger(100, 200, 44), PHONE, 200, 160, { align: 'end' })
    expect(p.left).toBe(244 - 160)
  })

  it('honours prefer: above, and flips it down near the top', () => {
    const up = placeAnchored(trigger(600), PHONE, 200, 200, { prefer: 'above' })
    expect(up.down).toBe(false)
    const forced = placeAnchored(trigger(10), PHONE, 200, 200, { prefer: 'above' })
    expect(forced.down).toBe(true)
  })

  it('flips rather than cap to a sliver when only one side is cramped', () => {
    // A trigger 30px from the bottom has 18px below and 758px above. The cap is
    // not what saves this one — the flip is.
    const p = placeAnchored(trigger(770), PHONE, 600, 200)
    expect(p.down).toBe(false)
    expect(p.maxHeight).toBe(770 - POPUP_GAP - POPUP_MARGIN)
  })

  it('keeps a usable minimum when BOTH sides are cramped', () => {
    // The floor's actual job, and it needs a case where flipping cannot help:
    // a 200px-tall window (a landscape phone with the keyboard up) leaves 64px
    // below and 68px above. Capping to 68 is a two-line window to scroll a long
    // list inside, so the floor wins and the popup overlaps its own trigger —
    // which is the better of two bad options, and why the floor exists.
    const p = placeAnchored(trigger(80), { w: 390, h: 200 }, 600, 200, { minHeight: 120 })
    expect(p.maxHeight).toBe(120)
    expect(p.maxHeight).toBeGreaterThan(68) // deliberately exceeds the real room
    expect(p.top).toBe(POPUP_MARGIN) // still clamped on screen
  })
})
