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
import { groupUtterances,  } from '../../src/Quotes.jsx'

const BOSE = { id: 1, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', kind: 'speech' }
const BOSE2 = { id: 2, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', kind: 'speech' }
const FDR = { id: 3, speaker: 'Franklin D. Roosevelt', occasion: 'first inaugural address', occasion_date: '1933-03-04', place: 'Washington', kind: 'letter' }
const PROVERB = { id: 4, speaker: '', occasion: '', occasion_date: '', place: '', kind: '' }

const ALL = [BOSE, BOSE2, FDR, PROVERB]
const labels = (groups) => groups.map((g) => g.label)
const ids = (group) => group.items.map((i) => i.id)

describe('grouping by speaker', () => {
  it('splits a credit naming two people into both buckets', () => {
    // The card and the share image both split the speaker; a grouping that did
    // not would file a joint line under a speaker who does not exist.
    const joint = [{ id: 9, speaker: 'Subhas Chandra Bose, Franklin D. Roosevelt' }]
    const groups = groupUtterances(joint, 'speaker')
    expect(labels(groups)).toEqual(['Franklin D. Roosevelt', 'Subhas Chandra Bose'])
    expect(ids(groups[0])).toEqual([9])
    expect(ids(groups[1])).toEqual([9])
  })
})

describe('every dimension', () => {
  it('keeps every quote, and loses none', () => {
    for (const dim of ['speaker', 'kind', 'place', 'decade']) {
      const seen = new Set()
      for (const g of groupUtterances(ALL, dim)) for (const u of g.items) seen.add(u.id)
      expect([...seen].sort(), dim).toEqual([1, 2, 3, 4])
    }
  })
})
