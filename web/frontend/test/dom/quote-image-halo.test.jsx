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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drawQuoteCard, hexToRgba, loadFaceImages } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

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
const DARK = paletteTheme(true, '#B4482D')
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
const rgbOf = (c) => String(c).replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).map((n) => n.trim()).join(',')

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

  it('sits under the words rather than over them', async () => {
    // Canvas has no z-index; order IS depth. A halo composited after the text is a
    // wash of the card's own colour over the reader's quote, which is worse than no
    // halo at all and every bit as silent.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const lastHalo = log.lastIndexOf(composites().at(-1))
    const firstWord = log.findIndex((e) => e.canvas === CARD && e.op === 'fillText')
    expect(lastHalo).toBeGreaterThanOrEqual(0)
    expect(firstWord).toBeGreaterThanOrEqual(0)
    expect(lastHalo).toBeLessThan(firstWord)
  })

  it('is absent on a plain card, where the paper is already that colour', async () => {
    await render(model())
    expect(cardWords().length).toBeGreaterThan(5)
    expect(composites()).toEqual([])
    expect(blurs()).toEqual([])
  })

  it('follows the photograph, not the request for one', async () => {
    // `portrait: true` with nobody to draw paints no image — so there is nothing
    // for a halo to sit against, and glowing on bare paper is a blur pass spent
    // compositing the card colour onto the card colour.
    await render(model({ portrait: true, faces: [] }))
    expect(composites()).toEqual([])
    expect(blurs()).toEqual([])
  })

  it('is the surface colour, not the ink', async () => {
    // The one mistake that looks like a fix. A halo the colour of the TEXT renders
    // as a fattened, smeared letterform — it reads as a bad font at a glance and
    // does nothing whatsoever for contrast, because contrast is the difference
    // between the text and what is behind it.
    //
    // The layer is flattened in ONE operation: source-in keeps the alpha that was
    // drawn and replaces every colour under it, so whatever colours the text was
    // set in, the halo is paper.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const ids = paintedLayerIds()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const flatten = log.filter((e) => e.canvas === id && e.op === 'fillRect' && e.gco === 'source-in')
      expect(flatten.length, `layer ${id} was never flattened to one colour`).toBe(1)
      expect(rgbOf(flatten[0].fill)).toBe(rgbOf(hexToRgba(LIGHT.cardTop, 1)))
      expect(rgbOf(flatten[0].fill)).not.toBe(rgbOf(hexToRgba(LIGHT.ink, 1)))
    }
  })

  it('takes its colour from the skin being drawn, not the one on screen', async () => {
    // A halo hardcoded to white is invisible in light mode and a bright smear
    // around every word in dark mode. The picture's skin is chosen in the share
    // panel and is frequently NOT the app's, so reading the live theme would be
    // wrong even when reading a theme is right.
    await render(model({ portrait: true, faces: [FACE(1)] }), DARK)
    const flatten = log.filter((e) => paintedLayerIds().includes(e.canvas) && e.op === 'fillRect' && e.gco === 'source-in')
    expect(flatten.length).toBeGreaterThan(0)
    expect(rgbOf(flatten[0].fill)).toBe(rgbOf(hexToRgba(DARK.cardTop, 1)))
    expect(DARK.cardTop).not.toBe(LIGHT.cardTop) // the test can tell them apart
  })

  it('is a glow, not a drop shadow', async () => {
    // Offset is the difference between "this text belongs to this card" and "this
    // text is floating above a picture". The layer is composited at the origin, at
    // the same place the words are painted, and no shadow register is in force
    // while it happens — the card's own drop shadow does use an offset, so a stray
    // leak from that block would show up right here.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    for (const e of composites()) {
      expect(e.args[1], 'halo x offset').toBe(0)
      expect(e.args[2], 'halo y offset').toBe(0)
      expect(e.shadow.dx).toBe(0)
      expect(e.shadow.dy).toBe(0)
    }
    for (const e of log.filter((x) => x.canvas === CARD && x.op === 'fillText')) {
      expect(e.shadow.dx, e.args[0]).toBe(0)
      expect(e.shadow.dy, e.args[0]).toBe(0)
    }
  })

  it('is laid down more than once, which is what makes it opaque near the glyph', async () => {
    // One pass of a translucent glow tints what is behind the word without ever
    // covering it. The repeats compound towards opacity immediately around the
    // letterform while the outer falloff stays soft — see HALO_PASSES. Dropping to
    // one pass is a visual change that nothing else here would catch.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const per = new Map()
    for (const e of composites()) per.set(idOf.get(e.args[0]), (per.get(idOf.get(e.args[0])) || 0) + 1)
    expect(per.size).toBeGreaterThan(0)
    for (const [id, n] of per) expect(n, `layer ${id} composited ${n} times`).toBeGreaterThan(1)
    // And each pass is translucent: an opaque plate is not a halo, it is a lid.
    for (const e of composites()) expect(e.alpha).toBeGreaterThan(0)
    for (const e of composites()) expect(e.alpha).toBeLessThan(1)
  })

  it('does not outlive the card it was drawn for', async () => {
    // The share panel redraws into the SAME canvas on every font load, theme event
    // and toggle. A blur filter or a shadow left switched on would be inherited by
    // the next card's portrait composite.
    const canvas = document.createElement('canvas')
    await loadFaceImages(['/api/covers/p1.jpg'])
    drawQuoteCard(canvas, model({ portrait: true, faces: [FACE(1)] }), LIGHT)
    expect(canvas.getContext('2d').shadowBlur).toBe(0)
    expect(canvas.getContext('2d').filter).toBe('none')
  })
})

// ---- the cost of it ---------------------------------------------------------
//
// The halo was the slowest thing in the app and it was slow for a reason that a
// reasonable person would reintroduce: setting a shadow and painting the text is
// the obvious way to write it, and it is correct in every respect except that it
// buys a blur per word. These two say the quiet part: the blur is bought per
// LAYER, and a card with five times the words is not five times the work.
describe('what the halo costs', () => {
  it('blurs once per halo radius, not once per word', async () => {
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const layers = layerIds().length
    expect(layers).toBeGreaterThan(0)
    expect(blurs().length, 'one blur per layer').toBe(layers)
    // The card sets type at four sizes and the radius is quantised so they collapse
    // to a couple of layers. This is a ceiling, not a measurement: it fails if a
    // change starts building a layer per block again.
    expect(layers, `${layers} halo layers for one card`).toBeLessThanOrEqual(3)
  })

  it('does not blur more for a longer quote', async () => {
    const shortCard = await render(model({ portrait: true, faces: [FACE(1)], quote: 'Short.' }))
    const shortWords = wordsOn(shortCard).length
    const shortBlurs = blurs().length

    log = []
    const longCard = await render(
      model({
        portrait: true,
        faces: [FACE(1)],
        quote: Array.from({ length: 40 }, (_, i) => `line ${i} of a very long quotation indeed`).join(' '),
      }),
    )
    const longWords = wordsOn(longCard).length

    // The guard: the long card really does paint far more text, so an unchanged
    // blur count means something.
    expect(longWords).toBeGreaterThan(shortWords * 2)
    expect(blurs().length, 'blur count followed the word count').toBe(shortBlurs)
  })
})
