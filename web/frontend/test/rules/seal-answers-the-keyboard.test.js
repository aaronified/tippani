// THE LAST GESTURE IN THE APP WITH NO EQUIVALENT.
//
// docs/plans/access.md asks for "a named, focusable equivalent for every gesture".
// An inventory of every gesture tippani ships found seven of eight already had
// one, and each was checked at its own line rather than taken from the inventory:
// the drawer's swipe-close has a real <button> scrim (App.jsx), the Toggle's thumb
// drag has <button role="tab"> options, the Select's drag-to-pick answers Arrow
// and Enter, the touch tooltip answers focus, the phone sheet's step hangs off a
// <button className="tp-sheet-grip"> that says so in its own comment, and the
// card's context menu renders "the SAME list the row and the ⋯ render"
// (Library.jsx). Exactly ONE could be done only by dragging: putting the seal
// where you want it on a quote.
//
// AND IT IS NOT DECORATION. The position PERSISTS — `onMove` writes sticker_x and
// sticker_y, normalised to the block width so it survives a reflow — so this was a
// stored property of somebody's own quote that a keyboard, a switch or a
// head-pointer could not set at all.
//
// WHY THIS IS A SOURCE TEST AND NOT A RENDER, stated because the weaker choice
// would look the same from outside. The flowed layout needs real text metrics and
// a dynamic import (`pretext`); under jsdom neither happens, so `FlowQuote` takes
// its FALLBACK branch and draws a floated seal that carries no drag at all. A
// render test would therefore have exercised the path that has no gesture to
// equal, passed, and proved nothing about the one that does. What can be checked
// honestly is the arithmetic (exported, below) and the props on the element.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { clampSealCentre, sealNudge } from '../../src/flow.jsx'
import { SRC } from '../src-files.js'

const FLOW = readFileSync(join(SRC, 'flow.jsx'), 'utf8')
// A block roughly the shape of a real card: 600 wide, 300 tall, a 21px seal.
const BOX = { r: 21, W: 600, naturalH: 300 }

describe('where a seal may sit', () => {
  it('is ONE answer, called by the relayout, the drag and the keys', () => {
    // The whole reason this is a function. Three copies of a clamp is how a
    // keyboard comes to reach somewhere a pointer cannot.
    const calls = FLOW.match(/clampSealCentre\(/g) || []
    expect(calls.length, 'clampSealCentre has lost a caller, or gained a second copy')
      .toBe(4) // the definition plus its three callers
    // And the arithmetic itself appears ONCE — inside the function. A second
    // occurrence is a copy somebody wrote out by hand instead of calling it.
    const written = FLOW.match(/Math\.min\([^)]*naturalH - [^)]*OVERFLOW/g) || []
    expect(written.length, 'the clamp was written out by hand again instead of calling the function')
      .toBe(1)
  })

  it('holds the seal inside the block, give or take the gutter it may spill into', () => {
    const far = clampSealCentre(99999, 99999, BOX)
    expect(far.cx).toBe(BOX.W - BOX.r + 10)
    expect(far.cy).toBe(BOX.naturalH - BOX.r + 10)
    const near = clampSealCentre(-99999, -99999, BOX)
    expect(near.cx).toBe(BOX.r - 10)
    expect(near.cy).toBe(BOX.r - 10)
  })

  it('leaves a position that is already legal exactly where it is', () => {
    expect(clampSealCentre(300, 150, BOX)).toEqual({ cx: 300, cy: 150 })
  })

  it('and never returns a ceiling below its own floor, on a block shorter than the seal', () => {
    // THE DEGENERATE CASE THE TWO OLD COPIES DISAGREED ABOUT. The relayout's
    // version had no `Math.max(r, …)`, so on a very short block its ceiling fell
    // below its floor and the seal landed up to OVERFLOW pixels from where the
    // drag would have put it.
    const squat = { r: 40, W: 600, naturalH: 20 }
    const { cy } = clampSealCentre(500, 500, squat)
    expect(cy, 'the clamp put the seal above its own floor').toBeGreaterThanOrEqual(squat.r - 10)
  })
})

// A block roughly the shape of a real card, with the seal in the middle.
const MID = { ...BOX, cx: 300, cy: 150, collapsed: false }

describe('what one arrow press does', () => {
  // THE REAL BEHAVIOUR, against real numbers. Everything a reader can get wrong
  // by pressing a key is here; the component is three side effects around it.
  it('moves the axis it was asked to, in the direction it was asked to', () => {
    expect(sealNudge(MID, 'ArrowRight', false).x).toBeGreaterThan(0.5)
    expect(sealNudge(MID, 'ArrowLeft', false).x).toBeLessThan(0.5)
    expect(sealNudge(MID, 'ArrowDown', false).y).toBeGreaterThan(0.25)
    expect(sealNudge(MID, 'ArrowUp', false).y).toBeLessThan(0.25)
    // And leaves the other axis exactly alone — a nudge that drifted sideways
    // would make a seal impossible to line up.
    expect(sealNudge(MID, 'ArrowRight', false).y).toBe(0.25)
    expect(sealNudge(MID, 'ArrowDown', false).x).toBe(0.5)
  })

  it('goes further with Shift, so crossing a block is not fifty presses', () => {
    const small = sealNudge(MID, 'ArrowRight', false).x - 0.5
    const big = sealNudge(MID, 'ArrowRight', true).x - 0.5
    expect(big).toBeGreaterThan(small)
    // 2% and 10% of the width, in the stored fraction.
    expect(small).toBeCloseTo(0.02, 6)
    expect(big).toBeCloseTo(0.1, 6)
  })

  it('and the step is the same FRACTION at any width, not the same pixels', () => {
    // THE ASSERTION ABOVE CANNOT SEE THIS, and a mutation proved it: at a 600px
    // block a 12px step and a 2%-of-width step are the same number, so swapping
    // one for the other passed. The property that matters — a press covers the
    // same share of the line on a phone as on a desk, because the stored
    // coordinate is a share — only shows at two widths.
    const at = (W) => {
      const st = { r: 21, W, naturalH: W / 2, cx: W / 2, cy: W / 4, collapsed: false }
      return sealNudge(st, 'ArrowRight', false).x - 0.5
    }
    expect(at(360), 'a phone-width block moves by a different share').toBeCloseTo(0.02, 6)
    expect(at(600)).toBeCloseTo(0.02, 6)
    expect(at(1100), 'a desk-width block moves by a different share').toBeCloseTo(0.02, 6)
    expect(at(360)).toBeCloseTo(at(1100), 6)
  })

  it('cannot be walked anywhere a drag could not go', () => {
    // A keyboard reaching past the clamp would be two answers to where a seal may
    // sit, and the one a pointer could reach would be the smaller.
    let at = MID
    for (let i = 0; i < 60; i++) {
      const n = sealNudge({ ...at, cx: at.cx, cy: at.cy }, 'ArrowRight', true)
      at = { ...at, cx: n.x * BOX.W, cy: n.y * BOX.W }
    }
    const edge = clampSealCentre(1e9, at.cy, BOX)
    expect(at.cx, 'the keyboard walked the seal past the edge a drag stops at').toBeCloseTo(edge.cx, 6)
  })

  it('answers nothing else — not Enter, not a letter, not Tab', () => {
    for (const k of ['Enter', 'Escape', 'a', 'Tab', ' ', 'PageDown', 'Home']) {
      expect(sealNudge(MID, k, false), `${k} moved the seal`).toBeNull()
    }
  })

  it('and refuses on the collapsed badge, exactly as the drag does', () => {
    expect(sealNudge({ ...MID, collapsed: true }, 'ArrowRight', false)).toBeNull()
    expect(sealNudge(null, 'ArrowRight', false)).toBeNull()
  })
})

describe('the seal a keyboard can move', () => {
  // Read off the source because the element only exists on the flowed path, which
  // jsdom cannot reach. Each assertion names a way the equivalent could be present
  // and useless.
  it('is a real control, named, and only when there is something to move', () => {
    expect(FLOW, 'the seal is not a control, so nothing can focus it')
      .toMatch(/const Seal = canDrag \? 'button' : 'span'/)
    expect(FLOW, 'the seal is a control with no name')
      .toMatch(/'aria-label': t\('common\.sticker\.move\.aria'\)/)
    // The name and the keys arrive together, gated on the same flag as the drag —
    // a focus stop on the collapsed badge would cost every keyboard reader a press
    // and give them nothing.
    expect(FLOW, 'the keyboard handler is not gated on the same flag as the drag')
      .toMatch(/canDrag\s*\n?\s*\?\s*\{ type: 'button', onKeyDown: onSealKey/)
  })

  it('routes its keys through the tested arithmetic rather than its own', () => {
    // The one thing a source read answers honestly: that the handler on the
    // element is the function proved above, not a second copy of the same idea.
    const key = FLOW.slice(FLOW.indexOf('const onSealKey'), FLOW.indexOf('const size = state'))
    expect(key, 'the key handler does its own arithmetic instead of calling sealNudge')
      .toContain('sealNudge(stateRef.current, e.key, e.shiftKey)')
    expect(key, 'the handler works out a step of its own').not.toMatch(/0\.02|ArrowLeft/)
  })

  it('SAVES the move, which is the whole point of the gesture it replaces', () => {
    // A nudge that moved the seal and did not persist would look like it worked
    // and be gone on reload — worse than no equivalent, because it lies.
    const key = FLOW.slice(FLOW.indexOf('const onSealKey'), FLOW.indexOf('const size = state'))
    expect(key, 'an arrow press moves the seal and never stores it').toContain('onMoveRef.current(')
    expect(key, 'the flow is not re-laid out, so the text would not move around the seal')
      .toContain('relayoutRef.current()')
  })

  it('and the fallback seal needs no equivalent, because it carries no gesture', () => {
    // Under prefers-reduced-motion, or before `pretext` loads, the seal is floated
    // and cannot be dragged by anyone. Nothing to equal — and this is asserted
    // rather than assumed, because "it has no handler" is exactly the kind of
    // claim that stops being true quietly.
    const fb = FLOW.slice(FLOW.indexOf('flow-fallback'))
    expect(fb, 'the fallback seal gained a drag and now needs a keyboard too')
      .not.toContain('onPointerDown')
  })
})
