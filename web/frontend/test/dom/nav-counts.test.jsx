// What a destination says about itself, on both navs at once.
//
// THE RULE THIS PINS: a row that leads to a container and the things inside it
// says both numbers. Library is books and their highlights, the Catalogue is
// titles and their lines, Quotes is boards and their quotes, Anthologies is
// anthologies and their entries, Tags is tags and their stickers. A row that
// leads to one thing — a gap count, a streak, a version — still says one.
//
// WHY IT IS WORTH A FILE. navBadge is the ONE place both navs read, and the whole
// reason it exists is that two lists of counts is how a rail and a drawer come to
// disagree about how many books there are on the same screen. That only holds
// while the pairs are asserted somewhere; until now nothing rendered them and
// `stats.anthologies` had been read from a payload that never carried it, for as
// long as the drawer had existed, without anything noticing.
import { describe, expect, it } from 'vitest'

import { navBadge, checksBadge } from '../../src/App.jsx'

// The shape /stats actually answers with, so a renamed field fails here rather
// than quietly badging "undefined".
const STATS = {
  books: 412,
  annotations: 9310,
  movies: 88,
  dialogues: 640,
  quotes: 205,
  boards: 6,
  tags: 74,
  stickers: 12,
  anthologies: 3,
  anthology_quotes: 47,
}

describe('a destination that holds things says how many of each', () => {
  it.each([
    ['library', '412 | 9310'],
    ['movies', '88 | 640'],
    ['quotes', '6 | 205'],
    ['tags', '74 | 12'],
    ['anthologies', '3 | 47'],
  ])('%s', (key, want) => {
    expect(navBadge(key, { stats: STATS })).toBe(want)
  })

  it('uses one separator for every pair, including the Checks row', () => {
    // Checks is not a tab and is badged by its own function; the separator is
    // the thing that must not diverge, because two different marks on one rail
    // read as two different kinds of fact.
    const seps = new Set(
      ['library', 'movies', 'quotes', 'tags', 'anthologies']
        .map((k) => navBadge(k, { stats: STATS }).replace(/[0-9]/g, ''))
        .concat(checksBadge(7, 4).replace(/[0-9]/g, '')),
    )
    expect([...seps]).toEqual([' | '])
  })
})

describe('a destination that holds one thing still says one', () => {
  it('metadata counts gaps, not a pair', () => {
    expect(navBadge('metadata', { metaIssues: 5 })).not.toContain(' | ')
  })

  it('stats names the streak and settings the version', () => {
    expect(navBadge('stats', { streak: 9 })).not.toContain(' | ')
    expect(navBadge('settings', { version: '3.1.0' })).toContain('3.1.0')
  })
})

describe('a server that has not been upgraded yet', () => {
  // An older binary behind a newer bundle: the four new keys are absent. Every
  // row must still draw its left-hand number rather than the word "undefined",
  // which is what a bare template literal would have printed.
  it('falls back to zero for a count the payload does not carry', () => {
    const old = { books: 412, annotations: 9310, movies: 88, dialogues: 640, quotes: 205, tags: 74 }
    expect(navBadge('quotes', { stats: old })).toBe('0 | 205')
    expect(navBadge('tags', { stats: old })).toBe('74 | 0')
  })

  // anthologies is the one that stays ABSENT rather than falling back — the row
  // has no count at all until the server sends one, which is the guard that has
  // been quietly doing its job since before the key existed.
  it('draws no anthologies count at all when the key is missing', () => {
    const old = { books: 1, annotations: 1, movies: 1, dialogues: 1, quotes: 1, tags: 1 }
    expect(navBadge('anthologies', { stats: old })).toBeNull()
  })
})
