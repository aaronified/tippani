// The gesture drawings, and the rule that keeps them honest.
//
// THESE WERE ANIMATED CLIPS AND ARE NOW VENDORED HANDS — Atlas Icons' hand-gesture
// pack, which the owner chose: "the static icons look better than our existing
// animations. retire them." Seven of the checks below went with the motion, and
// they are named here rather than deleted quietly, because each was guarding a
// real defect and a reader should be able to tell a retired check from a lost one:
// the ring on long-press, the moving tip and trail on a swipe, the four swipes
// animating four ways, the pinch pair's opposite signs, the two-finger pair, and
// both prefers-reduced-motion rules. Every one of them asserted something about
// movement. There is no movement now, so there is nothing for them to be right
// about — and the reduced-motion branch is MOOT rather than unhandled, which is the
// distinction worth keeping: a still drawing needs no rule to stop it.
//
// WHAT REPLACES THEM is below, under "what each drawing is": that the art is real
// and distinct per gesture, which is the property the animation checks were
// circling all along.
//
// Seven drawings exist as a library; the app binds four. The failure this file exists
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
  it('holds all seven, each with a label', () => {
    // SEVEN AND NOT ELEVEN. The four directional two-finger gestures went with the
    // animation, because Atlas has no icon that tells a two-finger left from a
    // two-finger right — only one generic two-finger hand. Four names against one
    // picture is worse than four names against none, and none of the four was bound.
    expect(GESTURES).toHaveLength(7)
    for (const k of GESTURES) {
      expect(GESTURE_LABEL[k], `${k} has no label`).toBeTruthy()
    }
  })

  it('names only the ones the app actually binds as implemented', () => {
    // long-press: ui.jsx's 500ms hold, and every card's menu.
    // swipe-left: App.jsx's drawer close, and only leftward — swipe-to-open is
    // deliberately absent because the left screen edge is the OS back gesture.
    // swipe-up / swipe-down: ui.jsx's useSheetDrag, growing, shrinking and
    // finally dismissing a phone sheet.
    expect(IMPLEMENTED).toEqual(['long-press', 'swipe-left', 'swipe-up', 'swipe-down'])
    for (const k of IMPLEMENTED) expect(GESTURES).toContain(k)
  })

  // AND THE MANIFEST IS CHECKED AGAINST THE TREE, not just against itself. The
  // list above is a claim about what the app binds, and a claim nobody verifies
  // is how the shortcut sheet came to print five keys with no handler. When a
  // binding is deleted its hook goes with it, so the hook's name is the evidence:
  // the swipes are implemented BECAUSE something reads a pointer or a touch and
  // acts on the direction.
  it('and each named gesture has something in the source that binds it', () => {
    const shell = src('App.jsx') + src('ui.jsx')
    const BINDING = {
      // The 500ms hold every control and every card answers.
      'long-press': /\bLONG_PRESS_MS\b/,
      // The drawer closes leftward past a threshold; swipe-to-open is
      // deliberately absent, so the constant that names the distance is the
      // binding — `pointermove` alone would now be satisfied by the sheet.
      'swipe-left': /\bSWIPE_CLOSE\b/,
      // The phone sheet's drag, in both directions.
      'swipe-up': /\buseSheetDrag\b/,
      'swipe-down': /\buseSheetDrag\b/,
    }
    for (const k of IMPLEMENTED) {
      expect(BINDING[k], `${k} is called implemented and this file does not know what binds it`).toBeTruthy()
      expect(shell, `${k} is named as implemented but nothing in App.jsx or ui.jsx binds it`)
        .toMatch(BINDING[k])
    }
  })

  // The claim above, checked against the tree rather than trusted. If a pinch
  // handler ever lands, this fails and asks for the clip to be promoted — which is
  // the right direction for this test to break in.
  //
  // IT USED TO READ `onTouchStart|touchmove` TOO, and that was the wrong net: those
  // are how ANY touch gesture is bound, so the first one the app added — the
  // sheet's swipe-down — tripped a case whose sentence is about pinching. It broke
  // in the right direction and said the wrong thing, which is worse than either.
  // What is pinch-specific is `gesturechange` (Safari's own pinch event) and the
  // word itself; the rest of the claim is carried by IMPLEMENTED above.
  it('and the app really does not handle a pinch', () => {
    const shell = src('App.jsx') + src('ui.jsx')
    expect(shell).not.toMatch(/gesturechange|onGestureStart/i)
    expect(shell.toLowerCase()).not.toContain('pinch')
  })

  it('draws nothing for a kind it does not have, rather than an error box', () => {
    const { container } = render(<Gesture kind="somersault" />)
    expect(container.firstChild).toBeNull()
    expect(render(<GestureChip kind="somersault" />).container.firstChild).toBeNull()
  })
})

describe('what each drawing is', () => {
  const svg = (kind) => render(<Gesture kind={kind} />).container.querySelector('svg')

  it('labels itself for a screen reader with the gesture name', () => {
    expect(svg('long-press').getAttribute('aria-label')).toBe('Long press')
    expect(svg('swipe-left').getAttribute('role')).toBe('img')
  })

  // THE CHECK THE ANIMATION ONES WERE CIRCLING. What they really asserted, through
  // the motion, was that no two gestures draw the same picture — a swipe left that
  // animated like a swipe right was the defect, and a swipe left that IS a swipe
  // right is the same defect with the movement taken out. So this compares the art
  // directly, and it is the single reason four of the eleven were dropped rather
  // than pointed at Atlas's one generic two-finger hand.
  it('draws a different picture for every gesture', () => {
    const drawn = GESTURES.map((k) => svg(k).innerHTML)
    expect(new Set(drawn).size, 'two gestures share one drawing').toBe(GESTURES.length)
  })

  it('has real art for every gesture, not an empty frame', () => {
    for (const k of GESTURES) {
      const s = svg(k)
      expect(s.querySelectorAll('path, line, polyline, circle').length,
        `${k} has nothing drawn in it`).toBeGreaterThan(0)
    }
  })

  // VENDORED ART ARRIVES IN SOMEBODY ELSE'S COLOUR. Atlas ships these with a
  // `.cls-1` class whose stylesheet hardcodes #020202 — black, which on this app's
  // dark theme is a gesture nobody can see. The class is stripped on the way in and
  // the stroke is the app's own currentColor; this fails if either creeps back.
  it('takes the app\u2019s ink rather than the pack\u2019s black', () => {
    // THE ART BLOCK ONLY, and the first cut read the whole file — which failed on
    // this module's own comment explaining that `.cls-1` was stripped. A guard that
    // cannot tell prose about a defect from the defect is a guard that punishes
    // writing the prose.
    const file = src('gestures.jsx')
    const art = file.slice(file.indexOf('const ART = {'), file.indexOf('export function Gesture'))
    expect(art, 'the pack\u2019s stylesheet class survived the import').not.toContain('cls-1')
    expect(art, 'a hardcoded hex is in the art').not.toMatch(/#[0-9a-f]{3,6}\b/i)
    expect(svg('long-press').getAttribute('stroke')).toBe('currentColor')
  })

  // A HAND IS MORE LINE THAN A NAV GLYPH, so it is drawn lighter — see the note on
  // Gesture. This pins the decision rather than the number's rightness: at the
  // app's 1.85 the fingers close up at chip size.
  it('is drawn lighter than a nav glyph, because a hand is more line', () => {
    expect(Number(svg('long-press').getAttribute('stroke-width'))).toBeLessThan(1.85)
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
