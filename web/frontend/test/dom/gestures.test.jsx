// The gesture clips, and the rule that keeps them honest.
//
// Eleven clips exist as a library; the app binds two. The failure this file exists
// to prevent is the one `keys.js` already had caught for it once — a legend printed
// for something with no handler behind it. Five unbound keys were listed in the
// first cut of the shortcut sheet, and every one of them was a promise printed on a
// button. A gesture clip is exactly the same promise, except a reader cannot even
// tell they pressed it wrong: they long-press, nothing happens, and there is
// nowhere to look.
//
// So: the library may hold anything, and the INTERFACE may only reference what the
// app implements. That asymmetry is the whole point, and it is asserted from the
// source rather than from a list somebody has to remember to update.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GESTURES, GESTURE_LABEL, Gesture, GestureChip, IMPLEMENTED } from '../../src/gestures.jsx'

// TIPPANI_SRC, not cwd — the seam favourite-tools, icon-imports and infodot-copy
// all read the source through.
const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const src = (f) => readFileSync(join(SRC, f), 'utf8')

describe('the library', () => {
  it('holds all eleven, each with a label', () => {
    expect(GESTURES).toHaveLength(11)
    for (const k of GESTURES) {
      expect(GESTURE_LABEL[k], `${k} has no label`).toBeTruthy()
    }
  })

  it('names only the two the app actually binds as implemented', () => {
    // long-press: ui.jsx's 500ms hold, and every card's menu.
    // swipe-left: App.jsx's drawer close, and only leftward — swipe-to-open is
    // deliberately absent because the left screen edge is the OS back gesture.
    expect(IMPLEMENTED).toEqual(['long-press', 'swipe-left'])
    for (const k of IMPLEMENTED) expect(GESTURES).toContain(k)
  })

  // The claim above, checked against the tree rather than trusted. If a pinch
  // handler ever lands, this fails and asks for the clip to be promoted — which is
  // the right direction for this test to break in.
  it('and the app really does not handle a pinch', () => {
    const shell = src('App.jsx') + src('ui.jsx')
    expect(shell).not.toMatch(/onTouchStart|touchmove|gesturechange/i)
    expect(shell.toLowerCase()).not.toContain('pinch')
  })

  it('draws nothing for a kind it does not have, rather than an error box', () => {
    const { container } = render(<Gesture kind="somersault" />)
    expect(container.firstChild).toBeNull()
    expect(render(<GestureChip kind="somersault" />).container.firstChild).toBeNull()
  })
})

describe('what each clip draws', () => {
  const svg = (kind) => render(<Gesture kind={kind} />).container.querySelector('svg')

  it('labels itself for a screen reader with the gesture name', () => {
    expect(svg('long-press').getAttribute('aria-label')).toBe('Long press')
    expect(svg('swipe-left').getAttribute('role')).toBe('img')
  })

  it('gives long press a ring, because its meaning is duration not travel', () => {
    expect(svg('long-press').querySelector('.g-ring')).toBeTruthy()
    expect(svg('long-press').querySelector('.g-move')).toBeNull()
  })

  it('gives a swipe a moving tip and a trail to move along', () => {
    const s = svg('swipe-left')
    expect(s.querySelector('.g-move')).toBeTruthy()
    expect(s.querySelector('line')).toBeTruthy()
    expect(s.querySelector('.g-ring')).toBeNull()
  })

  it('points the four swipes in four different directions', () => {
    const dir = (k) => {
      const s = svg(k)
      return `${s.style.getPropertyValue('--gd')},${s.style.getPropertyValue('--gdy')}`
    }
    const dirs = ['swipe-left', 'swipe-right', 'swipe-up', 'swipe-down'].map(dir)
    expect(new Set(dirs).size, `two swipes animate the same way: ${dirs}`).toBe(4)
  })

  it('gives a pinch two tips, and in and out opposite signs', () => {
    expect(svg('pinch-in').querySelectorAll('.g-pinch')).toHaveLength(2)
    // THE BUG THIS CAUGHT. pinch-in matches no swipe prefix, so the first cut fell
    // through to the default direction and both pinch clips animated identically —
    // the one thing that distinguishes them, lost to a fallback.
    const sign = (k) => svg(k).style.getPropertyValue('--gd')
    expect(sign('pinch-in')).not.toBe(sign('pinch-out'))
  })

  it('gives a two-finger swipe two tips that travel', () => {
    const s = svg('two-finger-right')
    expect(s.querySelectorAll('.g-move')).toHaveLength(2)
  })
})

describe('motion is an enhancement, not the message', () => {
  // A GIF cannot do this at all, which is why these are SVG. The assertion is on
  // the STYLESHEET rather than on a rendered frame, because jsdom computes no
  // animations — so what is checked is that the rule exists and that what it leaves
  // behind is a pose rather than a blank.
  const css = src('index.css')
  const block = css.slice(css.indexOf('/* ---- gesture clips (help) ----'))

  it('stops every clip under prefers-reduced-motion', () => {
    const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const cls of ['g-ring', 'g-hold', 'g-pinch', 'g-move']) {
      expect(reduced, `${cls} keeps animating with motion off`).toContain(cls)
    }
  })

  it('leaves a held pose rather than an invisible one', () => {
    const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    // g-move's keyframe starts AND ends at opacity 0, so a bare `animation: none`
    // would render the tip invisible — the still frame has to be set explicitly.
    expect(reduced).toMatch(/\.gesture \.g-move\s*\{[^}]*opacity:\s*0\.9/)
    expect(reduced).toMatch(/\.gesture \.g-move\s*\{[^}]*transform:\s*translate/)
    expect(reduced).toMatch(/\.gesture \.g-ring\s*\{[^}]*opacity:\s*0\.45/)
  })
})

describe('the chip', () => {
  it('names the gesture and never instructs', () => {
    const { container } = render(<GestureChip kind="long-press" />)
    expect(container.textContent).toBe('Long press')
    // "press and hold", "for half a second", "use your finger" — the register this
    // is not written in. The reader has held a phone before.
    for (const k of GESTURES) {
      expect(GESTURE_LABEL[k].toLowerCase()).not.toMatch(/hold for|press and|use your|simply|just /)
    }
  })
})
