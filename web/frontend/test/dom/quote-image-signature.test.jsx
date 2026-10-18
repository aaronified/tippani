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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildModel, clearPortraitCache, drawQuoteCard, loadFaceImages } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

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
  it('is not drawn unless the model carries one', async () => {
    await render(model())
    expect(stamped()).toHaveLength(0)
  })

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

  it('does not run over the Tippani wordmark', async () => {
    await render(model({ signature: SIGN }))
    const [, x] = stamped()[0].args
    // The footer's words start at the left; the signature must start to the right of
    // where the wordmark ends. Its x is the wordmark's start plus its measured width.
    const word = footerText()
    expect(x).toBeGreaterThan(word.args[1] + 'tippani'.length * 7)
  })

  it('a very wide signature is shrunk to the room the wordmark leaves, and keeps its shape', async () => {
    // 3000 x 100 is 30:1 — at the row's height it would run straight over the wordmark.
    Object.defineProperty(globalThis.Image.prototype, 'width', { value: 3000, configurable: true })
    await render(model({ signature: { name: 'Jane Solo', url: '/api/covers/wide0123456789ab.png' } }))
    const [, x, , w, h] = stamped()[0].args
    const word = footerText()
    // The wordmark's Bengali half follows "tippani"; the signature starts past both.
    expect(x).toBeGreaterThanOrEqual(word.args[1] + 'tippani'.length * 7)
    expect(x + w).toBeLessThanOrEqual(618)
    expect(w / h).toBeCloseTo(30, 0)
  })

  it('is the signature that was asked for, filled in the card\'s own ink', async () => {
    await render(model({ signature: SIGN }))
    const id = stamped()[0].args[0].__recorderId
    const own = log.filter((e) => e.canvas === id)
    // A large source is halved on its way down, so the file itself may be drawn onto
    // an intermediate canvas rather than the tinted one: look anywhere in the chain.
    expect(log.some((e) => e.op === 'drawImage' && String(e.args[0]?.src || '').includes('0123456789abcdef.png'))).toBe(true)
    // Ink keeps the signature's own shape (source-in), then fills.
    expect(own.map((e) => e.op === 'composite' ? e.args[0] : e.op)).toEqual(['drawImage', 'source-in', 'fillRect'])
  })
})

describe('buildModel and the signature', () => {
  const share = (over = {}) => ({
    quote: 'q', attribution: [{ id: 'author', label: 'Author', value: 'Jane Solo', emphasis: 'bold' }],
    faces: [], facesFor: 'author', signature: SIGN, ...over,
  })

  it('carries it while its credit is checked', () => {
    expect(buildModel(share(), { quote: true, author: true }, null).signature).toEqual(SIGN)
  })

  it('drops it with the credit it belongs to', () => {
    expect(buildModel(share(), { quote: true, author: false }, null).signature).toBeNull()
  })

  it('has none to carry when the share has none', () => {
    expect(buildModel(share({ signature: null }), { quote: true, author: true }, null).signature).toBeNull()
  })
})
