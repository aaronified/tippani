// ON A PHONE A PANEL IS A SHEET FROM THE BOTTOM, AND IT FILLS THE WIDTH.
//
// THE REPORT, the owner's: "in mobile, make the popups fill the entire width and
// start from the bottom with edgemask if needed to be scrolled."
//
// WHAT IT WAS. Below the desk breakpoint the panel already hugged the bottom,
// and kept 12px of scrim down each side and 30 beneath — so on a 390px screen it
// was an inset card with a hairline of page showing round three edges, which
// reads as a dialog that did not quite land rather than as a sheet. The pack's
// own mobile sheets are `left:0;right:0;bottom:0` with `border-radius:20px 20px
// 0 0` (`book-detail.dc.html:4207-4211`).
//
// THE STRIP OF PAGE AT THE TOP IS DELIBERATE and is asserted here as a ceiling
// under the full height: it is what says the reader is on top of something
// rather than on a new screen, and it is what the scrim's blur is drawn on. A
// sheet that filled the screen would be a route, and this app has routes.
//
// WHY THE STYLESHEET AND NOT A RENDER: jsdom lays nothing out, so a rendered
// panel reports every box at zero and would "fill the width" however it is
// declared. The gesture that closes it is behaviour and is asked in
// `test/dom/sheet-from-the-bottom.test.jsx`.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the app's
// phone breakpoint is `MOBILE_SCREEN_QUERY` in `ui.jsx` — max-width: 768px.

import { describe, expect, it } from 'vitest'

import { declaredIn } from '../css-cascade.js'

const PHONE = 'max-width: 768px'

// The last declaration of `prop` for `sel` inside the phone breakpoint.
const onPhone = (sel, prop) => {
  let out = null
  for (const r of declaredIn(sel, { media: PHONE })) if (r.decls[prop]) out = String(r.decls[prop].value).trim()
  return out
}

describe('a panel at phone width', () => {
  it('fills the width rather than sitting inset from it', () => {
    const w = onPhone('.tp-panel', 'width')
    expect(w, '.tp-panel has no width of its own at phone width, so it keeps the tablet rule\'s inset card')
      .toBeTruthy()
    expect(w, `.tp-panel is \`width: ${w}\` on a phone — a sheet from the bottom takes the whole width`)
      .toBe('100%')
  })

  it('and the scrim leaves it no margin to be inset by', () => {
    const p = onPhone('.tp-panel-scrim', 'padding')
    expect(p, 'the scrim keeps its tablet padding at phone width, so the sheet cannot reach the edges')
      .toBeTruthy()
    expect(String(p).replace(/px/g, '').split(/\s+/).every((n) => Number(n) === 0),
      `the scrim pads \`${p}\` on a phone, which is the hairline of page showing round the sheet`)
      .toBe(true)
  })

  it('and squares off the corners it no longer has an edge for', () => {
    const r = onPhone('.tp-panel', 'border-radius')
    expect(r, '.tp-panel keeps its all-round radius at phone width').toBeTruthy()
    const corners = String(r).split(/\s+/)
    expect(corners.length, `\`border-radius: ${r}\` — a bottom sheet rounds its top two corners and not its bottom two`)
      .toBe(4)
    expect(Number(corners[2].replace('px', '')), 'the bottom-right corner is still round against an edge that is not there').toBe(0)
    expect(Number(corners[3].replace('px', '')), 'the bottom-left corner is still round against an edge that is not there').toBe(0)
    expect(Number(corners[0].replace('px', '')), 'the top corners lost their radius, so the sheet has no lip to read as a sheet')
      .toBeGreaterThan(0)
  })

  it('and still leaves a strip of the page above it', () => {
    const h = onPhone('.tp-panel', 'max-height')
    expect(h, '.tp-panel takes no ceiling at phone width, so a long sheet becomes the whole screen and reads as a route')
      .toBeTruthy()
    expect(h, `\`max-height: ${h}\` leaves nothing of the page visible — the blur behind it has nothing to blur`)
      .toMatch(/calc\(100dvh\s*-\s*[1-9]/)
  })
})
