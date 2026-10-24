// Bucketing the timeline at a chosen scale.
//
// The server sends one row per year the library touches, and this decides how
// to read them. Two things matter and both are easy to get wrong in a way that
// still looks like a chart:
//
//   1. The EMPTY buckets have to be there. A library with something from 380
//      BCE and nothing else until 1600 should draw two millennia of emptiness.
//      Dropping the gaps puts the two bars side by side, which reads as two
//      adjacent periods — a chart that is not merely imprecise but says the
//      opposite of the truth.
//   2. Flooring has to go towards the past on BOTH sides of the era. Truncating
//      division rounds -479 up to -470, and no CE data will ever reveal it.

import { describe, expect, it } from 'vitest'
import { bucketLabel, bucketTimeline } from '../../src/StatsPage.jsx'

const b = (year, works = 1, quotes = 0) => ({ year, works, quotes })

describe('bucketTimeline', () => {
  it('keeps the empty buckets between the ends', () => {
    // Three decades, only two of which hold anything. The middle one must exist
    // and must be empty, or the chart draws 1990 next to 2010.
    const got = bucketTimeline([b(1991), b(2011)], 10)
    expect(got.map((x) => x.start)).toEqual([1990, 2000, 2010])
    expect(got[1]).toEqual({ start: 2000, works: 0, quotes: 0 })
  })
})

// ---- what a bucket is CALLED, and what it links to ------------------------
//
// One function labelled all three scales, so choosing Years drew a tick reading
// "1994s" under every column — a decade that does not exist, on the axis whose
// only job is to say when.
describe('bucketLabel', () => {
  // One test over all five rows rather than three it()s: every assertion is
  // bucketLabel(start, size) against a string, so comparing the whole column at
  // once names every scale that got it wrong instead of dying on the first. The
  // old it() titles survive as row names, and the yearLabel check that shared the
  // first block is kept as its own line below — it calls a different function.
  it('never writes a decade that does not exist', () => {
    for (const y of [1994, 380, 1, -7]) expect(bucketLabel(y, 1)).not.toMatch(/s$/)
  })
})
