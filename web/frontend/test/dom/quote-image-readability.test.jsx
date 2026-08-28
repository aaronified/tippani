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

import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { drawQuoteCard, loadFaceImages } from '../../src/quoteImage.js'
import { paletteTheme } from '../../src/theme.js'

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

describe('the plain card, which the photograph must not cost anything', () => {
  it('is never more readable than the card with a picture behind it', async () => {
    // The property the bug was a violation of, stated directly and without naming a
    // number: PUTTING A PHOTOGRAPH BEHIND THE WORDS MUST NOT MAKE ANY LINE HARDER TO
    // READ THAN IT IS WITHOUT ONE. It held at 1.35:1 against 6.4:1 before, and the
    // comparison is worth keeping even now the absolute floor above is met, because a
    // floor can be met by a card that is uniformly mediocre.
    //
    // Compared worst-line to worst-line rather than band to band: the two cards wrap
    // and lay out identically today, but a test that paired bands by index would start
    // reporting a layout change as a contrast regression.
    const plain = lineContrasts(await renderCard({ portrait: false }, LIGHT), false)
    const shot = lineContrasts(await renderCard({ faces: [{ name: 'X', url: '/face/black.jpg' }] }, LIGHT), false)
    expect(plain.length).toBeGreaterThanOrEqual(6)
    expect(shot.length).toBeGreaterThanOrEqual(6)
    expect(Math.min(...shot.map((l) => l.contrast))).toBeGreaterThanOrEqual(Math.min(...plain.map((l) => l.contrast)))
  })

  it('still sets the credit quieter than the quote, which is what tells them apart', async () => {
    // The promotion must NOT be applied everywhere. On paper the credit reads perfectly
    // two steps down and says "this is a credit, not the quote" before it is read at
    // all. A stated RELATIONSHIP rather than a colour, so any palette satisfies it and
    // no palette change breaks it: on a plain card the quote out-contrasts the credit;
    // on a backdrop card they may converge, because there legibility buys the colour.
    const plain = lineContrasts(await renderCard({ portrait: false }, LIGHT), false)
    expect(plain.length).toBeGreaterThanOrEqual(6)
    const quote = plain[0].contrast // the first line of type on the card is the quote
    const rest = plain.slice(1).map((l) => l.contrast)
    expect(Math.min(...rest)).toBeLessThan(quote)
  })
})
