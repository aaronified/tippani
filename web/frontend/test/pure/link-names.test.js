// A LINK MAY CARRY A NAME, AND NAMING ONE MAY NOT COST ANOTHER.
//
// THE OWNER'S CHOICE, from the shapes they were offered for the ＋ on a record's
// Links: "'Add a link' takes a URL with an optional label."
//
// THE CONSTRAINT THAT DECIDES THE DESIGN. A record's links are ONE free-text
// field of newline-separated addresses, and the SAME field on a work, a person
// and a character. So a name per link either becomes a second thing stored beside
// each URL — a new column, a parallel list, a migration for everything already
// there, and a third meaning for a field two other screens read — or it goes in
// the field, in a way that reads every line already there exactly as it always
// did.
//
// WHY A PIPE AND NOT A SPACE. A space already means something here: this field
// has always whitespace-split, so `a.com b.com` on one line is TWO links and
// always was. Reading the second half as a name would quietly rename somebody's
// link. `|` has never been legal in an address and has never been written into
// this field, so a line carrying one is unambiguously new.
//
// WHAT THIS ASKS. That every stored field still reads the way it read before;
// that a name survives the two functions which REWRITE the whole field (a
// metadata fetch, and adding a link) — that is where a name would be lost, and it
// would be lost silently and for good; and that a link with no name is unchanged
// in every particular, because that is every link in every library today.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that `parseLinks`
// answers `{ known, extra, labels }` — providers by slug, the rest in order, and
// the names by URL.

import { describe, expect, it } from 'vitest'

import { linkLine, mergeLinks, parseLinks } from '../../src/people.jsx'

const IMDB = 'https://www.imdb.com/name/nm0000123/'
const MINE = 'https://example.org/essays'
const OTHER = 'https://example.net/talks'

describe('a field written before names existed', () => {
  it('reads exactly as it did — one link a line', () => {
    const { known, extra, labels } = parseLinks(`${IMDB}\n${MINE}`)
    expect(known.imdb).toBe(IMDB)
    expect(extra).toEqual([MINE])
    expect(labels, 'a field with no names in it produced one').toEqual({})
  })

  it('and two addresses on one line are still two links, not a link and a name', () => {
    // THE CASE THAT RULES OUT A SPACE as the separator. Whitespace has always
    // separated links here, so a rule that read the tail of a line as a name
    // would rename this reader's second link after their first.
    const { extra } = parseLinks(`${MINE} ${OTHER}`)
    expect(extra).toEqual([MINE, OTHER])
  })

  it('and something that is not an address is kept rather than dropped', () => {
    const { extra, labels } = parseLinks('not-a-url')
    expect(extra).toEqual(['not-a-url'])
    expect(labels, 'a name was attached to something that is not a link').toEqual({})
  })
})

describe('a link with a name', () => {
  it('keeps the address as the address and the name as the name', () => {
    const { extra, labels } = parseLinks(`${MINE} | Their essays`)
    expect(extra, 'the name was read as part of the address').toEqual([MINE])
    expect(labels[MINE]).toBe('Their essays')
  })

  it('and a recognised provider can be named too', () => {
    const { known, labels } = parseLinks(`${IMDB} | The other one`)
    expect(known.imdb).toBe(IMDB)
    expect(labels[IMDB]).toBe('The other one')
  })

  it('and a name may contain the separator it was introduced by', () => {
    // Split on the FIRST pipe, not on every one: a name is free text and the
    // reader has no reason to know what the file uses to hold it.
    expect(parseLinks(`${MINE} | a | b`).labels[MINE]).toBe('a | b')
  })

  it('and a name of nothing at all is no name, not an empty one', () => {
    expect(parseLinks(`${MINE} |   `).labels, 'an empty name was stored as a name').toEqual({})
  })
})

describe('writing one back', () => {
  it('round-trips through the one writer', () => {
    expect(parseLinks(linkLine(MINE, 'Their essays')).labels[MINE]).toBe('Their essays')
  })

  it('and writes a bare address where there is no name to add', () => {
    expect(linkLine(MINE, '')).toBe(MINE)
    expect(linkLine(MINE, '   ')).toBe(MINE)
  })
})

describe('a fetch that rewrites the whole field', () => {
  it('leaves the names the reader gave alone', () => {
    // THE LOSS THIS RULES OUT. mergeLinks rebuilds the field from its parts, so a
    // fetch that did not touch a link would still erase its name — silently, and
    // for good. It is the same class of loss as the "existing URLs win" rule one
    // column over.
    const stored = `${IMDB} | The other one\n${MINE} | Their essays`
    const after = parseLinks(mergeLinks(stored, { tmdb: 'https://www.themoviedb.org/person/1' }))
    expect(after.labels[IMDB]).toBe('The other one')
    expect(after.labels[MINE]).toBe('Their essays')
    expect(after.known.tmdb, 'the fetched link did not land').toBeTruthy()
  })

  it('and a link nobody has named stays unnamed rather than gaining an empty one', () => {
    expect(mergeLinks(`${MINE}`, {})).toBe(MINE)
  })
})
