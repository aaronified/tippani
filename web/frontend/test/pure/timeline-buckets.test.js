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
import { bucketLabel, bucketQuery, bucketTimeline, decadeLabel, TIMELINE_SCALES, yearLabel } from '../../src/StatsPage.jsx'

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
  it('names a bucket at the scale it was cut at', () => {
    const rows = [
      { name: 'names a year as a year', start: 1994, size: 1, want: '1994' },
      { name: 'names a year as a year (BCE)', start: -380, size: 1, want: '380 BCE' },
      { name: 'names a decade as a decade', start: 1990, size: 10, want: '1990s' },
      { name: 'names a decade as a decade (BCE)', start: -380, size: 10, want: '380s BCE' },
      // "1900s" for 1900-1999 is conventional English for a century, the scale
      // selector sits above the chart saying which scale is on, and every column
      // carries its span in a tooltip. It is not precise enough to SEARCH, which is
      // bucketQuery's business rather than this one's.
      { name: 'names a century the way a century is said', start: 1900, size: 100, want: decadeLabel(1900) },
    ]
    const got = rows.map((r) => [r.name, bucketLabel(r.start, r.size)])
    expect(got).toEqual(rows.map((r) => [r.name, r.want]))

    expect(yearLabel(1994)).toBe('1994')
  })

  it('never writes a decade that does not exist', () => {
    for (const y of [1994, 380, 1, -7]) expect(bucketLabel(y, 1)).not.toMatch(/s$/)
  })
})

describe('bucketQuery', () => {
  // One test over all eight rows rather than four it()s: every assertion is
  // bucketQuery(start, size) against a string or null, so comparing the whole
  // column at once names every case that broke instead of dying on the first
  // (toBeNull() becomes a `want: null` row — the same assertion). The old it()
  // titles survive as row names and every rationale rides on its own rows.
  it('asks the server only what the server can answer exactly', () => {
    const rows = [
      // Only a decade has an exact answer on the server. A bare year cannot go
      // through the query box at all ("1984" is a book people own), and a century
      // would be answered WRONG rather than not at all — "1900s" parses as the
      // decade, so a column covering a hundred years would return ten of them and
      // look complete.
      { name: 'offers nothing at year scale', start: 1994, size: 1, want: null },
      { name: 'offers nothing at century scale', start: 1900, size: 100, want: null },
      { name: 'asks for the decade at decade scale', start: 1990, size: 10, want: '1990s' },
      // THE PADDING IS THE POINT. "50s" means the 1950s to the server, and rightly
      // so for somebody typing it — which would send a column holding a gospel to a
      // shelf of mid-century paperbacks and show it as a confident answer.
      { name: 'pads a short year so no shorthand can claim it', start: 50, size: 10, want: '0050s' },
      { name: 'pads a short year so no shorthand can claim it (800)', start: 800, size: 10, want: '0800s' },
      { name: 'pads a short year so no shorthand can claim it (0)', start: 0, size: 10, want: '0000s' },
      // The era suppresses the shorthand on its own, so there is nothing to pad.
      { name: 'keeps the era for BCE, which suppresses the shorthand on its own', start: -380, size: 10, want: '380s BCE' },
      { name: 'keeps the era for BCE (two digits)', start: -80, size: 10, want: '80s BCE' },
    ]
    const got = rows.map((r) => [r.name, bucketQuery(r.start, r.size)])
    expect(got).toEqual(rows.map((r) => [r.name, r.want]))
  })

  // The label is for reading and the query is for the server, and for a short
  // year they are deliberately not the same string. If a refactor ever collapses
  // the two, this is the test that says which one lost.
  it('is not simply the label', () => {
    expect(bucketQuery(50, 10)).not.toBe(bucketLabel(50, 10))
    expect(bucketLabel(50, 10)).toBe('50s')
  })
})
