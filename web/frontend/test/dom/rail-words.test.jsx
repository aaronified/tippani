// The nav rail drops its words before it clips them.
//
// WHAT THIS GUARDS IS A SILENT CLIP. Above RAIL_WORDS_MAX the rail falls back to
// the glyph-only mode it already uses below 1180px, because its labels no longer
// fit a 236px column — measured in a real browser at 1280px, where 150% cuts
// "Catalogue" by 6px and "Metadata" by 24px in English. Six pixels off the end of
// a word does not read as a bug, it reads as a slightly odd word, so nothing on
// screen would report this going wrong.
//
// It lives in dom/ rather than pure/ because applyTypeScale writes to <html> and
// returns early with no document — a pure test of it would pass by doing nothing.

import { afterEach, describe, expect, it } from 'vitest'
import { RAIL_WORDS_MAX, TYPE_FACTORS, TYPE_FACTOR_MAX, applyTypeScale } from '../../src/type.js'

const railFor = (ui) => {
  applyTypeScale({ sizeUi: ui })
  return document.documentElement.dataset.rail
}

afterEach(() => {
  delete document.documentElement.dataset.rail
})

describe('the rail follows the interface dial', () => {
  it('drops them at every dial above that', () => {
    const tooBig = TYPE_FACTORS.filter((f) => f > RAIL_WORDS_MAX)
    expect(tooBig.length).toBeGreaterThan(0)
    for (const factor of tooBig) expect(railFor(factor)).toBe('icons')
  })

  // BOTH DIRECTIONS, because the attribute is set on one branch and deleted on
  // the other: a version that only ever set it would leave the rail in glyphs for
  // the rest of the session after one visit to a large dial.
  it('puts them back when the dial comes down again', () => {
    expect(railFor(TYPE_FACTOR_MAX)).toBe('icons')
    expect(railFor(100)).toBeUndefined()
  })

})
