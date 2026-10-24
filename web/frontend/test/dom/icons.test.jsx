// The icon set as a set — one weight, one drawing per meaning, one glyph per
// nav tab.
//
// A glyph's entire job is to be told apart at 24px without a label, and the ways
// that job fails are all silent. The app shipped four instances of the failure
// at once:
//
//   - IconShare and IconUpload were both a tray with an arrow in it, differing
//     by a pixel and a half, appearing in the same rows;
//   - IconExport and IconMetadata were the same three strokes at coordinates
//     half a unit apart, sitting two buttons apart on the Metadata console, one
//     pulling data in and one pushing it out;
//   - App.jsx's nav set redrew the magnifier, the open book and the tray at
//     strokeWidth 2.0 against the shared set's 1.85, so the same picture came in
//     two weights depending on where you saw it;
//   - and the Library tab was the open book the "currently reading" cover badge
//     draws, on screens that show both at once.
//
// None of that throws, none of it looks wrong in isolation, and none of it is
// visible in a screenshot of one screen. So it is asserted mechanically:
// identical geometry between two exported glyphs is a test failure, not a
// judgement call.

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as ui from '../../src/ui.jsx'
import { CONTENT_TABS, DRAWER_TABS, UTILITY_TABS } from '../../src/routes.js'

// Every exported component whose name starts with Icon. Collected by reflection
// rather than listed, so a glyph added tomorrow is covered without anyone
// remembering to add it here — which is the whole point.
const ICONS = Object.entries(ui)
  .filter(([name, v]) => /^Icon[A-Z]/.test(name) && typeof v === 'function' && name !== 'IconButton')
  .sort(([a], [b]) => a.localeCompare(b))

// draw() returns just the geometry: the svg's children, attribute order
// normalised by the DOM itself. Two glyphs with the same drawing return the same
// string however differently their JSX was written.
function draw(Comp) {
  const { container, unmount } = render(<Comp />)
  const svg = container.querySelector('svg')
  const out = {
    box: svg.getAttribute('viewBox'),
    stroke: svg.getAttribute('stroke-width'),
    filled: (svg.getAttribute('fill') || 'none') !== 'none',
    hidden: svg.getAttribute('aria-hidden'),
    geometry: [...svg.children].map((c) => c.outerHTML).join(''),
  }
  unmount()
  return out
}

const drawn = new Map(ICONS.map(([name, Comp]) => [name, draw(Comp)]))

describe('the icon set', () => {

  // One test over every reflected glyph rather than one test per glyph: the
  // assertion is identical for each icon, and the aggregate form names every
  // offender at once instead of dying on the first. Coverage is unchanged —
  // each icon is still checked, as a loop iteration.

  // Likewise one test over every reflected glyph rather than one per glyph.

  it('no two glyphs are the same picture', () => {
    const byGeometry = new Map()
    const clashes = []
    for (const [name, g] of drawn) {
      const key = g.geometry
      if (byGeometry.has(key)) clashes.push(`${byGeometry.get(key)} and ${name}`)
      else byGeometry.set(key, name)
    }
    expect(clashes).toEqual([])
  })

  // Weaker than identity and worth checking separately: two glyphs can differ by
  // a rounding nudge and still be the same drawing to a human. Comparing the
  // geometry with all numbers stripped catches the near-miss that identity
  // misses — which is exactly how Export and Metadata survived.
})

// ---- optical weight -------------------------------------------------------
//
// One glyph per meaning is not the whole job. A glyph also has to look like it
// belongs to the same set at the same size, and the way that fails is by
// FOOTPRINT: two icons drawn at the same stroke weight, side by side in a nav
// strip, read as different sizes when one fills its box and the other fills
// half of it.
//
// The Quotes tab was exactly that. A bare pair of quotation marks spanned 13×10
// of the 24 grid — a little over half the area — while IconBooks beside it spans
// 17×15 and IconReel 17×17. Nothing looked broken; it looked SMALL, which is a
// complaint nobody can act on until it is measured. So it is measured.
//
// jsdom has no getBBox, so the extents come from walking the path data. Only the
// commands this set actually uses are handled, and arcs are taken at their
// endpoints — every arc here rounds a corner INWARD, so endpoints give the true
// extent.
// The true extent of an SVG elliptical arc — endpoint parameterisation converted to
// centre form, then the extrema that actually fall inside the swept range. Standard
// arithmetic (SVG 1.1 F.6.5); it is here rather than approximated because approximating
// it is what let a clipped glyph ship.
function arcExtent(x0, y0, rx, ry, rot, large, sweep, x1, y1, see) {
  see(x0, y0)
  see(x1, y1)
  if (!rx || !ry) return
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const phi = (rot * Math.PI) / 180
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)
  const dx2 = (x0 - x1) / 2
  const dy2 = (y0 - y1) / 2
  const x1p = cosP * dx2 + sinP * dy2
  const y1p = -sinP * dx2 + cosP * dy2
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lam > 1) {
    const k = Math.sqrt(lam)
    rx *= k
    ry *= k
  }
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  let co = den ? Math.sqrt(Math.max(0, num / den)) : 0
  if (!!large === !!sweep) co = -co
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2
  const t0 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx)
  const t1 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx)
  let dt = t1 - t0
  if (sweep && dt < 0) dt += 2 * Math.PI
  if (!sweep && dt > 0) dt -= 2 * Math.PI
  if (!dt) return
  for (const base of [Math.atan2(-ry * sinP, rx * cosP), Math.atan2(ry * cosP, rx * sinP)]) {
    for (let n = -4; n <= 4; n++) {
      const t = base + n * Math.PI
      const frac = (t - t0) / dt
      if (frac < 0 || frac > 1) continue
      see(
        cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
        cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP,
      )
    }
  }
}

function extentOf(svg) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const see = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  for (const el of svg.querySelectorAll('path, circle, rect')) {
    const n = (a) => Number(el.getAttribute(a))
    if (el.tagName.toLowerCase() === 'circle') {
      const [cx, cy, r] = [n('cx'), n('cy'), n('r')]
      see(cx - r, cy - r); see(cx + r, cy + r)
      continue
    }
    if (el.tagName.toLowerCase() === 'rect') {
      see(n('x'), n('y')); see(n('x') + n('width'), n('y') + n('height'))
      continue
    }
    const d = el.getAttribute('d') || ''
    let x = 0, y = 0, sx = 0, sy = 0
    // Split into [command, ...numbers] runs.
    for (const m of d.matchAll(/([MmLlHhVvAaZzCcSsQqTt])([^MmLlHhVvAaZzCcSsQqTt]*)/g)) {
      const cmd = m[1]
      const args = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number)
      const rel = cmd === cmd.toLowerCase()
      switch (cmd.toUpperCase()) {
        case 'M': case 'L': case 'T':
          for (let i = 0; i + 1 < args.length; i += 2) {
            x = rel ? x + args[i] : args[i]
            y = rel ? y + args[i + 1] : args[i + 1]
            if (cmd.toUpperCase() === 'M' && i === 0) { sx = x; sy = y }
            see(x, y)
          }
          break
        case 'H': for (const a of args) { x = rel ? x + a : a; see(x, y) } break
        case 'V': for (const a of args) { y = rel ? y + a : a; see(x, y) } break
        case 'A': // rx ry rot large sweep x y
          // THE SWEEP, NOT JUST THE ENDPOINTS. This read the endpoint alone, which is
          // wrong for exactly the glyphs it matters for: a Phosphor fill draws a disc
          // as one arc whose two endpoints sit near each other while the curve travels
          // half the box away. IconNavCatalogue measured 152 wide that way against a
          // true 216, so the viewBox cropped from it CUT THE DRAWING — the reel lost its
          // left edge on screen and this test called it correct. Fourteen of nineteen
          // fills were out; two were clipping.
          for (let i = 0; i + 6 < args.length; i += 7) {
            const x0 = x
            const y0 = y
            x = rel ? x + args[i + 5] : args[i + 5]
            y = rel ? y + args[i + 6] : args[i + 6]
            arcExtent(x0, y0, args[i], args[i + 1], args[i + 2], args[i + 3], args[i + 4], x, y, see)
          }
          break
        case 'C': case 'S': case 'Q': { // endpoints only; none of these glyphs
          const step = cmd.toUpperCase() === 'C' ? 6 : 4
          for (let i = 0; i + step - 1 < args.length; i += step) {
            x = rel ? x + args[i + step - 2] : args[i + step - 2]
            y = rel ? y + args[i + step - 1] : args[i + step - 1]
            see(x, y)
          }
          break
        }
        case 'Z': x = sx; y = sy; break
      }
    }
  }
  return { w: maxX - minX, h: maxY - minY }
}

