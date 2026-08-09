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
  it('finds the decade holding the most quotes', () => {
    expect(topDecade([b(1991, 2), b(1995, 5), b(2003, 3)])).toMatchObject({ start: 1990, quotes: 7 })
  })

  it('floors towards the past on both sides of the era', () => {
    // -479 belongs to the 480s BCE. A truncating divide gives -470, which is a
    // decade the book is not from, on the side of the boundary nobody checks.
    expect(topDecade([b(-479, 3)])).toMatchObject({ start: -480, label: '480s BCE' })
    expect(topDecade([b(-471, 3)])).toMatchObject({ start: -480 })
    expect(topDecade([b(-480, 3)])).toMatchObject({ start: -480 })
  })

  it('does not merge a BCE decade with its CE mirror', () => {
    // -5 and 5 must not both land in a bucket at 0. They are ten years and one
    // era apart.
    const got = topDecade([b(-5, 1), b(5, 9)])
    expect(got.start).toBe(0)
    expect(got.quotes).toBe(9)
  })

  it('ignores years that hold works but no quotes', () => {
    // A shelf full of unquoted books is not a decade you quote from. The tile
    // says "most quoted decade" and has to mean it.
    expect(topDecade([b(1990, 0, 12), b(1850, 2, 1)])).toMatchObject({ start: 1850, quotes: 2 })
  })

  it('breaks ties towards the earlier decade', () => {
    // Stability first — a tile that reshuffles on every reload is noise — and
    // when it must choose, the older answer is the more interesting one here.
    expect(topDecade([b(1990, 4), b(1850, 4)])).toMatchObject({ start: 1850 })
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
