// What a destination says about itself, on both navs at once.
//
// THE RULE THIS PINS: a row that leads to a container and the things inside it
// says both numbers. Library is books and their highlights, the Catalogue is
// titles and their lines, Quotes is boards and their quotes, Anthologies is
// anthologies and their entries. A row that leads to one thing — a gap count, a
// streak, a version — still says one.
//
// TAGS LEFT THIS FILE WITH ITS ROW. It is a section of the metadata console now, so
// neither nav can ask about it and `navBadge` has no branch for it; the size of that
// section is stated on the console's own rail. The assertions below went with the
// branch rather than being left to test a key nothing passes.
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
    ['anthologies', '3 | 47'],
  ])('%s', (key, want) => {
    expect(navBadge(key, { stats: STATS })).toBe(want)
  })

})

