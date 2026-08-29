// Can a label be read off a textured fill?
//
// The sibling of quote-image-readability.test.jsx, and it exists for the same
// reason: "was the veil configured" is a restatement of the implementation, and
// it passes for an unreadable control built the agreed way. So this composites
// the fill the way the browser does — the real tile file, at the real
// background-size, blended the real way over the real accent — reads the pixels
// back, and measures the contrast between the label colour and the paper behind
// it. Every material set, every accent, both modes.
//
// THE BUG IT WAS WRITTEN FOR. The selection fills (the nav toggle's thumb, the
// select thumb, an active filter chip, the drawer's active row) composite
// --tile-shell onto the accent. Every OTHER surface in the app spends its tile
// through the operator in theme.js — (1 − s)·colour + s·tile, where s is the
// strength measured for that tile in src/textures/README.md — and these did not:
// they blended it at full weight. That is invisible in Manuscript, whose shell is
// paper (sd 26.05), and it is a light label on near-white blotches in Bindery,
// whose shell is suede (sd 59.07, the loudest tile in the pack). The report was
// "readability issues for the top bar menu when highlighted" in Bindery and
// Quarry, and those are the two sets with the loudest shells.
//
// WHY MEASURE INSTEAD OF PINNING THE NUMBER. --sel-veil is asserted exactly in
// material-sets.test.jsx, which is the right place for "the wiring is wired".
// This asks the question that survives the next tile being added to the pack: a
// twenty-ninth material with a standard deviation nobody expected fails HERE,
// against a floor, rather than passing a test that agrees with whatever theme.js
// happens to compute.

import { describe, expect, it, beforeAll } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAT_SETS, ACCENTS, applyTheme } from '../../src/theme.js'

// ---- what the browser would do ---------------------------------------------

// The stack index.css lays down for a selection fill, top layer first. Mirrored
// here rather than parsed, because a composite is arithmetic and not a string —
// but NOT trusted: the guard below reads the stylesheet and fails if the shape
// this assumes has stopped being the shape that ships.
const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

const srgb = (v) => {
  v /= 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const relLum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
// color-mix(in oklab, c, white p%) — approximated in sRGB, which is close enough
// for a contrast floor and keeps the test free of a colour-space dependency.
const white = (rgb, p) => rgb.map((c) => c + (255 - c) * p)

// CSS `overlay`, per compositing-1: the tile pivots at 128, which is what the
// mean-128 invariant in textures/README.md buys.
function overlay(base, top) {
  const b = base / 255
  const t = top / 255
  return (b <= 0.5 ? 2 * b * t : 1 - 2 * (1 - b) * (1 - t)) * 255
}

// ---- the tiles -------------------------------------------------------------

const TEXDIR = join(SRC, 'textures')
const FILES = readdirSync(TEXDIR)
const images = new Map()

async function tileFor(name) {
  if (!images.has(name)) {
    const f = FILES.find((n) => n.replace(/\.(png|webp)$/, '') === name)
    if (!f) throw new Error(`no texture file for ${name}`)
    images.set(name, await loadImage(join(TEXDIR, f)))
  }
  return images.get(name)
}

// The tile as the browser draws it into a control: scaled to background-size,
// then read back as luminance. Returned as the extremes at two scales — one
// pixel, and one letter. A LETTER is the one that matters: what makes a glyph
// hard to read is the mean behind the whole stroke, not one bright pixel inside
// it, and a high-frequency tile like brushed metal averages away while a
// low-frequency one like suede does not.
async function tileBand(name, size) {
  const img = await tileFor(name)
  const c = createCanvas(size, size)
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0, size, size)
  const { data } = g.getImageData(0, 0, size, size)
  const L = new Float64Array(size * size)
  for (let i = 0; i < size * size; i++) L[i] = data[i * 4] // grayscale tiles: R is the value

  let pLo = 255
  let pHi = 0
  for (const v of L) {
    if (v < pLo) pLo = v
    if (v > pHi) pHi = v
  }

  // A 13px letter box, averaged. Wraps, because the tile repeats and a control
  // can sit anywhere on the plane.
  const R = 6
  let lLo = 255
  let lHi = 0
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      let sum = 0
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          sum += L[((y + dy + size) % size) * size + ((x + dx + size) % size)]
        }
      }
      const m = sum / ((2 * R + 1) ** 2)
      if (m < lLo) lLo = m
      if (m > lHi) lHi = m
    }
  }
  return { pLo, pHi, lLo, lHi }
}

// ---- the fill --------------------------------------------------------------

// One pixel of the fill, given the tile value under it. Bottom to top:
// the accent gradient, the tile at `overlay`, the veil back toward flat accent,
// then the black scrim.
function fillPixel(accentLayer, tileValue, veil, scrim) {
  const blended = accentLayer.map((c) => overlay(c, tileValue))
  const veiled = blended.map((c, i) => c + (accentLayer[i] - c) * veil)
  return veiled.map((c) => c * (1 - scrim))
}

// Every combination the app can be in, with the tokens read off the DOM rather
// than recomputed — so this measures the wiring and not a copy of it.
function tokensFor(set, accent, dark) {
  applyTheme({ materialSet: set, accent, theme: dark ? 'dark' : 'light' })
  const root = document.documentElement
  const s = getComputedStyle(root)
  const tile = (s.getPropertyValue('--tile-shell') || '').trim().replace(/^var\(--tile-|\)$/g, '')
  const veil = parseFloat(s.getPropertyValue('--sel-veil')) / 100
  const onAccent = (s.getPropertyValue('--on-accent') || '').trim()
  return { tile, veil, onAccent }
}

// ---- the assertions --------------------------------------------------------

// 3.0:1 — WCAG AA for large text, which is the honest floor for a 15px 600-weight
// label with a halo behind it. It is NOT 4.5: the accent/label pair alone, with
// no texture on it at all, tops out at 3.9 for the olive accent, so a 4.5 floor
// would be a test about the palette wearing this file's name. What this file is
// for is the TEXTURE, and the second assertion is the one that says so.
const FLOOR = 3.0
// And the texture may cost no more than a fifth of the contrast the same fill
// has with no tile on it. This is the regression guard proper: it fails when a
// fill stops being calibrated, whatever the palette does, and it fails for a
// loud tile in a set nobody has looked at yet.
const MAX_TEXTURE_COST = 0.2

const GRAINS = [
  ['a toggle or select thumb (--grain-accent)', 130],
  ['the shell nav thumb (--grain-shell-sm)', 185],
]

describe('the stack this measures is the stack that ships', () => {
  it('is still four layers, with the tile blended overlay between two flat ones', () => {
    // If somebody re-orders or drops a layer, the arithmetic above is measuring a
    // fill nobody sees — which is the failure mode that makes a passing contrast
    // test worthless.
    expect(CSS).toContain('background-blend-mode: normal, normal, overlay, normal;')
    expect(CSS).toContain('var(--sel-veil)')
    // and the sizes name the tile layer in third place
    expect(CSS).toMatch(/background-size: auto, auto, var\(--grain-(accent|shell-sm)\), auto;/)
  })
})

describe('a label on a selection fill', () => {
  const cases = []
  for (const set of Object.keys(MAT_SETS)) {
    for (const accent of Object.keys(ACCENTS)) {
      for (const dark of [false, true]) cases.push([set, accent, dark])
    }
  }

  const bands = new Map()
  beforeAll(async () => {
    for (const set of Object.keys(MAT_SETS)) {
      const { tile } = tokensFor(set, 'terracotta', false)
      for (const [, size] of GRAINS) bands.set(`${tile}@${size}`, await tileBand(tile, size))
    }
  })

  for (const [label, size] of GRAINS) {
    it(`clears ${FLOOR}:1 on ${label}, in every set, accent and mode`, () => {
      const failures = []
      for (const [set, accent, dark] of cases) {
        const { tile, veil, onAccent } = tokensFor(set, accent, dark)
        const band = bands.get(`${tile}@${size}`)
        const base = dark ? white(hex(ACCENTS[accent]), 0.2) : hex(ACCENTS[accent])
        const scrim = dark ? 0.2 : 0.12
        const ink = relLum(...hex(onAccent))
        // Both ends of the vertical gradient, and both extremes of the tile at
        // letter scale: the worst paper any glyph on this control can land on.
        let worst = Infinity
        for (const layer of [base, white(base, dark ? 0.12 : 0.14)]) {
          for (const v of [band.lLo, band.lHi]) {
            worst = Math.min(worst, wcag(ink, relLum(...fillPixel(layer, v, veil, scrim))))
          }
        }
        if (worst < FLOOR) failures.push(`${set}/${accent}/${dark ? 'dark' : 'light'} = ${worst.toFixed(2)}:1`)
      }
      expect(failures, `unreadable: ${failures.join(', ')}`).toEqual([])
    })

    it(`spends less than ${MAX_TEXTURE_COST * 100}% of its contrast on grain, on ${label}`, () => {
      const failures = []
      for (const [set, accent, dark] of cases) {
        const { tile, veil, onAccent } = tokensFor(set, accent, dark)
        const band = bands.get(`${tile}@${size}`)
        const base = dark ? white(hex(ACCENTS[accent]), 0.2) : hex(ACCENTS[accent])
        const scrim = dark ? 0.2 : 0.12
        const ink = relLum(...hex(onAccent))
        for (const layer of [base, white(base, dark ? 0.12 : 0.14)]) {
          // 128 is the tile's own mean, so it is the same fill with no grain.
          const flat = wcag(ink, relLum(...fillPixel(layer, 128, veil, scrim)))
          for (const v of [band.lLo, band.lHi]) {
            const got = wcag(ink, relLum(...fillPixel(layer, v, veil, scrim)))
            const cost = (flat - got) / flat
            if (cost > MAX_TEXTURE_COST) {
              failures.push(`${set}/${accent}/${dark ? 'dark' : 'light'} loses ${(cost * 100).toFixed(0)}%`)
            }
          }
        }
      }
      expect(failures, `grain is eating the label: ${failures.join(', ')}`).toEqual([])
    })
  }
})
