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
  it('names the app and says it only made the picture', async () => {
    // "tippani" alone was a signature: it names the app to somebody who already
    // knows it, and to everybody else it sits under a quote looking like a claim
    // on words that belong to whoever said them.
    render()
    expect(said('made with'), 'the credit line').toBeTruthy()
    expect(said('tippani'), 'the wordmark').toBeTruthy()
    expect(said('টিপ্পনী'), 'the Bengali wordmark').toBeTruthy()
  })

  it('reads left to right on one line', async () => {
    render()
    const made = said('made with')
    const wm = said('tippani')
    const bn = said('টিপ্পনী')
    expect(made.args[1]).toBeLessThan(wm.args[1])
    expect(wm.args[1]).toBeLessThan(bn.args[1])
    // EXACTLY one baseline, not "within a pixel or two". Three faces at three
    // sizes on one line is ordinary typesetting; nudging one of them a pixel is
    // how they stop looking like one line, and it is the kind of fudge that gets
    // re-added to fix a rendering somebody misread.
    expect(made.args[2]).toBe(wm.args[2])
    expect(bn.args[2]).toBe(wm.args[2])
  })

  it('centres the mark on the words, not on the box around them', async () => {
    // The logo has no baseline, so it is centred on the cap-height band of the
    // sentence beside it. Sitting it on the baseline, or centring it on the em box
    // (which includes descender space the words here never use), both leave it
    // visibly floating above the line — which is exactly what shipped in 1.7.9.
    render()
    const mark = markBox()
    const base = said('tippani').args[2]
    const capCentre = base - (14 * 0.7) / 2 // FONTS.foot is 14px; caps reach ~0.7em
    const markCentre = (mark.y + mark.b) / 2
    expect(Math.abs(markCentre - capCentre)).toBeLessThanOrEqual(0.5)
  })

  it('draws the mark, not just the word', async () => {
    // The whole point of the change. A wordmark with no logo is what was there
    // before, and it looks identical in a diff of this file's line count.
    render()
    const marks = fillsIn(BRAND_RED)
    expect(marks.length, 'the bubble and its tail').toBeGreaterThanOrEqual(2)
  })

  it('keeps the logo the brand’s colour, not the reader’s accent', async () => {
    // Every other coloured thing on this card takes the theme's accent, so
    // reaching for `theme.accent` here is the natural mistake — and it produces
    // a blue tippani logo, which is not the tippani logo.
    render(model(), BLUE)
    expect(fillsIn(BRAND_RED).length).toBeGreaterThanOrEqual(2)
    expect(fillsIn('#7FA6C9')).toHaveLength(0)
  })

  it('lifts the red on a dark card', async () => {
    render(model(), DARK)
    expect(fillsIn(BRAND_RED_DARK).length).toBeGreaterThanOrEqual(2)
    expect(fillsIn(BRAND_RED)).toHaveLength(0)
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

  it('leads the credit rather than colliding with it', async () => {
    render()
    const mark = markBox()
    const made = said('made with')
    expect(mark.r).toBeLessThanOrEqual(made.args[1])
  })

  it('stays inside the card, however wide the row gets', async () => {
    render()
    const bn = said('টিপ্পনী')
    const end = bn.args[1] + String(bn.args[0]).length * 7
    // The card is 640 wide with a 22px mat and 34px of padding: nothing may
    // cross x=584 or the credit is clipped by the card's own edge.
    expect(end).toBeLessThan(640 - 22 - 34)
  })

  it('is the last thing painted, so nothing lands on top of it', async () => {
    // Canvas has no z-index; order is depth. A footer painted before the block
    // walk would be under the tag pills of a long quote.
    render(model({ tags: ['margins', 'reading'] }))
    const all = texts().map((e) => e.args[0])
    expect(all.indexOf('made with')).toBeGreaterThan(all.indexOf('margins'))
  })
})
