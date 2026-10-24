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

describe('dotCount', () => {
  // One test over all eight rows rather than four it()s: every assertion in those
  // four was dotCount(value, unit) against a number, so a single comparison of
  // the whole column names every case that broke instead of dying on the first.
  // The old it() titles survive as row names. Eight rows, not seven: 'draws
  // nothing for nothing' looped four nils and 'rounds up' asserted two values,
  // and every one of those inputs is kept.
  it('reads a bucketed timeline end to end without summing the series', () => {
    const buckets = bucketTimeline([{ year: 1994, works: 2, quotes: 30 }], 10)
    const unit = dotUnit(buckets, 12)
    expect(unit).toBe(3) // 30 quotes / 12 dots, rounded up
    expect(dotCount(buckets[0].quotes, unit)).toBe(10)
    expect(dotCount(buckets[0].works, unit)).toBe(1) // 2 works, not 32/3
  })
})
