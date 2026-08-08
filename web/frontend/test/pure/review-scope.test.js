// parseScope — the client's reading of the srReviewScope preference, which must
// match the server's scopeFlags exactly.
//
// Two parsers of one string is the shape that drifts, and the cost of drift here
// is specific: the Settings screen shows chips that do not describe the deck you
// are actually being served. Nothing errors, and the deck looks like a
// preference you set.
//
// The Go side has the same table in review_mixed_test.go. Keeping both is the
// point — the agreement is what is being asserted, and one test cannot assert it
// from only one side.

import { describe, expect, it } from 'vitest'
import { parseScope } from '../../src/Settings.jsx'

const ALL = ['books', 'movies', 'quotes']

describe('parseScope', () => {
  it.each([
    ['books', ['books']],
    ['movies', ['movies']],
    ['quotes', ['quotes']],
    ['books,quotes', ['books', 'quotes']],
    ['movies,quotes', ['movies', 'quotes']],
    ['books,movies,quotes', ALL],
  ])('%s', (input, want) => {
    expect(parseScope(input)).toEqual(want)
  })

  it('honours the legacy words every existing account has stored', () => {
    // "both" predates standalone quotes and means all three — leaving them out
    // of an existing reader's deck until they found a setting would have read as
    // the feature being broken. "screen" is the other name for films and shows.
    expect(parseScope('both')).toEqual(ALL)
    expect(parseScope('screen')).toEqual(['movies'])
  })

  it('is not a list, it is a set: order and spacing are not meaning', () => {
    expect(parseScope('quotes,books')).toEqual(['books', 'quotes'])
    expect(parseScope(' Books , Quotes ')).toEqual(['books', 'quotes'])
    expect(parseScope('books,books')).toEqual(['books'])
  })

  it('returns the media in a fixed order whatever order they were stored in', () => {
    // The chips render from this, so a reader who ticks quotes before books must
    // not find the row rearranged underneath them on the next visit.
    expect(parseScope('quotes,movies,books')).toEqual(ALL)
  })

  it.each(['', '   ', 'nonsense', ',,,', null, undefined])(
    'falls back to everything, never nothing: %s',
    (input) => {
      // The one rule that cannot bend. An empty scope is a deck with no cards in
      // it, which is indistinguishable from a deck you have finished for the day
      // — and it would never say which. Mirrors scopeFlags on the server.
      expect(parseScope(input)).toEqual(ALL)
    },
  )

  it('drops a token it does not know rather than failing the whole read', () => {
    // The client is lenient where the SERVER is strict, and the asymmetry is
    // deliberate: the server refuses to store a scope with rubbish in it, so a
    // bad token can only reach here from a hand-edited database or a future
    // version's value. Rendering the part that is understood beats rendering
    // nothing, because the alternative shows a reader no chips at all.
    expect(parseScope('books,poems')).toEqual(['books'])
  })
})
