// The halo under the words on a backdrop card.
//
// This is a legibility feature, and legibility features fail SILENTLY — that is
// the entire reason to test one. Nothing throws when the halo is missing: the
// card renders, the download works, the PNG opens. It is just that a word or two
// of somebody's favourite line has gone into a dark shoulder, in a picture they
// are about to post, and neither they nor the code will know until someone
// squints at it.
//
// So the assertions are not "the halo was configured somewhere". They are "the
// halo was in force AT THE MOMENT each word was painted", which is the only form
// of the claim that means anything on a canvas — ctx state is a single mutable
// register, and a shadow set before the portrait and cleared before the text is
// indistinguishable from one that was never set at all, unless you look at the
// paint calls themselves.
//
// A RECORDING CONTEXT, for the same reasons quote-image-portrait.test.jsx gives:
// the claim here is about call order and call state, and a pixel comparison
// would restate it as a hash that changes whenever a font does.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drawQuoteCard, hexToRgba, loadFaceImages } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

const CARD = 0 // the first canvas asked for a context is the one being drawn

let log // [{ canvas, op, args, shadow }] in call order

// Every recorded paint carries a SNAPSHOT of the shadow registers as they stood
// when it happened. Reading ctx.shadowBlur after the draw would answer a
// different and useless question — what the last line of the function left
// behind — and would pass for a card whose text was painted bare.
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
    drawImage() {}, fillRect() {}, fill() {},
  }
  const shot = () => ({
    blur: ctx.shadowBlur,
    color: ctx.shadowColor,
    dx: ctx.shadowOffsetX,
    dy: ctx.shadowOffsetY,
  })
  ctx.fillText = (...args) => log.push({ canvas: id, op: 'fillText', args, shadow: shot() })
  return ctx
}

beforeEach(() => {
  log = []
  let next = 0
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) seen.set(this, recorder(next++))
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
// footer wordmark. The halo is set once for the whole block walk, so a test
// that only had a quote would pass for an implementation that haloed the quote
// and left the rest bare.
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

async function render(m, theme = LIGHT) {
  await loadFaceImages((m.faces || []).map((f) => f.url))
  drawQuoteCard(document.createElement('canvas'), m, theme)
}

const words = () => log.filter((e) => e.canvas === CARD && e.op === 'fillText')

// Compare the HUE, not the whole rgba string. How strong the halo is, is taste
// and will be tuned; which colour it is, is the entire argument. Pinning the
// alpha here would make a designer's nudge look like a broken feature.
const rgbOf = (c) => String(c).replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).map((n) => n.trim()).join(',')

describe('the halo under the words', () => {
  it('is in force for every word on a backdrop card', async () => {
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const painted = words()
    // Guard the guard: if the model stopped producing text the loop below would
    // be vacuously true, which is the classic way this shape of test rots.
    expect(painted.length).toBeGreaterThan(5)
    const bare = painted.filter((e) => !(e.shadow.blur > 0))
    expect(bare.map((e) => e.args[0]), 'painted with no halo').toEqual([])
  })

  it('is absent on a plain card, where the paper is already that colour', async () => {
    await render(model())
    const painted = words()
    expect(painted.length).toBeGreaterThan(5)
    expect(painted.filter((e) => e.shadow.blur !== 0).map((e) => e.args[0])).toEqual([])
  })

  it('follows the photograph, not the request for one', async () => {
    // `portrait: true` with nobody to draw paints no image — so there is nothing
    // for a halo to sit against, and glowing on bare paper is a blur pass spent
    // compositing the card colour onto the card colour.
    await render(model({ portrait: true, faces: [] }))
    expect(words().filter((e) => e.shadow.blur !== 0)).toEqual([])
  })

  it('is the surface colour, not the ink', async () => {
    // The one mistake that looks like a fix. A shadow the colour of the TEXT
    // renders as a fattened, smeared letterform — it reads as a bad font at a
    // glance and does nothing whatsoever for contrast, because contrast is the
    // difference between the text and what is behind it.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    const { color } = words()[0].shadow
    expect(rgbOf(color)).toBe(rgbOf(hexToRgba(LIGHT.cardTop, 1)))
    expect(rgbOf(color)).not.toBe(rgbOf(hexToRgba(LIGHT.ink, 1)))
    // And it is a colour with some translucency, not an opaque plate: the blur
    // is what softens the edge, the alpha is what keeps it a surround.
    expect(Number(String(color).replace(/[()]/g, '').split(',')[3])).toBeGreaterThan(0)
  })

  it('takes its colour from the skin being drawn, not the one on screen', async () => {
    // A halo hardcoded to white is invisible in light mode and a bright smear
    // around every word in dark mode. The picture's skin is chosen in the share
    // panel and is frequently NOT the app's, so reading the live theme would be
    // wrong even when reading a theme is right.
    await render(model({ portrait: true, faces: [FACE(1)] }), DARK)
    expect(rgbOf(words()[0].shadow.color)).toBe(rgbOf(hexToRgba(DARK.cardTop, 1)))
    expect(DARK.cardTop).not.toBe(LIGHT.cardTop) // the test can tell them apart
  })

  it('is a glow, not a drop shadow', async () => {
    // Offset is the difference between "this text belongs to this card" and
    // "this text is floating above a picture". The card's own drop shadow does
    // use an offset, so a stray leak from that block would show up right here.
    await render(model({ portrait: true, faces: [FACE(1)] }))
    for (const e of words()) {
      expect(e.shadow.dx, e.args[0]).toBe(0)
      expect(e.shadow.dy, e.args[0]).toBe(0)
    }
  })

  it('does not outlive the card it was drawn for', async () => {
    // The share panel redraws into the SAME canvas on every font load, theme
    // event and toggle. A halo left switched on would be inherited by the next
    // card's own drop shadow, and by the portrait composite before it.
    const canvas = document.createElement('canvas')
    await loadFaceImages(['/api/covers/p1.jpg'])
    drawQuoteCard(canvas, model({ portrait: true, faces: [FACE(1)] }), LIGHT)
    expect(canvas.getContext('2d').shadowBlur).toBe(0)
  })
})
