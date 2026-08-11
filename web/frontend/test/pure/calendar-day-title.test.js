// What a day on the activity calendar says when you hover it.
//
// The Saves stream counts things you kept, and the count is the whole fact. The
// two review streams count ANSWERS, where the count alone is the less
// interesting half — the dot is shaded by volume, so a day of twelve answers all
// wrong is painted exactly like a day of twelve all right. Those days report the
// ratio as well.
//
// The case that has to be got right is the ABSENT one. The server sends a row
// only for a day with answers on it, and DELETE /review/practice removes those
// rows outright — so after a practice reset every day is a day with no row. A
// missing row must read as "nothing happened", never as "0% correct", which is a
// claim about a session that did not take place.

import { describe, expect, it } from 'vitest'
import { dayTitle } from '../../src/StatsPage.jsx'

const DAY = '11 Aug 2026'

describe('dayTitle · saves', () => {
  it('is the count and the stream noun', () => {
    expect(dayTitle(DAY, { count: 3 }, 'saved', false)).toBe('11 Aug 2026: 3 saved')
  })

  it('says zero rather than going quiet, and never mentions accuracy', () => {
    expect(dayTitle(DAY, { count: 0 }, 'saved', false)).toBe('11 Aug 2026: 0 saved')
  })

  it('ignores a `got` that has no business being there', () => {
    expect(dayTitle(DAY, { count: 4, got: 2 }, 'saved', false)).toBe('11 Aug 2026: 4 saved')
  })
})

describe('dayTitle · quiz & practice', () => {
  it('reports answers and accuracy', () => {
    expect(dayTitle(DAY, { count: 8, got: 6 }, 'reviewed', true)).toBe('11 Aug 2026: 8 answers · 75% correct')
  })

  it('singularises one answer', () => {
    expect(dayTitle(DAY, { count: 1, got: 1 }, 'practised', true)).toBe('11 Aug 2026: 1 answer · 100% correct')
  })

  it('says 0% for a day you got nothing right — that is a real day', () => {
    // Distinct from a day with no row at all, which is the next test.
    expect(dayTitle(DAY, { count: 5, got: 0 }, 'reviewed', true)).toBe('11 Aug 2026: 5 answers · 0% correct')
  })

  it('says "no answers" for a quiet day, not "0% correct"', () => {
    // The whole point: a reset practice history is nothing but quiet days, and
    // none of them may be described as a session you did badly at.
    expect(dayTitle(DAY, { count: 0 }, 'practised', true)).toBe('11 Aug 2026: no answers')
    expect(dayTitle(DAY, { count: 0, got: undefined }, 'practised', true)).toBe('11 Aug 2026: no answers')
  })

  it('falls back to the tally alone when a row carries no `got`', () => {
    // An older server, or any payload where the ratio is not knowable. Reporting
    // the half that is known beats inventing the half that is not.
    expect(dayTitle(DAY, { count: 6 }, 'reviewed', true)).toBe('11 Aug 2026: 6 answers')
  })

  it('rounds the percentage rather than trailing decimals into a tooltip', () => {
    expect(dayTitle(DAY, { count: 3, got: 2 }, 'reviewed', true)).toBe('11 Aug 2026: 3 answers · 67% correct')
  })

  it('never reports more than 100%', () => {
    const out = dayTitle(DAY, { count: 4, got: 4 }, 'reviewed', true)
    expect(out).toBe('11 Aug 2026: 4 answers · 100% correct')
  })
})
