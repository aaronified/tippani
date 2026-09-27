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
// that a name survives being written back through the one writer — that is where
// a name would be lost, and it would be lost silently and for good; and that a
// link with no name is unchanged in every particular, because that is every link
// in every library today.
//
// THE OTHER REWRITE MOVED TO THE SERVER IN 3.1.0. A metadata fetch folds the
// links it found into the stored field, and that fold was `mergeLinks` here until
// the People fetch became one request (`POST /people/id/{id}/fetch`) and a job
// that loops the same Go function. Its two cases — a fetch leaves the reader's
// names alone, and an unnamed link stays unnamed — belong beside that Go fold, in
// `TestMergeLinksKeepsTheReadersNames` (internal/httpapi/merge_links_test.go).
// THAT TEST IS NOT WRITTEN YET: the fold is the backend's to port, and the Go fold
// already in the tree, `mergePersonLinks`, splits on whitespace and would shred
// every name. rules/link-fold-keeps-names.test.js goes red the day the server
// serves the fold without the test, so the two cases cannot be lost in transit.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that `parseLinks`
// answers `{ known, extra, labels }` — providers by slug, the rest in order, and
// the names by URL.

import { describe, expect, it } from 'vitest'

import { linkLine, parseLinks } from '../../src/people.jsx'

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

describe('a line that holds more than one address', () => {
  // THE FIELD HAS ALWAYS WHITESPACE-SPLIT, which is the whole reason the
  // separator is a pipe: `a.com b.com` on one line is two links and naming
  // something on that line may not change that. It did — the head was read as a
  // single address, `new URL` refused it, and both links were replaced by one
  // dead token with no name on it. Two working links lost to typing a name.
  it('is still every address on it, even when a name follows', () => {
    const { known, extra, labels } = parseLinks(`${MINE} ${OTHER} | Their talks`)
    const all = [...Object.values(known), ...extra]
    expect(all, 'an address on the line was lost or mangled').toContain(MINE)
    expect(all, 'an address on the line was lost or mangled').toContain(OTHER)
    expect(all.some((x) => x.includes(' ')), 'two addresses were joined into one token')
      .toBe(false)
    expect(labels[OTHER], 'the name did not reach the address it was written against')
      .toBe('Their talks')
    expect(labels[MINE], 'one name was spread onto a link it was not written against')
      .toBeUndefined()
  })

  it('and reads the same when no name follows, exactly as it always did', () => {
    const { extra, labels } = parseLinks(`${MINE} ${OTHER}`)
    expect(extra).toEqual([MINE, OTHER])
    expect(labels).toEqual({})
  })
})
