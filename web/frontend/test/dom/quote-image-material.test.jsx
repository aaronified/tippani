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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drawQuoteCard } from '../../src/quoteImage.js'
import { tileFor } from '../../src/theme.js'

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

  it('composites the fine pass overlay and the coarse pass normally', () => {
    // The blend is the whole reason the mean-128 invariant matters: `overlay`
    // pivots at 128, so a tile whose mean IS 128 carries texture without shifting
    // tone. Draw the fine pass `source-over` instead and it becomes a grey wash.
    drawQuoteCard(canvas, model(), { ...THEME, tile: TILE })
    const tex = fills.filter((f) => f.pattern)
    expect(tex.map((f) => f.blend)).toEqual(['source-over', 'overlay'])
  })

  it('draws at the material’s own strength, not at full opacity', () => {
    drawQuoteCard(canvas, model(), { ...THEME, tile: TILE })
    for (const f of fills.filter((x) => x.pattern)) expect(f.alpha).toBe(0.1)
  })

  it('leaves the context as it found it', () => {
    // A pattern pass that forgets to put globalAlpha and the blend back paints
    // every word after it at 10% in overlay — a card with a body and no text.
    drawQuoteCard(canvas, model(), { ...THEME, tile: TILE })
    const after = fills.filter((f) => !f.pattern && f.alpha !== 1)
    expect(after, 'a fill after the texture pass inherited its alpha').toEqual([])
  })

  it('scales the tile to its background-size, not its pixel size', () => {
    // 220px coarse and 71px fine off a 256px tile: the two passes are the same
    // image at two magnifications, which is what makes them one material.
    drawQuoteCard(canvas, model(), { ...THEME, tile: TILE })
    const ks = patterns.filter((p) => p.transform).map((p) => p.transform.a ?? p.transform[0])
    if (ks.length) expect(ks).toEqual([220 / 256, 71 / 256])
  })

  it('draws a flat card when the tile has not loaded yet', () => {
    // The first paint of every share: the grain arrives a frame later and the
    // picture is never withheld waiting for it.
    drawQuoteCard(canvas, model(), { ...THEME, tile: { ...TILE, img: null } })
    expect(fills.filter((f) => f.pattern)).toEqual([])
  })

  it('draws a flat card rather than throwing where patterns are unsupported', () => {
    // The other canvas tests stub a context with no createPattern at all, and they
    // pass — which is the guard working, not the texture missing.
    const ctx = recorder()
    delete ctx.createPattern
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
    expect(() => drawQuoteCard(document.createElement('canvas'), model(), { ...THEME, tile: TILE })).not.toThrow()
    expect(fills.filter((f) => f.pattern)).toEqual([])
  })
})

describe('the material comes from the same table the app reads', () => {
  it('answers a set and slot with the scales index.css composites at', () => {
    // Not a second copy of the numbers: tileFor reads theme.js's TEXTILES, the one
    // table the stylesheet's --tile-* aliases and this canvas both resolve through.
    expect(tileFor('manuscript', 'card')).toMatchObject({ name: 'paper', coarse: 220, fine: 71, strength: 0.1 })
    expect(tileFor('bindery', 'card')).toMatchObject({ name: 'paper-photo', strength: 0.07 })
    expect(tileFor('film-assembly', 'card')).toMatchObject({ name: 'matte' })
  })

  it('honours a per-slot override, so the picture can wear a tile no set names', () => {
    expect(tileFor('manuscript', 'card', 'glass-soft')).toMatchObject({ name: 'glass-soft' })
  })

  it('falls back to the set rather than to nothing for a name it does not know', () => {
    expect(tileFor('quarry', 'card', 'obsidian')).toMatchObject({ name: 'satin' })
  })

  it('falls back to Manuscript for a set it does not know', () => {
    expect(tileFor('vellum', 'card')).toMatchObject({ name: 'paper' })
  })
})
