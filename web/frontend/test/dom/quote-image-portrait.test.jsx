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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPortraitCache, drawQuoteCard, loadFaceImages } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

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
// The ordered story of the card's own surface, which is what depth means here.
const cardOps = () =>
  log
    .filter((e) => e.canvas === CARD && (e.op === 'drawImage' || e.op === 'fillText'))
    .map((e) =>
      e.op === 'fillText' ? 'text' : !isCanvas(e) ? 'disc' : e.args.length > 3 ? 'backdrop' : 'halo',
    )

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

  it('sits behind every word', async () => {
    // Not "it was drawn" but "it was drawn FIRST". Canvas has no z-index; order
    // IS depth, so a backdrop painted one block too late covers the quote it is
    // supposed to sit behind, and nothing about that throws.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const ops = cardOps()
    expect(ops).toContain('backdrop')
    expect(ops).toContain('text')
    expect(ops.lastIndexOf('backdrop')).toBeLessThan(ops.indexOf('text'))
  })

})
