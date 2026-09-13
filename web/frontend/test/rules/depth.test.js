// SURFACES HAVE A BODY, AND THE LIGHT ON THEM COMES FROM ONE PLACE.
//
// THE REPORT, the owner's: "a little bit of 3d styling would do well on every
// screen. the details, cast screens are too flat now, compared to the app. make
// everything a little bit 3d, skeumorphic. use the elevation and also the wells."
//
// READ IT AGAINST WHAT THEY WERE COMPARING. The app's cards, buttons and bars
// have carried elevation and a lit top edge since the material sets landed —
// that is the "compared to the app" half. What had none were the surfaces the
// panels are made of: a pressable row drawn as nothing but a hover tint, a field
// drawn as text between two hairlines, and a strip of tiles with no shelf under
// them. Those are what this pins.
//
// THREE THINGS A SURFACE CAN BE, and the app should only be able to say them one
// way:
//
//   RAISED    a drop shadow, and a lit edge along the top — `--bevel-hi` or
//             `--bevel-mid`, which is where that light is defined
//   RECESSED  `--well`: shadow along the top INSIDE edge, a lit lip at the
//             bottom, which is what the eye reads as sunk in
//   PRESSED   a raised thing loses its lift and takes the well instead
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that this reads the
// STYLESHEET rather than a render — jsdom lays nothing out and computes no
// shadow, so a mounted component could not answer any of it.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

// The declarations of one selector, as written. A hand-rolled read for
// scroll-containment.test.js's reason: the file nests one level and the blocks
// that matter never nest inside each other.
const blockFor = (sel) => {
  const lit = sel.replace(/[.[\]()*+?^$|\\]/g, '\\$&')
  const re = new RegExp(`(^|[,{}])\\s*${lit}\\s*(,[^{}]*)?\\{([^{}]*)\\}`, 'm')
  const m = re.exec(CSS)
  return m ? m[3] : ''
}

describe('the two recipes are defined once', () => {
  it('names the lit edge and the recess as tokens, in both modes', () => {
    for (const token of ['--bevel-hi', '--bevel-mid', '--well']) {
      expect(CSS.includes(`${token}:`), `${token} is not defined at all`).toBe(true)
      // A value defined only for light is a value that draws a stripe on dark.
      const dark = /html\[data-theme="dark"\]\s*\{([^}]*)\}/g
      const inDark = [...CSS.matchAll(dark)].some((m) => m[1].includes(`${token}:`))
      expect(inDark, `${token} has no dark-mode value, so it is a light value drawn on ink`).toBe(true)
    }
  })
})

describe('the surfaces the panels are made of', () => {
  it('draw a pressable row as an object rather than as a hover tint', () => {
    const row = blockFor('.cs-row')
    expect(/box-shadow:/.test(row), 'a row you can press has no body at all').toBe(true)
    expect(/inset [^;]*var\(--bevel/.test(row), 'the row invents its own lit edge').toBe(true)
  })

  it('press a row IN rather than leaving it raised', () => {
    const active = blockFor('.cs-row:active')
    expect(/var\(--well\)/.test(active), 'a pressed row keeps its lift').toBe(true)
  })

  it('give a field on a panel sheet a card of its own', () => {
    const field = blockFor('.inline-field-rows > .inline-field')
    expect(/box-shadow:/.test(field), 'a field is still text between two hairlines').toBe(true)
    expect(/inset [^;]*var\(--bevel/.test(field), 'the field invents its own lit edge').toBe(true)
  })

  it('and put the tiles of a strip in a shelf', () => {
    const strip = blockFor('.cs-strip')
    expect(/var\(--well\)/.test(strip), 'the strip is a flat run with nothing under it').toBe(true)
  })
})

// ---- and the ratchet ------------------------------------------------------
//
// THE 34 THAT WERE ALREADY THERE ARE NOT SWEPT, and that is a decision rather
// than an omission. Each is a value tuned to its own surface — .18 on a floating
// menu, .8 on a raised card, .06 on the same card in the dark — and flattening
// them onto one token would be a regression wearing consistency's clothes. What
// the token is for is everything written FROM NOW ON, so the count may fall and
// never rise, and a new surface that invents its own white has one place to look.
describe('a new surface reaches for the token', () => {
  it('does not add another hand-written lit edge', () => {
    const hand = CSS.match(/inset 0 1px 0 rgba\(255,\s*255,\s*255/g) || []
    expect(hand.length, 'a new surface wrote its own lit edge instead of reading --bevel-hi')
      .toBeLessThanOrEqual(34)
  })
})
