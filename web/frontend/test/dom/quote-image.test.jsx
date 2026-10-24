import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildModel, clearPortraitCache, drawQuoteCard, loadFaceImages } from '../../src/quoteImage.js'
import { categoryHex, paletteTheme } from '../../src/theme.js'
import { createCanvas } from '@napi-rs/canvas'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ShareDialog, bookShare } from '../../src/share.jsx'
import { t } from '../../src/i18n.js'

// The credit in the corner of a shared quote image.
//
// A quote card is the one thing this app makes that leaves it. It gets posted,
// re-posted and screenshotted, and by the third hop nothing travels with it
// except what is painted into the PNG. So the footer is not decoration — it is
// the only surviving answer to "where is this from", and every way it can fail
// is silent: the mark drawn off the bottom edge, drawn in the user's accent
// instead of the brand's red, or not drawn at all because a canvas somewhere
// lacks a method the shape needed.
//
// A RECORDING CONTEXT, for the reasons the sibling files give (see
// quote-image-portrait.test.jsx): the claims are about what was painted, in what
// colour, in what order, and where — and each of those is a call, not a pixel.
// Paths are tracked as a bounding box, which is all a "does it sit in the
// bottom-left corner of the card" assertion needs.
describe('quote image brand', () => {
const CARD = 0 // the first canvas asked for a context is the one being drawn

// mark.svg's own two reds. The mark is drawn here and shipped as a file there,
// which is two definitions of one logo — so this test is deliberately the thing
// that fails when they drift apart, rather than a picture nobody diffs.
const BRAND_RED = '#B4482D'
const BRAND_RED_DARK = '#D8613D'

let log

function recorder(id) {
  let pts = []
  const note = (op, args) => log.push({ canvas: id, op, args })
  const box = () => {
    if (!pts.length) return null
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return { x: Math.min(...xs), y: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) }
  }
  const ctx = {
    globalAlpha: 1,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', textBaseline: '',
    letterSpacing: '0px', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    globalCompositeOperation: 'source-over',
    // 7px a character: wider than any face the card actually uses, so a footer
    // that fits here fits in the browser too.
    measureText: (t) => ({ width: String(t).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, scale() {}, clip() {}, closePath() {},
    beginPath() { pts = [] },
    moveTo(x, y) { pts.push([x, y]) },
    lineTo(x, y) { pts.push([x, y]) },
    // The control points of an arcTo are the corner it rounds, so a rounded
    // rect's four of them bound the rect.
    arcTo(x1, y1, x2, y2) { pts.push([x1, y1], [x2, y2]) },
    arc(cx, cy, r) { pts.push([cx - r, cy - r], [cx + r, cy + r]) },
    drawImage: (...a) => note('drawImage', a),
    fillRect: (...a) => note('fillRect', a),
    fill: () => note('fill', [ctx.fillStyle, box()]),
    stroke: () => note('stroke', [ctx.strokeStyle, box()]),
    fillText: (...a) => note('fillText', a),
  }
  return ctx
}

let canvas

beforeEach(() => {
  log = []
  let next = 0
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) seen.set(this, recorder(next++))
    return seen.get(this)
  })
  canvas = document.createElement('canvas')
})

const LIGHT = paletteTheme(false, '#B4482D')
const BLUE = paletteTheme(false, '#7FA6C9')
const DARK = paletteTheme(true, '#B4482D')

const model = (over = {}) => ({
  quote: 'The margins are where the reader answers back.',
  attribution: [{ text: 'Ursula K. Le Guin', emphasis: 'bold' }],
  meta: [],
  tags: [],
  note: '',
  faces: [],
  facesFor: 'author',
  colorHex: null,
  portrait: false,
  ...over,
})

const render = (m = model(), theme = LIGHT) => drawQuoteCard(canvas, m, theme)

const cardOps = () => log.filter((e) => e.canvas === CARD)
const texts = () => cardOps().filter((e) => e.op === 'fillText')
const said = (t) => texts().find((e) => e.args[0] === t)
const fillsIn = (color) =>
  cardOps().filter((e) => e.op === 'fill' && String(e.args[0]).toUpperCase() === color.toUpperCase())

// markBox is the UNION of everything painted in the brand red: the bubble and the
// tail that hangs below it. Reading only the first fill would measure the bubble
// and call it the logo, which is wrong by exactly the height of the tail — and it
// is the tail that makes it a speech bubble.
const markBox = (color = BRAND_RED) => {
  const boxes = fillsIn(color).map((e) => e.args[1]).filter(Boolean)
  expect(boxes.length, 'the mark was not drawn').toBeGreaterThan(0)
  return {
    x: Math.min(...boxes.map((b) => b.x)),
    y: Math.min(...boxes.map((b) => b.y)),
    r: Math.max(...boxes.map((b) => b.r)),
    b: Math.max(...boxes.map((b) => b.b)),
  }
}

describe('the credit in the corner', () => {
  it('keeps the logo the brand’s colour, not the reader’s accent', async () => {
    // Every other coloured thing on this card takes the theme's accent, so
    // reaching for `theme.accent` here is the natural mistake — and it produces
    // a blue tippani logo, which is not the tippani logo.
    render(model(), BLUE)
    expect(fillsIn(BRAND_RED).length).toBeGreaterThanOrEqual(2)
    expect(fillsIn('#7FA6C9')).toHaveLength(0)
  })

})
})

// The halo under the words on a backdrop card.
//
// This is a legibility feature, and legibility features fail SILENTLY — that is
// the entire reason to test one. Nothing throws when the halo is missing: the
// card renders, the download works, the PNG opens. It is just that a word or two
// of somebody's favourite line has gone into a dark shoulder, in a picture they
// are about to post, and neither they nor the code will know until someone
// squints at it.
//
// So the assertions are not "the halo was configured somewhere". They are "every
// word that was painted on the card was also painted into a halo, in the card's
// own surface colour, underneath it" — which is the only form of the claim that
// means anything on a canvas, where order IS depth and a glow composited after
// the words is a glow on top of them.
//
// THE HALO IS NO LONGER A CANVAS SHADOW, and the last section here is why. It was
// one shadowed fillText per pass per line, which is ~120 blurs for one picture and
// measured 1,350ms of frozen main thread — the whole of the "backdrop takes 5-10s"
// report. It is now one offscreen layer per halo radius, blurred once and
// composited HALO_PASSES times. The blur count no longer follows the word count,
// and there is a test at the bottom that says so, because that is the property
// that was wrong and the one a future refactor could quietly undo.
//
// A RECORDING CONTEXT, for the same reasons quote-image-portrait.test.jsx gives:
// the claim here is about call order and call state, and a pixel comparison
// would restate it as a hash that changes whenever a font does.
describe('quote image halo', () => {
const CARD = 0 // the first canvas asked for a context is the one being drawn

let log // [{ canvas, op, args, ... }] in call order
let idOf // canvas element -> recorder id, so a composited layer can be read back

// Every recorded paint carries a SNAPSHOT of the registers as they stood when it
// happened. Reading them after the draw would answer a different and useless
// question — what the last line of the function left behind.
function recorder(id) {
  const ctx = {
    globalAlpha: 1,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
    letterSpacing: '0px',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    globalCompositeOperation: 'source-over',
    measureText: (t) => ({ width: String(t).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, scale() {}, clip() {}, stroke() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
  }
  const shot = () => ({
    blur: ctx.shadowBlur,
    color: ctx.shadowColor,
    dx: ctx.shadowOffsetX,
    dy: ctx.shadowOffsetY,
  })
  // `filter` is a real accessor so that ASKING FOR A BLUR is an event in the log.
  // A plain property would record the last value set and lose the count, and the
  // count is the whole performance claim.
  let filter = 'none'
  Object.defineProperty(ctx, 'filter', {
    get: () => filter,
    set: (v) => {
      filter = v
      if (/blur/.test(String(v))) log.push({ canvas: id, op: 'blur', args: [v] })
    },
  })
  ctx.fillText = (...args) => log.push({ canvas: id, op: 'fillText', args, shadow: shot() })
  ctx.drawImage = (...args) =>
    log.push({ canvas: id, op: 'drawImage', args, alpha: ctx.globalAlpha, shadow: shot() })
  ctx.fillRect = (...args) =>
    log.push({ canvas: id, op: 'fillRect', args, fill: ctx.fillStyle, gco: ctx.globalCompositeOperation })
  ctx.fill = () => log.push({ canvas: id, op: 'fill', fill: ctx.fillStyle })
  return ctx
}

beforeEach(() => {
  log = []
  idOf = new WeakMap()
  let next = 0
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) {
      const id = next++
      idOf.set(this, id)
      seen.set(this, recorder(id))
    }
    return seen.get(this)
  })
  Object.defineProperty(globalThis.Image.prototype, 'width', { value: 100, configurable: true })
  Object.defineProperty(globalThis.Image.prototype, 'height', { value: 100, configurable: true })
})

const LIGHT = paletteTheme(false, '#B4482D')
const FACE = (n) => ({ name: `Person ${n}`, url: `/api/covers/p${n}.jpg` })

// Deliberately every kind of text the card can paint: the quote, the "— "
// marker, the attribution, the meta line, a handwritten note, tag pills and the
// footer wordmark. A test that only had a quote would pass for an implementation
// that haloed the quote and left the rest bare.
const model = (over = {}) => ({
  quote: 'The margins are where the reader answers back.',
  attribution: [{ text: 'Ursula K. Le Guin', emphasis: 'bold' }],
  meta: ['CH. 1', 'p.12'],
  tags: ['margins', 'reading'],
  note: 'The whole argument, in one line.',
  faces: [],
  facesFor: 'author',
  colorHex: null,
  portrait: false,
  ...over,
})

// Returns the recorder id of the canvas it drew onto. The card is canvas 0 for the
// first render of a test and is NOT for any render after it — the offscreen layers of
// the first card have taken the ids in between. A test that draws twice has to ask
// rather than assume, and CARD is only a shorthand for the single-render case.
async function render(m, theme = LIGHT) {
  await loadFaceImages((m.faces || []).map((f) => f.url))
  const canvas = document.createElement('canvas')
  drawQuoteCard(canvas, m, theme)
  return idOf.get(canvas)
}

// A halo layer is a canvas composited onto the card at its intrinsic size — three
// arguments, no destination rectangle. A portrait is the other canvas that lands
// here and it is PLACED, with five. See the same split in the portrait test.
const composites = () =>
  log.filter(
    (e) =>
      e.canvas === CARD &&
      e.op === 'drawImage' &&
      e.args[0] instanceof HTMLCanvasElement &&
      e.args.length <= 3,
  )
const layerIds = () => [...new Set(composites().map((e) => idOf.get(e.args[0])))]
// haloLayer works in TWO buffers: the words and the flattening go into the first, and
// it is blurred into a second, which is the one composited onto the card. So the
// buffer the card names is not the buffer the words are in — the blurred one names
// the painted one in its own single drawImage, and that is the hop taken here. A test
// that looked only at what the card was handed would find an empty canvas and say the
// halo covered nothing.
const paintedLayer = (blurredId) => {
  const e = log.find((x) => x.canvas === blurredId && x.op === 'drawImage')
  return e ? idOf.get(e.args[0]) : undefined
}
const paintedLayerIds = () => layerIds().map(paintedLayer).filter((id) => id !== undefined)
const wordsOn = (canvas) => log.filter((e) => e.canvas === canvas && e.op === 'fillText').map((e) => e.args[0])
const cardWords = () => wordsOn(CARD)
// Every word the halo covers, across all of its layers — one card's words are
// split between layers by type size, so the union is the claim, not any one layer.
const haloedWords = () => paintedLayerIds().flatMap((id) => wordsOn(id))
const blurs = () => log.filter((e) => e.op === 'blur')

// Compare the HUE, not the whole rgba string. How strong the halo is, is taste
// and will be tuned; which colour it is, is the entire argument. Pinning the
// alpha here would make a designer's nudge look like a broken feature.

describe('the halo under the words', () => {
  it('covers every word on a backdrop card', async () => {
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const painted = cardWords()
    // Guard the guard: if the model stopped producing text the comparison below
    // would be vacuously true, which is the classic way this shape of test rots.
    expect(painted.length).toBeGreaterThan(5)
    const covered = new Set(haloedWords())
    expect(painted.filter((w) => !covered.has(w)), 'painted with no halo under them').toEqual([])
  })

})
})

// The picture is made of what the app is made of.
//
// WHY THIS FILE EXISTS. The share card is the one artefact that LEAVES the app, so a
// disagreement between it and the screen is the version other people see. Until 3.0.0
// the card had a film variant — sprocket rows, an amber border, a tighter corner —
// and when the two aesthetics became seven material sets that variant was dropped
// rather than generalised, which quietly made the export the only surface in the app
// with no material at all.
//
// It has one now, rebuilt with a canvas pattern instead of a CSS background: the same
// two scales, the same strength, the same `overlay` on the fine pass. What is easy to
// get wrong is not whether it draws — it is whether it draws the SAME recipe, because
// nothing on screen compares the two and a card that is subtly flatter than the app
// looks fine on its own.
describe('quote image material', () => {
  const model = () => ({
    quote: 'The margins are where the reader answers back.',
    attribution: [{ text: 'Ursula K. Le Guin', emphasis: 'bold' }],
    meta: [], tags: [], note: '', faces: [], facesFor: 'author',
    colorHex: null, portrait: false,
  })

  const THEME = {
    dark: false, bg: '#F4EDDE', cardTop: '#FFFFFC', cardBottom: '#FCF8ED',
    ink: '#221C16', soft: '#6A5F50', faint: '#8A7C68', line: '#E4DAC7',
    accent: '#B4482D', inkBorder: 'rgba(41,38,29,.6)',
  }

  // A recorder that knows about patterns, which the other canvas tests deliberately do
  // not: they stub only what a flat card needs, and that is what proves the texture
  // pass is guarded rather than required.
  let fills
  let patterns
  function recorder() {
    const ctx = {
      globalAlpha: 1, globalCompositeOperation: 'source-over',
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', textBaseline: '',
      letterSpacing: '0px', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      measureText: (t) => ({ width: String(t).length * 7 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createPattern: (img, rep) => {
        const p = { img, rep, transform: null, setTransform(m) { p.transform = m } }
        patterns.push(p)
        return p
      },
      save() {}, restore() {}, scale() {}, clip() {}, closePath() {},
      beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {},
      drawImage() {}, fill() {}, stroke() {}, fillText() {},
      fillRect: (x, y, w, h) => fills.push({
        x, y, w, h, alpha: ctx.globalAlpha, blend: ctx.globalCompositeOperation,
        pattern: patterns.includes(ctx.fillStyle) ? ctx.fillStyle : null,
      }),
    }
    return ctx
  }

  let canvas
  beforeEach(() => {
    fills = []
    patterns = []
    const seen = new WeakMap()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      if (!seen.has(this)) seen.set(this, recorder())
      return seen.get(this)
    })
    canvas = document.createElement('canvas')
  })

  const TILE = { name: 'paper', file: 'paper', coarse: 220, fine: 71, strength: 0.1, img: { width: 256 } }

  describe('the card wears the material', () => {
    it('lays two passes down, coarse then fine', () => {
      drawQuoteCard(canvas, model(), { ...THEME, tile: TILE })
      const tex = fills.filter((f) => f.pattern)
      expect(tex.length, 'the two scales of one material').toBe(2)
    })

  })
})

// The portrait backdrop, drawn.
//
// Everything about WHETHER it appears is in buildModel and tested without a
// canvas (quote-image.test.js). This is the other half: given a model that says
// yes, does the right number of portraits land on the right sides, at the right
// depth.
//
// A RECORDING CONTEXT, not node-canvas. Asserting the call sequence is both a
// cheaper dependency and a stronger test than comparing pixels: "one drawImage
// at the card's left edge and one at its right" is the claim, and a pixel
// comparison would restate it as a hash that changes whenever a font does.
//
// What is at risk here is not an exception. A backdrop drawn for the wrong
// person, on the wrong side, or when nobody asked for one, is a stranger's face
// across somebody's words in a picture they are about to post. None of those
// throw.
//
// ONE RECORDER PER CANVAS, sharing one ordered log. The card creates offscreen
// canvases to build each faded portrait, and those draw the source photo into
// themselves — so a single shared recorder cannot tell "the photo went into its
// own offscreen buffer" from "the photo was stamped onto the card". That
// distinction is the whole test. Every recorder carries the id of the canvas it
// belongs to, and only id 0 is the card.
describe('quote image portrait', () => {
const CARD = 0 // the first canvas asked for a context is the one being drawn

let log // [{ canvas, op, args }] in call order
let supportedOps // which composite ops this test's canvases accept

// `supported` models what a given canvas implementation accepts. A real setter
// ignores a value it does not know, which is the behaviour fadedPortrait reads
// back — so a test can drop 'color' from this set and get the same silence a
// browser without CSS blend modes on canvas would give.
const FULL_SUPPORT = ['source-over', 'source-atop', 'destination-out', 'color', 'multiply']

function recorder(id, supported = FULL_SUPPORT) {
  const note = (op, args) => log.push({ canvas: id, op, args })
  const ctx = {
    canvas: null,
    globalAlpha: 1,
    // Assigned by the card; nothing here reads them back, but they must accept
    // a write or the draw throws on a frozen object.
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
    letterSpacing: '0px', shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
    measureText: (t) => ({ width: String(t).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    drawImage: (...a) => note('drawImage', a),
    fillRect: (...a) => note('fillRect', a),
    fillText: (...a) => note('fillText', a),
    save() {}, restore() {}, scale() {}, clip() {}, stroke() {},
    // fill() takes no arguments, so the only way to know WHAT was filled is to
    // record the style in force. The colour edge is a rounded rect filled with
    // the quote's hex, and its absence under a backdrop is a claim worth making.
    fill: () => note('fill', [ctx.fillStyle]),
    // A tiny stand-in for the real setter's "ignore what you do not recognise"
    // behaviour, which fadedPortrait reads back to decide whether it may use the
    // `color` blend. Kept honest here: an unknown value must NOT stick.
    __supported: new Set(supported),
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
  }
  // The blend mode is the effect, not a detail: the fade is an alpha mask
  // painted with destination-out, and with the default source-over the same
  // gradient paints a black wash INSTEAD of erasing — a hard-edged slab over
  // half the card rather than a photo dissolving into it. A plain property
  // records nothing, so it is a logged accessor.
  let gco = 'source-over'
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    get: () => gco,
    set: (v) => {
      note('composite', [v])
      if (ctx.__supported.has(v)) gco = v
    },
  })
  return ctx
}

beforeEach(() => {
  // Every case here asserts what a draw DOES, and the faded portrait is cached
  // between draws — so without this the second case in the file measures the
  // first case's buffer and sees no operations at all.
  clearPortraitCache()
  log = []
  supportedOps = FULL_SUPPORT
  let next = 0
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) {
      // Stamp the id onto the element too, so a backdrop drawn ONTO the card can
      // be traced back to the offscreen buffer it came from — and from there to
      // the photo that went into it. Without this the two sides are
      // indistinguishable and "the right one uses the second face" is unasserted.
      this.__recorderId = next
      seen.set(this, recorder(next++, supportedOps))
    }
    return seen.get(this)
  })
  // jsdom's stub Image has naturalWidth/Height but no width/height, and
  // drawImageCover reads the latter — without these the crop maths is NaN and
  // every assertion below would pass for the wrong reason.
  Object.defineProperty(globalThis.Image.prototype, 'width', { value: 100, configurable: true })
  Object.defineProperty(globalThis.Image.prototype, 'height', { value: 100, configurable: true })
})

const THEME = paletteTheme('paper', false, '#B4482D')
const FACE = (n) => ({ name: `Person ${n}`, url: `/api/covers/p${n}.jpg` })

const model = (over = {}) => ({
  quote: 'The margins are where the reader answers back.',
  attribution: [{ text: 'Ursula K. Le Guin', emphasis: 'bold' }],
  meta: [],
  tags: [],
  note: '',
  faces: [],
  facesFor: 'author',
  colorHex: null,
  portrait: false,
  ...over,
})

// On the card: a drawImage whose source is an Image is a credit disc. TWO kinds of
// canvas are composited onto the card, and the argument count is what separates
// them — a portrait is PLACED and carries a destination rectangle, while a halo
// layer is laid over the whole picture at its intrinsic size (see haloLayer in
// quoteImage.js). Telling them apart by which came first would pass for an
// implementation that had lost one of them.
const onCard = (pred) => log.filter((e) => e.canvas === CARD && pred(e))
const isCanvas = (e) => e.args[0] instanceof HTMLCanvasElement
const backdrops = () => onCard((e) => e.op === 'drawImage' && isCanvas(e) && e.args.length > 3)
const halos = () => onCard((e) => e.op === 'drawImage' && isCanvas(e) && e.args.length <= 3)
const discs = () => onCard((e) => e.op === 'drawImage' && !isCanvas(e))

// sourceOf answers which photo was painted into a given offscreen buffer, by
// URL. fadedPortrait's only drawImage is the cover-crop of the source photo.
const sourceOf = (canvasId) => {
  const e = log.find((x) => x.canvas === canvasId && x.op === 'drawImage')
  return e && e.args[0] && e.args[0].src
}

async function render(m) {
  await loadFaceImages((m.faces || []).map((f) => f.url))
  const canvas = document.createElement('canvas')
  drawQuoteCard(canvas, m, THEME)
  return canvas
}

// The card's own height, read back off the canvas the draw sized: the buffer is
// 2× (DPR) and holds the card plus a 22px mat top and bottom. Needed by the
// bottom line-up, whose whole claim is about where the band sits relative to the
// card — and the card's height depends on how much text there is, so it cannot
// be a constant here.
const cardHeightOf = (canvas) => canvas.height / 2 - 44

describe('the portrait backdrop', () => {
  it('draws nothing when the model says no', async () => {
    await render(model({ faces: [FACE(1)] }))
    expect(backdrops()).toHaveLength(0)
  })

  it('two names take a side each, first on the left', async () => {
    await render(model({ portrait: true, faces: [FACE(1), FACE(2)] }))
    const drawn = backdrops()
    expect(drawn).toHaveLength(2)
    const [, leftX, , leftW] = drawn[0].args
    const [, rightX, , rightW] = drawn[1].args
    expect(leftX).toBe(22)
    expect(rightW).toBe(leftW)
    // The right one ends flush with the card's right edge: 640 wide, 22 of mat
    // each side, so the card runs to x=618.
    expect(rightX + rightW).toBe(618)
    // And they do not overlap, or there is no card left between them.
    expect(rightX).toBeGreaterThanOrEqual(leftX + leftW)
    // The right side is the SECOND person. Geometry alone cannot say this: two
    // portraits of the same face land in exactly the same two places, so
    // without tracing each buffer back to its source photo the commonest
    // copy-paste slip in this block — reusing list[0] for both — passes.
    expect(sourceOf(drawn[0].args[0].__recorderId)).toBe('/api/covers/p1.jpg')
    expect(sourceOf(drawn[1].args[0].__recorderId)).toBe('/api/covers/p2.jpg')
  })

})
})

// Can the share card be read?
//
// Not "was the halo configured", not "which hex went into the fill register" — those
// are restatements of the implementation, and a test that restates the implementation
// passes for an unreadable card that happens to be built the agreed way and fails for a
// readable one built differently. It verifies that the code is the code.
//
// So this renders the card onto a REAL canvas, over the worst backdrop a photograph can
// be, reads the pixels back, finds each line of type, and measures the contrast between
// the ink and the paper immediately behind it. The claim is the one the reader cares
// about and the one the bug report made: 4.5:1 is the WCAG floor for body text, the
// credit line measured 1.35:1 and the footer 1.14:1, and every line has to clear the
// floor. How that is achieved is left entirely open.
//
// THE WORST CASE IS SYNTHETIC ON PURPOSE. A real portrait has a light background and a
// face somewhere in the middle, so text lands on a dark shoulder only sometimes and only
// for some words — which is what made this ship. Solid black and solid white are the two
// ends a photograph can reach, they are reached at every pixel at once, and a card that
// holds up over both holds up over anything between them.
describe('quote image readability', () => {
const WCAG_BODY = 4.5

// ---- a canvas that actually rasterises -------------------------------------
//
// jsdom's <canvas> has no 2D context at all, which is why every other test in this
// family drives a recording stub. Measuring pixels needs pixels, so canvas elements are
// swapped for real ones. `new Image()` has to yield something the real context will
// accept as a drawing source, so the constructor hands back a canvas with the fixture
// painted into it and an `src` setter that fires onload — quoteImage.js loads faces
// through the Image/onload path and its cache is private, so this is the way in.

const FACES = { '/face/black.jpg': '#000000', '/face/white.jpg': '#ffffff' }

function FaceImage() {
  const c = createCanvas(400, 400)
  Object.defineProperty(c, 'src', {
    configurable: true,
    set(url) {
      const g = c.getContext('2d')
      g.fillStyle = FACES[url] ?? '#808080'
      g.fillRect(0, 0, c.width, c.height)
      queueMicrotask(() => c.onload && c.onload())
    },
  })
  return c
}

let restore
beforeEach(() => {
  const real = document.createElement.bind(document)
  document.createElement = (tag, ...rest) => (tag === 'canvas' ? createCanvas(1, 1) : real(tag, ...rest))
  const prevImage = globalThis.Image
  globalThis.Image = FaceImage
  restore = () => {
    document.createElement = real
    globalThis.Image = prevImage
  }
})
afterEach(() => restore && restore())

// ---- measuring ------------------------------------------------------------

function relLum(r, g, b) {
  const ch = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

// The paper behind a given pixel — the hard part of the whole measurement, because on a
// backdrop card the paper is a photograph and changes under every letter.
//
// A single global background value is useless. So is the obvious local one, the extreme
// of a horizontal window: on a smooth gradient the window's extreme is the value 12px
// away, so a steep enough fade reports itself as ink at every pixel and the card comes
// back as one enormous "line of text" that is really the portrait.
//
// A morphological CLOSING does the right thing: dilate to swallow anything narrower than
// the kernel, then erode to put back what the dilation moved. Strokes vanish; gradients
// survive unchanged, because a gradient is not narrower than the kernel. On a dark card
// the ink is the light one, so it is an opening — the same statement inverted.
const WINDOW = 12 // half-width in device pixels; wider than any stroke at 2×

function rowExtreme(src, w, r, wantMax) {
  const out = new Float64Array(w)
  for (let x = 0; x < w; x++) {
    let best = src[x]
    for (let d = -r; d <= r; d++) {
      const xx = x + d
      if (xx < 0 || xx >= w) continue
      const v = src[xx]
      if (wantMax ? v > best : v < best) best = v
    }
    out[x] = best
  }
  return out
}

function backgroundRow(L, w, y, dark) {
  const row = L.subarray(y * w, y * w + w)
  return rowExtreme(rowExtreme(row, w, WINDOW, !dark), w, WINDOW, dark)
}

// Every line of type on the card, and how well the ink in it stands off its paper.
// Rows are grouped into bands by where there is ink at all, so the bands ARE the lines —
// nothing here knows the layout, which is what keeps the test from having to be updated
// whenever the card is.
// THE CARD'S OWN EDGES ARE NOT TYPE. The card sits on a mat of a different colour, so
// at every single row the transition between the two departs from its surroundings by
// more than any letter does — read naively that makes the whole card one continuous
// "line of text" running from its top to its bottom, and the measurement becomes the
// contrast of the border against the mat. So the sample is cropped to the card's
// interior: past both edges, and comfortably around the text column, which starts one
// card-padding in.
const CROP_X0 = 0.07
const CROP_X1 = 0.94

function lineContrasts(canvas, dark) {
  const ctx = canvas.getContext('2d')
  const h = canvas.height
  const x0 = Math.round(canvas.width * CROP_X0)
  const x1 = Math.round(canvas.width * CROP_X1)
  const w = x1 - x0
  const { data } = ctx.getImageData(x0, 0, w, h)
  const L = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) L[i] = relLum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])

  const rows = []
  for (let y = 0; y < h; y++) {
    const bg = backgroundRow(L, w, y, dark)
    const hits = []
    for (let x = 0; x < w; x++) {
      const d = Math.abs(L[y * w + x] - bg[x])
      if (d > 0.02) hits.push({ d, l: L[y * w + x], b: bg[x] })
    }
    rows.push(hits)
  }

  // A row carries type if enough of it departs from its paper. The threshold is in
  // pixels rather than a share of the width because a short line — "— Tagore, 1910" —
  // covers very little of a 1280px card and is exactly the line that must not be missed.
  const INKED = 40
  const bands = []
  let start = -1
  for (let y = 0; y <= h; y++) {
    const inked = y < h && rows[y].length >= INKED
    if (inked && start < 0) start = y
    if (!inked && start >= 0) {
      // 8px+ at 2×: the x-height of the smallest type on the card. Below that it is an
      // ascender clipped by the row before it, or a hairline, and sampling a sliver
      // that thin measures antialiasing rather than ink.
      if (y - start >= 8) bands.push([start, y])
      start = -1
    }
  }

  return bands.map(([y0, y1]) => {
    const all = []
    for (let y = y0; y < y1; y++) all.push(...rows[y])
    all.sort((p, q) => q.d - p.d)
    // The most strongly inked tenth: the stroke centres. Small antialiased type is
    // mostly edge pixels, and an edge pixel sits halfway between ink and paper by
    // construction — averaging them in scores every card at about 1:1 and hides the
    // very difference being measured.
    const core = all.slice(0, Math.max(1, Math.floor(all.length / 10)))
    const rs = core.map((p) => wcag(p.l, p.b)).sort((a, b) => a - b)
    return { top: y0, bottom: y1, contrast: rs[Math.floor(rs.length / 2)] }
  })
}

// ---- the card under test ---------------------------------------------------

const model = (over = {}) => ({
  // The reported case, near enough: a book's annotation with its author, its title and
  // its year — "the author image and then the book name and year being too less
  // contrasty".
  quote: 'Where the mind is without fear and the head is held high.',
  translation: '',
  attribution: [
    { text: 'Rabindranath Tagore', emphasis: 'bold' },
    { text: 'Gitanjali (Song Offerings)', emphasis: 'italic' },
    { text: '1910', emphasis: null },
  ],
  meta: ['CH. 35', 'p. 27'],
  tags: ['memory', 'things worth reading twice'],
  note: 'The line everyone knows, in his own English.',
  faces: [{ name: 'Rabindranath Tagore', url: '/face/black.jpg' }],
  facesFor: 'author',
  colorHex: null,
  portrait: true,
  swap: false,
  ...over,
})

async function renderCard(over, theme) {
  const m = model(over)
  await loadFaceImages(m.faces.map((f) => f.url))
  const canvas = createCanvas(10, 10)
  drawQuoteCard(canvas, m, theme)
  return canvas
}

const LIGHT = paletteTheme(false, '#B4482D')
const DARK = paletteTheme(true, '#B4482D')

const CASES = [
  ['light card, black backdrop', LIGHT, '/face/black.jpg'],
  ['light card, white backdrop', LIGHT, '/face/white.jpg'],
  ['dark card, black backdrop', DARK, '/face/black.jpg'],
  ['dark card, white backdrop', DARK, '/face/white.jpg'],
]

describe('every line of a backdrop card clears the contrast floor', () => {
  for (const [name, theme, url] of CASES) {
    it(name, async () => {
      const canvas = await renderCard({ faces: [{ name: 'X', url }] }, theme)
      const lines = lineContrasts(canvas, theme.dark)

      // Guard the guard. If the card stopped drawing text, or the band finder stopped
      // finding it, every assertion below would be vacuously true — which is the classic
      // way this shape of test rots into a green light that means nothing.
      expect(lines.length, 'no lines of type found on the card').toBeGreaterThanOrEqual(6)

      const failing = lines.filter((l) => l.contrast < WCAG_BODY)
      expect(
        failing.map((l) => `y=${l.top}-${l.bottom} ${l.contrast.toFixed(2)}:1`),
        'lines below the WCAG floor for body text',
      ).toEqual([])
    })
  }
})
})

// A person's signature on the card, drawn.
//
// What a reader would say: with Signature on, the credited person's signature sits
// in the picture's bottom right corner, in the footer row beside the Tippani mark,
// in the card's own ink; with it off, or with the credit unchecked, there is none.
//
// A RECORDING CONTEXT, as quote-image-portrait.test.jsx explains: asserting the
// call sequence is a cheaper dependency and a stronger claim than comparing pixels.
// What is at risk is not an exception but a signature drawn where nobody asked, over
// the wordmark, or taller than the footer, none of which throw.
//
// WHAT THIS KNOWS, declared: the model buildModel makes and drawQuoteCard takes (the
// two functions the share dialog calls), and the card's own geometry as that file
// states it — a 22px mat around a card 640 wide, so the card runs to x=618.
describe('quote image signature', () => {
  const CARD = 0
  let log

  function recorder(id) {
    const note = (op, args) => log.push({ canvas: id, op, args })
    const ctx = {
      globalAlpha: 1, font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
      letterSpacing: '0px', shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
      measureText: (t) => ({ width: String(t).length * 7 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      drawImage: (...a) => note('drawImage', a),
      fillRect: (...a) => note('fillRect', a),
      fillText: (...a) => note('fillText', [a[0], a[1], a[2]]),
      save() {}, restore() {}, scale() {}, clip() {}, stroke() {},
      fill: () => note('fill', [ctx.fillStyle]),
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
    }
    let gco = 'source-over'
    Object.defineProperty(ctx, 'globalCompositeOperation', {
      get: () => gco,
      set: (v) => { note('composite', [v]); gco = v },
    })
    return ctx
  }

  beforeEach(() => {
    clearPortraitCache()
    log = []
    let next = 0
    const seen = new WeakMap()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      if (!seen.has(this)) {
        this.__recorderId = next
        seen.set(this, recorder(next++))
      }
      return seen.get(this)
    })
    // A 300 x 100 signature, so its shape is known.
    Object.defineProperty(globalThis.Image.prototype, 'width', { value: 300, configurable: true })
    Object.defineProperty(globalThis.Image.prototype, 'height', { value: 100, configurable: true })
  })

  const THEME = paletteTheme('paper', false, '#B4482D')
  const SIGN = { name: 'Jane Solo', url: '/api/covers/0123456789abcdef.png' }

  const model = (over = {}) => ({
    quote: 'The margins are where the reader answers back.',
    attribution: [{ text: 'Jane Solo', emphasis: 'bold' }],
    meta: [], tags: [], note: '', faces: [], facesFor: 'author', colorHex: null, portrait: false,
    signature: null,
    ...over,
  })

  async function render(m) {
    await loadFaceImages(m.signature ? [m.signature.url] : [])
    const canvas = document.createElement('canvas')
    drawQuoteCard(canvas, m, THEME)
    return canvas
  }

  // The signature, as it lands on the card: a canvas stamped with a destination
  // rectangle (five arguments).
  const stamped = () => log.filter((e) => e.canvas === CARD && e.op === 'drawImage'
    && e.args[0] instanceof HTMLCanvasElement && e.args.length === 5)
  const footerText = () => log.filter((e) => e.canvas === CARD && e.op === 'fillText' && e.args[0] === 'tippani')[0]

  describe('the signature on the card', () => {
    it('sits in the footer row at the card\'s right edge, no taller than the row', async () => {
      const canvas = await render(model({ signature: SIGN }))
      const drawn = stamped()
      expect(drawn).toHaveLength(1)
      const [, x, y, w, h] = drawn[0].args
      // Flush with the card's inner right edge, which is inside the card (618).
      expect(x + w).toBeLessThanOrEqual(618)
      expect(x + w).toBeGreaterThan(560)
      // The row under the footer's hairline is 24px; never taller.
      expect(h).toBeLessThanOrEqual(24)
      expect(h).toBeGreaterThan(8)
      // 300:100 stays 3:1.
      expect(w / h).toBeCloseTo(3, 1)
      // Inside the card, in its bottom stretch.
      const cardBottom = 22 + (canvas.height / 2 - 44)
      expect(y + h).toBeLessThanOrEqual(cardBottom)
      // The footer sits one card-padding up from the card's bottom edge.
      expect(y + h).toBeGreaterThan(cardBottom - 60)
    })

  })

  describe('buildModel and the signature', () => {
    const share = (over = {}) => ({
      quote: 'q', attribution: [{ id: 'author', label: 'Author', value: 'Jane Solo', emphasis: 'bold' }],
      faces: [], facesFor: 'author', signature: SIGN, ...over,
    })

    it('drops it with the credit it belongs to', () => {
      expect(buildModel(share(), { quote: true, author: false }, null).signature).toBeNull()
    })

  })
})

// The share dialog's two standing decisions: what the picture assumes about the
// quote's colour, and where the explanatory prose lives.
//
// Both are the kind of thing that has no failure. A card that carries a colour
// nobody asked it to carry renders perfectly; four lines of syntax reference
// above the fold on a phone lay out perfectly. They are only wrong once somebody
// looks at the result, which is after it has been sent.
//
// The colour default is tested through the CANVAS rather than through the
// toggle's markup. A control reading "Off" while the drawing code carries on
// tinting is a state desync, not a labelling slip, and asserting the switch
// position alone would pass for it.
describe('share dialog', () => {
  // The recorder only has to answer one question — what was filled, and with what
  // — so it records the style in force at each fill(). The colour edge is the one
  // rounded rect filled with the quote's own hex.
  let fills
  function recorder() {
    const ctx = {
      globalAlpha: 1,
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
      letterSpacing: '0px',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      globalCompositeOperation: 'source-over',
      measureText: (t) => ({ width: String(t).length * 7 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      save() {}, restore() {}, scale() {}, clip() {}, stroke() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
      drawImage() {}, fillRect() {}, fillText() {},
      fill: () => fills.push(ctx.fillStyle),
    }
    return ctx
  }

  beforeEach(() => {
    fills = []
    const seen = new WeakMap()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      if (!seen.has(this)) seen.set(this, recorder())
      return seen.get(this)
    })
  })

  const BLUE = categoryHex('blue')

  const share = () =>
    bookShare({
      quote: 'Only in silence the word',
      author: 'Ursula K. Le Guin',
      title: 'A Wizard of Earthsea',
      color: 'blue',
    })

  // The Image panel is what the dialog opens on, so this renders and waits rather
  // than selecting a format first. The colour switch is the panel's own control, so
  // finding it is how we know the panel is up.
  async function openImage() {
    render(<ShareDialog share={share()} onClose={() => {}} />)
    return await screen.findByRole('button', { name: 'Quote colour' })
  }

  const drewTheColour = () => fills.includes(BLUE)

  const pressed = (el) => el.getAttribute('aria-pressed')

  describe("the picture's colour switch", () => {
    it('starts off, and the card is drawn without the colour', async () => {
      const chip = await openImage()
      expect(pressed(chip)).toBe('false')
      await waitFor(() => expect(fills.length).toBeGreaterThan(0))
      expect(drewTheColour(), 'the colour edge was drawn anyway').toBe(false)
    })

    it('remembers being switched on', async () => {
      localStorage.setItem('tippani:shareImageTint', 'true')
      expect(pressed(await openImage())).toBe('true')
      await waitFor(() => expect(drewTheColour()).toBe(true))
    })

  })
})

// The share dialog's Signature option, as a reader meets it.
//
// What a person would say: if somebody credited on this quote has a signature, the
// picture offers it, off to begin with, and turning it on puts it on the card; if
// nobody credited has one the option is not there; and a card showing the CHARACTER
// instead of the actor offers none, because a character signed nothing.
//
// WHAT THIS KNOWS, declared: the dialog's own props (a share built by bookShare or
// movieQuoteShare from a name→person map, the shape GET /people answers), the words
// on the screen, and what is stamped on the card canvas.
describe('share signature', () => {
  let stamps
  function recorder() {
    const ctx = {
      globalAlpha: 1, font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
      letterSpacing: '0px', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      globalCompositeOperation: 'source-over',
      measureText: (s) => ({ width: String(s).length * 7 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      save() {}, restore() {}, scale() {}, clip() {}, stroke() {}, fill() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
      fillRect() {}, fillText() {},
      // A canvas stamped with a destination rectangle is a signature (or a portrait
      // backdrop, which these cases never switch on).
      drawImage: (...a) => { if (a[0] instanceof HTMLCanvasElement && a.length === 5) stamps.push(a) },
    }
    return ctx
  }

  beforeEach(() => {
    stamps = []
    localStorage.clear()
    const seen = new WeakMap()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      if (!seen.has(this)) seen.set(this, recorder())
      return seen.get(this)
    })
    Object.defineProperty(globalThis.Image.prototype, 'width', { value: 300, configurable: true })
    Object.defineProperty(globalThis.Image.prototype, 'height', { value: 100, configurable: true })
  })
  afterEach(() => cleanup())

  const JANE = { name: 'Jane Solo', image_path: '', signature_path: 'aaaaaaaaaaaaaaaa.png' }

  const shareBy = (people, extra = {}) => bookShare({
    quote: 'Only in silence the word', author: 'Jane Solo', title: 'A Book', people, ...extra,
  })

  // One chip in the picture's row of options, pressed when on.
  const option = () => screen.queryByRole('button', { name: t('share.image.signature.info.title') })
  const pressed = (el) => el.getAttribute('aria-pressed')

  async function open(share) {
    render(<ShareDialog share={share} onClose={() => {}} />)
    // The picture panel is up when its preview is; not every case has a colour or a
    // signature switch to wait for.
    await screen.findByLabelText(t('share.image.preview.aria'))
  }

  describe("the picture's signature option", () => {

    it('is not offered on a card showing the character, who signed nothing', async () => {
      localStorage.setItem('tippani:shareFaceKind', JSON.stringify('character'))
      await open(shareBy({ 'Jane Solo': JANE }, {
        characterImages: [{ name: 'The Hero', path: 'bbbbbbbbbbbbbbbb.jpg' }],
      }))
      expect(option()).toBeNull()
    })
  })
})
