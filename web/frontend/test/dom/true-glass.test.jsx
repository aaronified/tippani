// THE LENS, AND THE THREE ANSWERS TO "SHOULD THIS RUN AT ALL".
//
// WHY THIS IS TESTED AT ALL, given it is off for almost everybody: because "off"
// is the claim. A feature approved on the condition that it is opt-in is a feature
// whose opt-in is the thing to hold, and nothing else in the app would notice if
// the lens quietly started running for every reader — it would just get slower.
//
// AND `prefers-reduced-motion` WINNING OVER THE TOGGLE IS THE POINT. A lens that
// warps the page as it scrolls underneath is vestibular load. The toggle was set
// once; the accessibility preference is a standing instruction, so it wins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyGlass, dressGlass, glassDialsFor, lensAllowed, undressGlass } from '../../src/glassLens.js'

// jsdom has no matchMedia. Supplying one is what lets these cases state which
// answer is being given rather than which API happens to be missing.
function media({ reduced = false } = {}) {
  window.matchMedia = (q) => ({ matches: q.includes('reduced-motion') ? reduced : false, addEventListener() {}, removeEventListener() {} })
}

beforeEach(() => {
  media()
  window.CSS = { supports: () => true }
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-glass-lens')
})

afterEach(() => {
  undressGlass()
  document.querySelectorAll('svg[data-tp-lens]').forEach((n) => n.remove())
})

describe('whether the lens runs', () => {
  it('does not, unless it is asked for', () => {
    expect(lensAllowed(false)).toBe(false)
  })

  it('does when it is asked for and nothing forbids it', () => {
    expect(lensAllowed(true)).toBe(true)
  })

  // THE ONE THAT MATTERS MOST. A reader who asked the system for less motion gets
  // less motion, whatever they once set here.
  it('does not, for a reader who asked for reduced motion, even switched on', () => {
    media({ reduced: true })
    expect(lensAllowed(true)).toBe(false)
  })

  // A filter with no backdrop-filter to hang it on is a cost with no picture.
  it('does not, where the browser cannot composite a backdrop at all', () => {
    window.CSS = { supports: () => false }
    expect(lensAllowed(true)).toBe(false)
  })
})

describe('what it does to a surface', () => {
  const pane = (kind = 'bar') => {
    const el = document.createElement('div')
    el.setAttribute('data-glass', kind)
    // jsdom measures everything as 0×0, and a pane with no size is one the lens
    // correctly skips — so the size is supplied the way the browser would.
    el.getBoundingClientRect = () => ({ width: 320, height: 48 })
    document.body.appendChild(el)
    return el
  }

  it('gives a pane its own filter, by reference', () => {
    const el = pane()
    expect(dressGlass(glassDialsFor())).toBe(1)
    // A BARE url(), NOTHING MIXED. Blink drops the reference when it sits in a
    // list beside filter functions — the blur still lands and the bend does not,
    // which looks exactly like the frosting this exists to not be.
    // jsdom serialises the url with quotes and a browser does not; what matters is
    // that it is a lone reference with no filter function beside it.
    expect(el.style.backdropFilter).toMatch(/^url\(["']?#tp-lens-\d+["']?\)$/)
    expect(document.querySelector(`#${el.__tpLensId}`)).toBeTruthy()
  })

  it('leaves a pane that has not changed alone rather than re-filtering it', () => {
    const el = pane()
    dressGlass(glassDialsFor())
    const first = el.__tpLensId
    dressGlass(glassDialsFor())
    expect(el.__tpLensId).toBe(first)
  })

  it('re-filters when a dial moves, because the field is built from the numbers', () => {
    const el = pane()
    dressGlass(glassDialsFor())
    const first = el.__tpLensId
    dressGlass(glassDialsFor({ glass: { refract: 20 } }))
    expect(el.__tpLensId).not.toBe(first)
  })

  // A CONTROL IS NOT A SLAB: the rim of a small key is two pixels wide, and a
  // panel's displacement there turns the ground behind it to confetti. The
  // dispersion is what makes that rainbow, so it runs on panels only.
  it('keeps the rainbow off anything that is not a panel', () => {
    // COUNTED AS ELEMENTS, NOT AS TEXT. jsdom serialises a self-closing SVG child
    // as an open and a close tag, so a regex over innerHTML counts every
    // primitive twice — which reads as "the panel has six displacements" and is
    // the wrong number to reason about.
    const maps = () => document.querySelectorAll('svg[data-tp-lens] filter:last-of-type feDisplacementMap').length
    pane('bar')
    dressGlass(glassDialsFor())
    const panel = maps()
    // The pane AND its filter: emptying the body alone leaves the old filter in
    // the defs, and `last-of-type` then reads the previous case's answer.
    undressGlass()
    document.body.innerHTML = ''
    pane('card')
    dressGlass(glassDialsFor())
    expect(panel).toBe(3)
    expect(maps()).toBe(1)
  })

  // BEND FIRST, THEN BLUR. Displacing after a blur throws the bend away; blurring
  // after it is what makes a warped rim read as thickness.
  it('bends before it blurs', () => {
    pane()
    dressGlass(glassDialsFor())
    const html = document.querySelector('svg[data-tp-lens] filter:last-of-type').innerHTML
    expect(html.lastIndexOf('feDisplacementMap')).toBeLessThan(html.lastIndexOf('feGaussianBlur'))
  })

  // OFF HAS TO PUT IT ALL BACK. A leftover url(#…) whose filter has been removed
  // computes to `none` — a pane with NO blur at all, which is worse than the glass
  // it was replacing.
  it('puts every pane back when it is switched off', () => {
    const el = pane()
    applyGlass(true, {})
    dressGlass(glassDialsFor())
    expect(el.style.backdropFilter).toBeTruthy()
    applyGlass(false, {})
    expect(el.style.backdropFilter).toBe('')
    expect(el.__tpLensId).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-glass-lens')).toBe(false)
  })
})

describe('the five dials', () => {
  it('start at the factory', () => {
    const g = glassDialsFor()
    expect(g.refract).toBe(72)
    expect(g.blur).toBe(210)
  })

  it('take an edit, and ignore one outside the range', () => {
    expect(glassDialsFor({ glass: { refract: 10 } }).refract).toBe(10)
    expect(glassDialsFor({ glass: { refract: 9999 } }).refract).toBe(72)
    expect(glassDialsFor({ glass: { refract: 'lots' } }).refract).toBe(72)
  })
})
