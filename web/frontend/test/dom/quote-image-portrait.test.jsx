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
import { drawQuoteCard, loadFaceImages } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

const CARD = 0 // the first canvas asked for a context is the one being drawn

let log // [{ canvas, op, args }] in call order

function recorder(id) {
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
    save() {}, restore() {}, scale() {}, clip() {}, fill() {}, stroke() {},
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
      gco = v
      note('composite', [v])
    },
  })
  return ctx
}

beforeEach(() => {
  log = []
  let next = 0
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) {
      // Stamp the id onto the element too, so a backdrop drawn ONTO the card can
      // be traced back to the offscreen buffer it came from — and from there to
      // the photo that went into it. Without this the two sides are
      // indistinguishable and "the right one uses the second face" is unasserted.
      this.__recorderId = next
      seen.set(this, recorder(next++))
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

// On the card: a drawImage whose source is a canvas is a backdrop; whose source
// is an Image is a credit disc.
const onCard = (pred) => log.filter((e) => e.canvas === CARD && pred(e))
const backdrops = () => onCard((e) => e.op === 'drawImage' && e.args[0] instanceof HTMLCanvasElement)
const discs = () => onCard((e) => e.op === 'drawImage' && !(e.args[0] instanceof HTMLCanvasElement))
// The ordered story of the card's own surface, which is what depth means here.
const cardOps = () =>
  log
    .filter((e) => e.canvas === CARD && (e.op === 'drawImage' || e.op === 'fillText'))
    .map((e) => (e.op === 'fillText' ? 'text' : e.args[0] instanceof HTMLCanvasElement ? 'backdrop' : 'disc'))

// sourceOf answers which photo was painted into a given offscreen buffer, by
// URL. fadedPortrait's only drawImage is the cover-crop of the source photo.
const sourceOf = (canvasId) => {
  const e = log.find((x) => x.canvas === canvasId && x.op === 'drawImage')
  return e && e.args[0] && e.args[0].src
}

async function render(m) {
  await loadFaceImages((m.faces || []).map((f) => f.url))
  drawQuoteCard(document.createElement('canvas'), m, THEME)
}

describe('the portrait backdrop', () => {
  it('draws nothing when the model says no', async () => {
    await render(model({ faces: [FACE(1)] }))
    expect(backdrops()).toHaveLength(0)
  })

  it('draws nothing when there is no photo to draw', async () => {
    await render(model({ portrait: true, faces: [] }))
    expect(backdrops()).toHaveLength(0)
  })

  it('one credited name enters from the left', async () => {
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const drawn = backdrops()
    expect(drawn).toHaveLength(1)
    const [, x, , w] = drawn[0].args
    // Flush with the card's left edge — the card starts at the 22px mat.
    expect(x).toBe(22)
    expect(w).toBeGreaterThan(0)
    expect(sourceOf(drawn[0].args[0].__recorderId)).toBe('/api/covers/p1.jpg')
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

  it('a third credited name does not get a third portrait', async () => {
    // The small discs show up to five. There are only two sides.
    await render(model({ portrait: true, faces: [FACE(1), FACE(2), FACE(3)] }))
    expect(backdrops()).toHaveLength(2)
  })

  it('fades out with a real alpha mask', async () => {
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const buf = backdrops()[0].args[0].__recorderId
    const ops = log.filter((e) => e.canvas === buf)
    // In the offscreen buffer: the photo goes down, the mode flips to
    // destination-out, and the gradient is painted to erase.
    const gco = ops.findIndex((e) => e.op === 'composite' && e.args[0] === 'destination-out')
    expect(gco, 'the fade never switched to destination-out').toBeGreaterThan(-1)
    expect(ops.findIndex((e) => e.op === 'drawImage')).toBeLessThan(gco)
    expect(ops.findIndex((e, i) => i > gco && e.op === 'fillRect')).toBeGreaterThan(gco)
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

  it('keeps the credit disc on top of it', async () => {
    // The backdrop is atmosphere; the disc beside the name is the
    // identification. Losing the disc under the backdrop would leave a
    // two-speaker card with no way to tell which face belongs to which name.
    await render(model({ portrait: true, faces: [FACE(1), FACE(2)] }))
    expect(discs()).toHaveLength(2)
    const ops = cardOps()
    expect(ops.lastIndexOf('backdrop')).toBeLessThan(ops.indexOf('disc'))
  })
})
