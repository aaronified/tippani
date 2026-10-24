// The long empty stretches in the stats timeline.
//
// The gaps were already the point: the chart draws every empty bucket so that
// 380 BCE and 1600 CE read as two millennia apart rather than as two adjacent
// bars. What it did not do was make them worth the width — a library holding
// Meditations and then a shelf of 2020 paperbacks draws about a hundred and
// eighty identical blank columns, which is not a silence you read but a stretch
// of nothing you scroll past.
//
// So the run folds into one element that keeps EXACTLY the width the columns it
// replaces would have had. That last part is what these tests are mostly about:
// fold it to a fixed band and the chart starts lying about time, which is the
// failure the empty buckets were introduced to prevent.

import { describe, expect, it } from 'vitest'
import { bucketTimeline, gapWidth, timelineSegments } from '../../src/StatsPage.jsx'

// A library with Meditations and then a modern shelf: the case the whole feature
// is for.
const MEDITATIONS = [
  { year: 180, works: 1, quotes: 9 },
  { year: 2019, works: 4, quotes: 30 },
  { year: 2020, works: 6, quotes: 51 },
]

const decades = (rows) => bucketTimeline(rows, 10)
const gaps = (segs) => segs.filter((s) => s.type === 'gap')

describe('folding a run of empty buckets', () => {
  it('folds one long run and keeps the buckets either side', () => {
    const segs = timelineSegments(decades(MEDITATIONS))
    expect(segs[0].type).toBe('bucket')
    expect(segs[0].bucket.start).toBe(180)
    expect(segs[1].type).toBe('gap')
    expect(segs[segs.length - 1].type).toBe('bucket')
    expect(gaps(segs)).toHaveLength(1)
  })
})

describe('the gap keeps the width it stands in for', () => {
  it('is as wide as the columns it replaced, to the pixel', () => {
    // THE INVARIANT. Two millennia and two centuries must not draw the same.
    for (const span of [6, 12, 40, 183]) {
      expect(gapWidth(span)).toBe(span * 34 - 4)
    }
  })
})
