// The timeline's dot plot: how many dots a bucket draws, and what one is worth.
//
// The chart was a stacked bar and is two columns of dots now. Three properties
// carry the whole reading of it, and each of them is easy to break in a way that
// still renders as a plausible chart:
//
//   1. ONE scale for both series. Works and quotes are separate columns, so if
//      each sized itself to its own peak the two halves of a bucket would carry
//      different pitches and a reader would compare a ratio that is not there.
//   2. Anything at all draws SOMETHING. A decade holding one book must not come
//      out as an empty column — empty is the mark reserved for holding nothing,
//      and it is what the gaps between buckets are drawn with.
//   3. Nothing is ever summed. A work and a quote are not two of the same thing;
//      the old stack added them into a height that meant nothing in particular.

import { describe, expect, it } from 'vitest'
import { bucketTimeline, dotCount, dotUnit } from '../../src/StatsPage.jsx'

const bucket = (works, quotes) => ({ start: 1900, works, quotes })

describe('dotUnit', () => {
  // One test over all five rows rather than five it()s: every case is the same
  // one-line call — dotUnit(buckets, 12) — differing only in the bucket list and
  // the expected unit, so comparing the whole column at once names every case
  // that broke instead of dying on the first. The old it() titles survive as row
  // names and each rationale rides on its own row: the arithmetic in those
  // comments is the reason each row exists.
  it('sizes one dot for both series', () => {
    const rows = [
      { name: 'is 1 while everything fits at one dot each', buckets: [bucket(3, 9), bucket(1, 12)], want: 1 },
      // 48 quotes over 12 dots is 4 apiece.
      { name: 'scales so the tallest column lands on the dot budget', buckets: [bucket(2, 48)], want: 4 },
      // 7 + 8 = 15, which over a budget of 12 would ask for a unit of 2. Neither
      // column is taller than 8, so one dot each still fits and the unit is 1.
      { name: 'sizes on the taller SERIES, never on their sum', buckets: [bucket(7, 8)], want: 1 },
      // A library of many films and few quotes off them: works is the tall series.
      { name: 'gives both series the same unit — the works peak can set it', buckets: [bucket(60, 3)], want: 5 },
      // 13 over 12 is 1.08 — a unit of 1 would want 13 dots and overflow the plot.
      { name: 'rounds the unit up, so the budget is a ceiling and not a target', buckets: [bucket(0, 13)], want: 2 },
    ]
    const got = rows.map((r) => [r.name, dotUnit(r.buckets, 12)])
    expect(got).toEqual(rows.map((r) => [r.name, r.want]))
  })

  it('never returns 0, whatever it is handed', () => {
    for (const empty of [[], null, undefined, [bucket(0, 0)]]) {
      expect(dotUnit(empty, 12)).toBe(1)
    }
  })
})

describe('dotCount', () => {
  // One test over all eight rows rather than four it()s: every assertion in those
  // four was dotCount(value, unit) against a number, so a single comparison of
  // the whole column names every case that broke instead of dying on the first.
  // The old it() titles survive as row names. Eight rows, not seven: 'draws
  // nothing for nothing' looped four nils and 'rounds up' asserted two values,
  // and every one of those inputs is kept.
  it('counts the dots a value is worth at a given unit', () => {
    const rows = [
      { name: 'draws one dot per item at unit 1', value: 5, unit: 1, want: 5 },
      // The empty bucket is the gap in time. It must stay empty.
      { name: 'draws nothing for nothing (0)', value: 0, unit: 4, want: 0 },
      { name: 'draws nothing for nothing (null)', value: null, unit: 4, want: 0 },
      { name: 'draws nothing for nothing (undefined)', value: undefined, unit: 4, want: 0 },
      { name: 'draws nothing for nothing (-3)', value: -3, unit: 4, want: 0 },
      // The whole point: at a unit of 25, a single quote still shows.
      { name: 'rounds up, so one book is never invisible', value: 1, unit: 25, want: 1 },
      { name: 'rounds up, so one book is never invisible (26 over 25)', value: 26, unit: 25, want: 2 },
      { name: 'survives a nonsense unit rather than dividing by zero', value: 4, unit: 0, want: 4 },
    ]
    const got = rows.map((r) => [r.name, dotCount(r.value, r.unit)])
    expect(got).toEqual(rows.map((r) => [r.name, r.want]))
  })

  it('keeps the tallest column inside the budget it was sized for', () => {
    const buckets = [bucket(2, 137), bucket(90, 4), bucket(0, 0)]
    const unit = dotUnit(buckets, 12)
    for (const b of buckets) {
      expect(dotCount(b.quotes, unit)).toBeLessThanOrEqual(12)
      expect(dotCount(b.works, unit)).toBeLessThanOrEqual(12)
    }
  })

  it('reads a bucketed timeline end to end without summing the series', () => {
    const buckets = bucketTimeline([{ year: 1994, works: 2, quotes: 30 }], 10)
    const unit = dotUnit(buckets, 12)
    expect(unit).toBe(3) // 30 quotes / 12 dots, rounded up
    expect(dotCount(buckets[0].quotes, unit)).toBe(10)
    expect(dotCount(buckets[0].works, unit)).toBe(1) // 2 works, not 32/3
  })
})
