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
