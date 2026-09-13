// A GLYPH A CALLER SIZES IS A GLYPH THAT TAKES A SIZE.
//
// FOUND FROM A MISALIGNMENT. Two counts on a character sheet — `3 QUOTES` and
// `1 SCENE` — did not line up, and the cause was not the CSS: both call sites
// wrote `size={15}` and one of the glyphs did not accept the prop, so it drew at
// the 24px default and pushed everything after it nine pixels along. The caller
// asked, the component ignored, and React says nothing about an unknown prop on
// a component.
//
// THE SWEEP FOUND FOUR, across eight call sites: `IconBack`, `IconCheck`,
// `IconDelete` and `IconQuote` were declared `()` while callers passed a size.
// Every one of them drew at 24 wherever it was asked for something smaller, and
// nothing looked broken enough to report — which is what makes this a test
// rather than a fix.
//
// THE PROPERTY, and it is a repo rule rather than a fact about those four: if
// ANY call site passes `size` to a glyph, that glyph's declaration must take it.
// The reverse is not required — a glyph nobody sizes needs no parameter, and
// adding one to all sixty would be noise.
//
// READ FROM THE SOURCE because it is a fact about declarations. jsdom would
// answer it too, one glyph at a time, from a fixture naming each of sixty
// components — which is the same assertion written sixty times and forgotten on
// the sixty-first.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that the glyphs
// live in `ui.jsx` and are used across `src/`.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const files = sourcesUnder((n) => /\.jsx?$/.test(n), 60)
const sources = Object.fromEntries(files.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]))

// Every glyph a call site asks to size, and where it asked.
const sized = new Map()
for (const [file, text] of Object.entries(sources)) {
  for (const m of text.matchAll(/<(Icon[A-Za-z0-9]*)\s[^>]*\bsize=/g)) {
    if (!sized.has(m[1])) sized.set(m[1], [])
    sized.get(m[1]).push(file)
  }
}

// What each glyph's declaration takes.
const declares = new Map()
for (const text of Object.values(sources)) {
  for (const m of text.matchAll(/export function (Icon[A-Za-z0-9]*)\s*\(([^)]*)\)/g)) {
    declares.set(m[1], m[2])
  }
}

describe('a glyph asked for a size', () => {
  it('is being asked at all — the sweep still finds call sites', () => {
    expect(sized.size, 'no call site passes `size` to a glyph any more; this guard is reading nothing')
      .toBeGreaterThan(5)
  })

  it.each([...sized.keys()].map((n) => [n, n]))('%s takes one', (_l, name) => {
    const params = declares.get(name)
    // A glyph declared in another module is out of this file's reach; skip rather
    // than fail, and the case above keeps the set from emptying.
    if (params === undefined) return
    expect(params.includes('size'),
      `${name} is declared \`(${params})\` and ${sized.get(name).join(', ')} pass it a size — ` +
      'it draws at the default and pushes whatever is beside it')
      .toBe(true)
  })
})
