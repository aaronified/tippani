// A GLYPH ASKED FOR A SIZE IS DRAWN AT IT.
//
// THE SIBLING TO `pure/glyph-size.test.js`, AND THE HALF THAT MATTERS. That one
// reads declarations: it fails a glyph declared `()` whose callers pass `size`,
// which is the shape four of them shipped in. It cannot fail a glyph declared
// `({ size })` that never puts the number on the element — and the defect was
// never the parameter, it was the drawing. `IconQuote` at `size={15}` rendered a
// 24px box and pushed the number and the caption beside it nine pixels along, on
// a row whose whole job is to line up with the row next to it.
//
// SO THIS RENDERS THEM. jsdom lays nothing out, but it does hold attributes, and
// what an SVG is drawn at is an attribute — so `width` is readable here even
// though the box it occupies is not.
//
// EVERY GLYPH A CALLER SIZES, not a list typed out here: the list is derived from
// the call sites, so a glyph that gains a `size=` somewhere gains a case, and one
// that loses its last caller loses one. A fixed list is a list that goes stale on
// the file that adds the sixty-first glyph.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the glyphs are
// exported from `ui.jsx`.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import * as ui from '../../src/ui.jsx'

afterEach(() => cleanup())

const SRC = process.env.TIPPANI_SRC
const names = new Set()
for (const f of readdirSync(SRC).filter((n) => /\.jsx?$/.test(n))) {
  for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/<(Icon[A-Za-z0-9]*)\s[^>]*\bsize=/g)) {
    if (typeof ui[m[1]] === 'function') names.add(m[1])
  }
}
const SIZED = [...names]

describe('a glyph a caller sizes', () => {
  it('is found by reading the call sites, and there are some', () => {
    expect(SIZED.length, 'no sizable glyph was found — the derivation has drifted').toBeGreaterThan(5)
  })

  it.each(SIZED.map((n) => [n, n]))('%s draws at the size it is given', (_l, name) => {
    const Glyph = ui[name]
    const { container } = render(<Glyph size={11} />)
    const svg = container.querySelector('svg')
    expect(svg, `${name} rendered no svg at all`).toBeTruthy()
    expect(svg.getAttribute('width'),
      `${name} accepts a size and draws at ${svg.getAttribute('width') || 'its own default'} — ` +
      'whatever is beside it moves')
      .toBe('11')
    expect(svg.getAttribute('height'), `${name} is drawn ${svg.getAttribute('height')} tall for a width of 11`).toBe('11')
  })
})
