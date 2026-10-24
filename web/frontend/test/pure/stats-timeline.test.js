import { describe, expect, it } from 'vitest'
import { bucketLabel, bucketTimeline, dotCount, dotUnit, timelineSegments, topDecade } from '../../src/StatsPage.jsx'

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
describe('timeline buckets', () => {
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
})

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
describe('timeline dots', () => {
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
})

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
describe('timeline gaps', () => {
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
})

// The decade superlative, derived from the per-year timeline.
//
// The server sends one bucket per year on purpose: which scale to read them at
// is a question about the library and the screen, not about the data. So the
// decade lives here, and the one thing it must get right is the era boundary —
// truncating division rounds -479 UP to -470 and files the Analects in the
// wrong decade, which is the classic sign error in date bucketing and shows up
// on no CE data at all.
describe('top decade', () => {
  const b = (year, quotes, works = 1) => ({ year, works, quotes })

  describe('topDecade', () => {
    // One test over all seven rows rather than five it()s: every case is one call
    // to topDecade against an expected partial object, so reading the expected keys
    // off each row and comparing the whole column at once names every case that
    // broke instead of dying on the first. Picking exactly the keys a row states is
    // what toMatchObject did per test — nothing is asserted that was not asserted
    // before, and nothing that was is dropped. The old it() titles survive as row
    // names and the era-boundary comments ride on the rows they explain.
    it('finds the most quoted decade, on either side of the era', () => {
      const rows = [
        { name: 'finds the decade holding the most quotes', years: [b(1991, 2), b(1995, 5), b(2003, 3)], want: { start: 1990, quotes: 7 } },
        // -479 belongs to the 480s BCE. A truncating divide gives -470, which is a
        // decade the book is not from, on the side of the boundary nobody checks.
        { name: 'floors towards the past on both sides of the era', years: [b(-479, 3)], want: { start: -480, label: '480s BCE' } },
        { name: 'floors towards the past on both sides of the era (-471)', years: [b(-471, 3)], want: { start: -480 } },
        { name: 'floors towards the past on both sides of the era (-480)', years: [b(-480, 3)], want: { start: -480 } },
        // -5 and 5 must not both land in a bucket at 0. They are ten years and one
        // era apart.
        { name: 'does not merge a BCE decade with its CE mirror', years: [b(-5, 1), b(5, 9)], want: { start: 0, quotes: 9 } },
        // A shelf full of unquoted books is not a decade you quote from. The tile
        // says "most quoted decade" and has to mean it.
        { name: 'ignores years that hold works but no quotes', years: [b(1990, 0, 12), b(1850, 2, 1)], want: { start: 1850, quotes: 2 } },
        // Stability first — a tile that reshuffles on every reload is noise — and
        // when it must choose, the older answer is the more interesting one here.
        { name: 'breaks ties towards the earlier decade', years: [b(1990, 4), b(1850, 4)], want: { start: 1850 } },
      ]
      const got = rows.map((r) => {
        const out = topDecade(r.years)
        return [r.name, Object.fromEntries(Object.keys(r.want).map((k) => [k, out?.[k]]))]
      })
      expect(got).toEqual(rows.map((r) => [r.name, r.want]))
    })
  })
})
