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
import { BOTTOM_TABS, CONTENT_TABS, DRAWER_TABS, UTILITY_TABS } from '../../src/routes.js'

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
  it('is not empty and was collected by reflection', () => {
    expect(ICONS.length).toBeGreaterThan(25)
  })

  it.each(ICONS.map(([n]) => n))('%s is hidden from screen readers', (name) => {
    // Every one of these sits inside a control that carries the words, so the
    // glyph itself must not be announced as well.
    expect(drawn.get(name).hidden).toBe('true')
  })

  it.each(ICONS.map(([n]) => n))('%s draws at one stroke weight', (name) => {
    const g = drawn.get(name)
    // The view-toggle glyphs are a different size class: 15px in a 16 viewBox,
    // inline beside their own words. Everything on the 24 grid is 1.85.
    if (g.box !== '0 0 24 24') return
    if (g.filled) return // IconQuote is filled, not stroked — see its comment
    expect(g.stroke).toBe('1.85')
  })

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
  it('no two glyphs are the same picture at different coordinates', () => {
    const shapeOf = (g) => g.geometry.replace(/-?\d*\.?\d+/g, '#')
    const byShape = new Map()
    const clashes = []
    for (const [name, g] of drawn) {
      const key = shapeOf(g)
      if (byShape.has(key)) clashes.push(`${byShape.get(key)} and ${name}`)
      else byShape.set(key, name)
    }
    expect(clashes).toEqual([])
  })
})

describe('NavIcon', () => {
  const tabs = [...new Set([
    ...CONTENT_TABS.map((t) => t[0]),
    ...UTILITY_TABS.map((t) => t[0]),
    ...DRAWER_TABS.filter(Boolean).map((t) => t[0]),
    ...BOTTOM_TABS.map((t) => t[0]),
  ])].sort()

  // The nav strip collapses to icon-only when the window is narrow. A tab with
  // no case in the switch renders nothing there — not a fallback, nothing — so
  // it becomes an invisible gap in the strip rather than an error.
  it.each(tabs)('%s has a glyph', (tab) => {
    const { container } = render(<ui.NavIcon name={tab} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('an unknown tab renders nothing rather than throwing', () => {
    const { container } = render(<ui.NavIcon name="nope" />)
    expect(container.innerHTML).toBe('')
  })

  it('every nav glyph comes from the shared set', () => {
    const known = new Set([...drawn.values()].map((g) => g.geometry))
    for (const tab of tabs) {
      const { container } = render(<ui.NavIcon name={tab} />)
      const svg = container.querySelector('svg')
      const geometry = [...svg.children].map((c) => c.outerHTML).join('')
      expect(known.has(geometry), `${tab} draws a glyph that is not an exported Icon`).toBe(true)
    }
  })
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
        case 'A': // rx ry rot large sweep x y — endpoint only
          for (let i = 0; i + 6 < args.length; i += 7) {
            x = rel ? x + args[i + 5] : args[i + 5]
            y = rel ? y + args[i + 6] : args[i + 6]
            see(x, y)
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

describe('the nav glyphs carry the same optical weight', () => {
  const NAV = ['IconQuote', 'IconBooks', 'IconReel', 'IconHome', 'IconStats']
  const area = (name) => {
    const Comp = ui[name] // as an element, not a call: most take a `size` prop
    const { container, unmount } = render(<Comp />)
    const e = extentOf(container.querySelector('svg'))
    unmount()
    return e
  }

  it.each(NAV)('%s fills its box like the tabs beside it', (name) => {
    const { w, h } = area(name)
    // The set's own range, measured: nothing narrower than 14 or shorter than 13
    // of the 24 grid. A glyph under that reads as a smaller icon rather than a
    // different one.
    expect(w, `${name} width`).toBeGreaterThanOrEqual(14)
    expect(h, `${name} height`).toBeGreaterThanOrEqual(13)
    expect(w, `${name} width`).toBeLessThanOrEqual(19)
    expect(h, `${name} height`).toBeLessThanOrEqual(19)
  })

  it('Quotes is no smaller than the two tabs it sits between', () => {
    // The reported bug, stated as the thing that was actually wrong.
    const q = area('IconQuote')
    for (const neighbour of ['IconBooks', 'IconReel']) {
      const n = area(neighbour)
      expect(q.w, `Quotes vs ${neighbour} width`).toBeGreaterThanOrEqual(n.w - 1)
      expect(q.h, `Quotes vs ${neighbour} height`).toBeGreaterThanOrEqual(n.h - 1)
    }
  })
})
