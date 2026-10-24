// The `field:value` grammar — the client half of a feature whose server half
// deliberately does not know the syntax exists.
//
// These are the assertions that keep the two halves honest. The server takes
// `&tag=stoicism` and has never heard of a colon; if this file stops producing
// what search_facets.go accepts, nothing errors — the search just quietly means
// something other than what the chips say it means.

import { describe, expect, it } from 'vitest'
import { addChip, readFacetDraft, removeChipAt, searchQueryString, seedableChips, withFacet, withFacetValues } from '../../src/facets.js'

describe('escaping the colon', () => {
  // THE GRAMMAR HAS TO HAVE A WAY OUT OF ITSELF. Thirteen ordinary English words
  // became operators the moment this shipped — `note:`, `series:`, `year:` are
  // things a reader writes in a note, and "author: unknown" is a phrase somebody
  // could well be searching their own library for. Without an escape those are
  // unsearchable, and unsearchable SILENTLY: the box opens a dropdown and the
  // words never reach the query.
  it('takes a backslash before the colon as "these are just words"', () => {
    expect(readFacetDraft('note\\:')).toBe(null)
    expect(readFacetDraft('note\\: to self')).toBe(null)
    expect(readFacetDraft('author\\: unknown')).toBe(null)
  })
})

describe('chips', () => {
  it('refuses to add the same chip twice', () => {
    const one = [{ field: 'tag', value: 'stoicism', label: 'stoicism' }]
    expect(addChip(one, { field: 'tag', value: 'stoicism', label: 'stoicism' })).toBe(one)
    expect(addChip(one, { field: 'tag', value: 'death', label: 'death' })).toHaveLength(2)
  })
})

describe('removing a seeded chip widens the search', () => {
  // The promise the whole seeding idea rests on: narrowing is free because
  // widening is one click. Asserted end to end — a seeded board becomes chips,
  // becomes a query string, and dropping a chip visibly drops a parameter.
  const seeded = seedableChips(withFacetValues(withFacet([], 'genre', 'Fantasy'), 'shelf', ['reading']))

  // One test over all three rows rather than three: each was the same
  // `searchQueryString({ scope: 'books', chips })` compared with toBe over the
  // shared `seeded` above, differing only in which chips were left on. Kept in
  // order so the narrowing-to-widening sequence still reads top to bottom, and
  // compared as one collection so a failure names every step that went wrong.
  const STEPS = [
    { name: 'starts narrowed', chips: seeded, want: 'scope=books&genre=Fantasy&shelf=reading' },
    { name: 'widens by exactly the chip removed', chips: removeChipAt(seeded, 1), want: 'scope=books&genre=Fantasy' },
    { name: 'is back to the whole shelf once every chip is off', chips: [], want: 'scope=books' },
  ]

  it('narrows and widens one chip at a time', () => {
    const got = STEPS.map((s) => [s.name, searchQueryString({ scope: 'books', chips: s.chips })])
    expect(got).toEqual(STEPS.map((s) => [s.name, s.want]))
  })
})

describe('searchQueryString', () => {
  // One test over all five rows rather than five: every one was a single call
  // and a single string compare, differing only in the argument object and the
  // expected query string. Row names are the original it() titles, and the
  // collection is compared in one go so a failure names every wrong query
  // rather than only the first. `args: undefined` is the no-argument case —
  // the signature is `searchQueryString({ ... } = {})`, so it takes the same
  // default-parameter path a bare `searchQueryString()` does.
  const QUERIES = [
    {
      name: 'sends free text, scope and one parameter per chip',
      args: {
        q: 'revolution',
        scope: 'books',
        chips: [
          { field: 'tag', value: 'stoicism', label: 'stoicism' },
          { field: 'colour', value: 'blue', label: 'doubt' },
        ],
      },
      want: 'q=revolution&scope=books&tag=stoicism&colour=blue',
    },

    // Two chips of one field are two parameters of the same name — that is how a
    // multi-valued facet is expressed, and how the server tells intersection from
    // union.
    {
      name: 'repeats a name rather than joining values',
      args: {
        chips: [
          { field: 'tag', value: 'stoicism', label: 'stoicism' },
          { field: 'tag', value: 'death', label: 'death' },
        ],
      },
      want: 'scope=all&tag=stoicism&tag=death',
    },

    // The chips-only search: picking a value emptied the box, and that request
    // must still be well-formed. The server stopped requiring `q` for exactly this.
    {
      name: 'omits q entirely when the box is empty',
      args: { q: '   ', scope: 'quotes', chips: [{ field: 'tag', value: 'x', label: 'x' }] },
      want: 'scope=quotes&tag=x',
    },

    {
      name: 'escapes values rather than pasting them in',
      args: { chips: [{ field: 'author', value: 'Gaiman & Pratchett', label: 'x' }] },
      want: 'scope=all&author=Gaiman+%26+Pratchett',
    },

    { name: 'defaults to searching everything', args: undefined, want: 'scope=all' },
  ]

  it('builds the query the server takes', () => {
    const got = QUERIES.map((c) => [c.name, searchQueryString(c.args)])
    expect(got).toEqual(QUERIES.map((c) => [c.name, c.want]))
  })
})

// ---- the language facet ------------------------------------------------------
//
// THE FIELD THE LANGUAGE WORK WAS ABOUT, AND THE LAST ONE IT WAS MISSING. Every
// quote kind carries a language and /search/vocabulary has shipped the distinct
// list since Settings needed a table of them — nothing consumed it for search, so
// a reader with a Bengali shelf and a Sanskrit one could narrow by fourteen other
// things and not by that.
//
// THE SERVER HALF IS TESTED IN GO, where the SQL is: whole-value matching, a case
// fold, and the three row kinds it reaches. What is checkable here is the half
// this file is for — that the field is in the grammar, that its options come off
// the vocabulary rather than a second list, and that a chip round-trips.
