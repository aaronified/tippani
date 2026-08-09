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
import { bucketTimeline, TIMELINE_SCALES } from '../../src/StatsPage.jsx'

const b = (year, works = 1, quotes = 0) => ({ year, works, quotes })

describe('bucketTimeline', () => {
  it('sums the years inside each bucket', () => {
    const got = bucketTimeline([b(1991, 1, 2), b(1995, 3, 4), b(2003, 1, 1)], 10)
    expect(got).toEqual([
      { start: 1990, works: 4, quotes: 6 },
      { start: 2000, works: 1, quotes: 1 },
    ])
  })

  it('keeps the empty buckets between the ends', () => {
    // Three decades, only two of which hold anything. The middle one must exist
    // and must be empty, or the chart draws 1990 next to 2010.
    const got = bucketTimeline([b(1991), b(2011)], 10)
    expect(got.map((x) => x.start)).toEqual([1990, 2000, 2010])
    expect(got[1]).toEqual({ start: 2000, works: 0, quotes: 0 })
  })

  it('spans an era boundary without losing the middle', () => {
    const got = bucketTimeline([b(-20), b(15)], 10)
    expect(got.map((x) => x.start)).toEqual([-20, -10, 0, 10])
  })

  it('floors towards the past on both sides of the boundary', () => {
    // -479 is in the 480s BCE. Truncation would put it in the 470s.
    expect(bucketTimeline([b(-479)], 10)[0].start).toBe(-480)
    expect(bucketTimeline([b(-479)], 100)[0].start).toBe(-500)
    expect(bucketTimeline([b(479)], 100)[0].start).toBe(400)
  })

  it('scales to centuries without changing shape', () => {
    const got = bucketTimeline([b(-479, 1, 5), b(-401, 2, 1), b(1922, 1, 3)], 100)
    expect(got[0]).toEqual({ start: -500, works: 3, quotes: 6 })
    expect(got[got.length - 1]).toEqual({ start: 1900, works: 1, quotes: 3 })
    // -500 to 1900 in centuries is 25 buckets, nearly all of them empty. That is
    // the honest picture of this library and the reason the scale is selectable.
    expect(got.length).toBe(25)
  })

  it('gives one bucket per year at year scale', () => {
    const got = bucketTimeline([b(1990), b(1992)], 1)
    expect(got.map((x) => x.start)).toEqual([1990, 1991, 1992])
  })

  it('answers empty for nothing at all', () => {
    for (const empty of [[], null, undefined, [{ year: null }]]) {
      expect(bucketTimeline(empty, 10)).toEqual([])
    }
  })
})

describe('TIMELINE_SCALES', () => {
  it('offers exactly the scales that were asked for', () => {
    expect(TIMELINE_SCALES.map((x) => x.key)).toEqual(['decade', 'century', 'year'])
    // Decades first: it is the default and the one a mostly-modern library
    // reads at. Millennium was considered and dropped — four bars is a shape,
    // not a chart.
    expect(TIMELINE_SCALES[0].size).toBe(10)
    expect(TIMELINE_SCALES.map((x) => x.size)).toEqual([10, 100, 1])
  })
})
