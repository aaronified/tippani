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
  it('is 1 while everything fits at one dot each', () => {
    expect(dotUnit([bucket(3, 9), bucket(1, 12)], 12)).toBe(1)
  })

  it('scales so the tallest column lands on the dot budget', () => {
    // 48 quotes over 12 dots is 4 apiece.
    expect(dotUnit([bucket(2, 48)], 12)).toBe(4)
  })

  it('sizes on the taller SERIES, never on their sum', () => {
    // 7 + 8 = 15, which over a budget of 12 would ask for a unit of 2. Neither
    // column is taller than 8, so one dot each still fits and the unit is 1.
    expect(dotUnit([bucket(7, 8)], 12)).toBe(1)
  })

  it('gives both series the same unit — the works peak can set it', () => {
    // A library of many films and few quotes off them: works is the tall series.
    expect(dotUnit([bucket(60, 3)], 12)).toBe(5)
  })

  it('never returns 0, whatever it is handed', () => {
    for (const empty of [[], null, undefined, [bucket(0, 0)]]) {
      expect(dotUnit(empty, 12)).toBe(1)
    }
  })

  it('rounds the unit up, so the budget is a ceiling and not a target', () => {
    // 13 over 12 is 1.08 — a unit of 1 would want 13 dots and overflow the plot.
    expect(dotUnit([bucket(0, 13)], 12)).toBe(2)
  })
})

describe('dotCount', () => {
  it('draws one dot per item at unit 1', () => {
    expect(dotCount(5, 1)).toBe(5)
  })

  it('draws nothing for nothing', () => {
    // The empty bucket is the gap in time. It must stay empty.
    for (const nil of [0, null, undefined, -3]) expect(dotCount(nil, 4)).toBe(0)
  })

  it('rounds up, so one book is never invisible', () => {
    // The whole point: at a unit of 25, a single quote still shows.
    expect(dotCount(1, 25)).toBe(1)
    expect(dotCount(26, 25)).toBe(2)
  })

  it('survives a nonsense unit rather than dividing by zero', () => {
    expect(dotCount(4, 0)).toBe(4)
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
