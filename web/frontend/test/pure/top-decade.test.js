// The decade superlative, derived from the per-year timeline.
//
// The server sends one bucket per year on purpose: which scale to read them at
// is a question about the library and the screen, not about the data. So the
// decade lives here, and the one thing it must get right is the era boundary —
// truncating division rounds -479 UP to -470 and files the Analects in the
// wrong decade, which is the classic sign error in date bucketing and shows up
// on no CE data at all.

import { describe, expect, it } from 'vitest'
import { decadeLabel, topDecade } from '../../src/StatsPage.jsx'

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

  it('answers null for an empty or quoteless timeline', () => {
    expect(topDecade([])).toBeNull()
    expect(topDecade(null)).toBeNull()
    expect(topDecade(undefined)).toBeNull()
    expect(topDecade([b(1990, 0, 3)])).toBeNull()
  })
})

describe('decadeLabel', () => {
  it('writes a decade the way it is said', () => {
    expect(decadeLabel(1990)).toBe('1990s')
    expect(decadeLabel(0)).toBe('0s')
    // The 480s BCE runs from 489 to 480, so the spoken number is the higher
    // absolute value — which is what the stored start already is.
    expect(decadeLabel(-480)).toBe('480s BCE')
    expect(decadeLabel(-2100)).toBe('2100s BCE')
  })
})
