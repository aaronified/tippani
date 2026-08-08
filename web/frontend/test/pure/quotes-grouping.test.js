// Grouping a shelf of quotes that belong to no work.
//
// The Quotes screen was built as a flat list on the reasoning that a standalone
// quote has no parent, so there is nothing to group by. What a book gives you is
// a TITLE, and this kind has four things of that sort — who said it, through
// what medium, where, and when — so these are the piles it makes instead.
//
// The residual bucket carries more weight here than on the other two screens: a
// proverb has no speaker, no medium, no place and no date, so it lands in the
// catch-all of every dimension and its label has to say which thing is missing.

import { describe, expect, it } from 'vitest'
import { groupUtterances, utteranceYear } from '../../src/Quotes.jsx'

const BOSE = { id: 1, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', medium: 'radio' }
const BOSE2 = { id: 2, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', medium: 'radio' }
const FDR = { id: 3, speaker: 'Franklin D. Roosevelt', occasion: 'first inaugural address', occasion_date: '1933-03-04', place: 'Washington', medium: 'speech' }
const PROVERB = { id: 4, speaker: '', occasion: '', occasion_date: '', place: '', medium: '' }

const ALL = [BOSE, BOSE2, FDR, PROVERB]
const labels = (groups) => groups.map((g) => g.label)
const ids = (group) => group.items.map((i) => i.id)

describe('utteranceYear', () => {
  it('reads a bare year', () => {
    expect(utteranceYear({ occasion_date: '1944' })).toBe(1944)
  })

  it('reads the year out of a fuller partial date', () => {
    expect(utteranceYear({ occasion_date: '1933-03-04' })).toBe(1933)
    expect(utteranceYear({ occasion_date: '1933-03' })).toBe(1933)
  })

  it('is null when there is no date', () => {
    expect(utteranceYear({ occasion_date: '' })).toBeNull()
    expect(utteranceYear({})).toBeNull()
  })

  it('is null rather than NaN for a date that is not one', () => {
    // NaN would flow into decadeOf and produce a group labelled "NaNs".
    for (const bad of ['abcd', '--', 'the 1940s']) {
      expect(utteranceYear({ occasion_date: bad }), bad).toBeNull()
    }
  })
})

describe('grouping by speaker', () => {
  it('buckets by speaker, alphabetically, proverbs last', () => {
    expect(labels(groupUtterances(ALL, 'speaker'))).toEqual([
      'Franklin D. Roosevelt',
      'Subhas Chandra Bose',
      'No speaker',
    ])
  })

  it('keeps both lines from one speaker together', () => {
    const g = groupUtterances(ALL, 'speaker').find((x) => x.label === 'Subhas Chandra Bose')
    expect(ids(g)).toEqual([1, 2])
  })

  it('splits a credit naming two people into both buckets', () => {
    // The card and the share image both split the speaker; a grouping that did
    // not would file a joint line under a speaker who does not exist.
    const joint = [{ id: 9, speaker: 'Subhas Chandra Bose, Franklin D. Roosevelt' }]
    const groups = groupUtterances(joint, 'speaker')
    expect(labels(groups)).toEqual(['Franklin D. Roosevelt', 'Subhas Chandra Bose'])
    expect(ids(groups[0])).toEqual([9])
    expect(ids(groups[1])).toEqual([9])
  })

  it('names the residual bucket for the thing that is missing', () => {
    const g = groupUtterances(ALL, 'speaker').find((x) => x.residual)
    expect(g.label).toBe('No speaker')
    expect(ids(g)).toEqual([4])
  })
})

describe('grouping by medium and place', () => {
  it('buckets by medium', () => {
    expect(labels(groupUtterances(ALL, 'medium'))).toEqual(['radio', 'speech', 'No medium'])
  })

  it('buckets by place', () => {
    expect(labels(groupUtterances(ALL, 'place'))).toEqual(['Burma', 'Washington', 'No place'])
  })

  // These two go through the generic facet branch, which reads u[dim]. If that
  // accessor were wrong the groups would silently all be residual — every quote
  // in one "None" pile, which looks like a screen with no data rather than a bug.
  it('does not put everything in the residual bucket', () => {
    for (const dim of ['medium', 'place']) {
      const groups = groupUtterances(ALL, dim)
      expect(groups.filter((g) => g.residual)).toHaveLength(1)
      expect(groups.length, dim).toBeGreaterThan(1)
    }
  })

  it('names each residual for its own dimension', () => {
    expect(groupUtterances(ALL, 'medium').at(-1).label).toBe('No medium')
    expect(groupUtterances(ALL, 'place').at(-1).label).toBe('No place')
  })
})

describe('grouping by decade', () => {
  it('buckets by decade, newest first', () => {
    expect(labels(groupUtterances(ALL, 'decade'))).toEqual(['1940s', '1930s', 'Unknown year'])
  })

  it('floors a full partial date to its decade', () => {
    const g = groupUtterances(ALL, 'decade').find((x) => x.label === '1930s')
    expect(ids(g)).toEqual([3]) // 1933-03-04
  })

  it('keeps centuries apart', () => {
    // decadeOf floors the full 4-digit year, so an 1850s letter is not a 1950s one.
    const old = [{ id: 1, occasion_date: '1850' }, { id: 2, occasion_date: '1950' }]
    expect(labels(groupUtterances(old, 'decade'))).toEqual(['1950s', '1850s'])
  })
})

describe('every dimension', () => {
  it('keeps every quote, and loses none', () => {
    for (const dim of ['speaker', 'medium', 'place', 'decade']) {
      const seen = new Set()
      for (const g of groupUtterances(ALL, dim)) for (const u of g.items) seen.add(u.id)
      expect([...seen].sort(), dim).toEqual([1, 2, 3, 4])
    }
  })

  it('files the proverb in the residual of all four', () => {
    for (const dim of ['speaker', 'medium', 'place', 'decade']) {
      const residual = groupUtterances(ALL, dim).find((g) => g.residual)
      expect(residual, dim).toBeTruthy()
      expect(ids(residual), dim).toEqual([4])
    }
  })

  it('returns nothing for an empty shelf', () => {
    for (const dim of ['speaker', 'medium', 'place', 'decade']) {
      expect(groupUtterances([], dim), dim).toEqual([])
    }
  })
})
