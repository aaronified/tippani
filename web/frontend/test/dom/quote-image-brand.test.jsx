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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drawQuoteCard } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

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
// The drawing buffer is DPR (2×) the logical card, and every coordinate above is
// logical — so the card's own height is half the buffer's.
const cardHeight = () => canvas.height / 2

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

  it('sits in the bottom-left corner, flush with the words above it', async () => {
    render()
    const mark = markBox()
    const quoteX = texts()[0].args[1] // drawTextBlock starts every block here
    expect(mark.x).toBe(quoteX)
    // Bottom: inside the last stretch of the card, not floating in the middle of
    // it. The footer block is 34px tall over a 34px pad.
    expect(mark.b).toBeGreaterThan(cardHeight() - 80)
    expect(mark.b).toBeLessThan(cardHeight() - 22) // and above the mat, on the card
  })

})
