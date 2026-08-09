// Home's favourites list, and the shape of the bug it shipped with.
//
// It fetched two lists and merged two lists, and had done since before
// standalone quotes existed. Nothing failed: hearting a standalone quote worked,
// the heart stayed on, the Quotes screen filtered by it — and the quote never
// appeared on Home. That is a bug you can only find by owning one and going to
// look for it, which is the worst kind to leave to a render test, because a
// render test asserts what a component does with the data it was given and this
// component was never given the data.
//
// So the assertion is about the SOURCES: whatever the tile ends up looking like,
// the loader has to ask for all three kinds and the kind table has to know what
// to do with each. Both are read out of Home.jsx directly.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = readFileSync(new URL('../../src/Home.jsx', import.meta.url), 'utf8')

// The body of loadFavs, which is where a missing kind hides.
const loadFavs = (() => {
  const start = src.indexOf('function loadFavs()')
  expect(start, 'loadFavs has been renamed').toBeGreaterThan(-1)
  return src.slice(start, src.indexOf('useEffect(() => {', start))
})()

describe('the favourites loader', () => {
  it.each([
    ['book highlights', '/annotations?favorite=1'],
    ['film dialogue', '/dialogues?favorite=1'],
    ['standalone quotes', '/quotes?favorite=1'],
  ])('asks for %s', (_kind, path) => {
    expect(loadFavs).toContain(path)
  })

  it('merges every list it asked for', () => {
    // A fetch with no corresponding push is the same bug wearing a different
    // hat: the request goes out, the response is discarded, and the section is
    // short by exactly one kind.
    for (const adapter of ['bookFav(', 'screenFav(', 'quoteFav(']) {
      expect(loadFavs, `${adapter} is fetched but never merged`).toContain(adapter)
    }
  })

  it('reads the quotes response by its table name, not its route', () => {
    // /quotes answers with `utterances` — the table, not the path. Reading
    // `.quotes` returns undefined, `|| []` swallows it, and the section is
    // silently short again.
    expect(loadFavs).toMatch(/rq\.data\.utterances/)
  })
})

describe('the kind table', () => {
  const table = src.slice(src.indexOf('const FAV_KINDS'), src.indexOf('export default function Home'))

  it.each(['book', 'screen', 'quote'])('has an entry for %s', (kind) => {
    expect(table).toMatch(new RegExp(`^\\s{2}${kind}: \\{`, 'm'))
  })

  it('gives every kind the fields the tile reads', () => {
    // The tile looks each of these up with no fallback, so a kind added to the
    // table without one of them throws at render rather than degrading — which
    // is the intended failure, and worth pinning so nobody adds a `|| ''`.
    for (const field of ['label', 'labelColor', 'path', 'state', 'form', 'editTitle',
      'confirm', 'personKind', 'credit', 'shareKind', 'quoted']) {
      const count = table.split(new RegExp(`\\b${field}:`)).length - 1
      expect(count, `${field} is on ${count} of the 3 kinds`).toBe(3)
    }
  })

  it('routes each kind at its own endpoint', () => {
    expect(table).toContain("path: '/annotations'")
    expect(table).toContain("path: '/dialogues'")
    expect(table).toContain("path: '/quotes'")
  })

  it('credits the right person for each kind', () => {
    expect(table).toContain("personKind: 'author'")
    expect(table).toContain("personKind: 'actor'")
    expect(table).toContain("personKind: 'speaker'")
  })
})

describe('a standalone quote has nothing to open', () => {
  it('gets no openLabel, and the button is conditional on one', () => {
    // Every other kind contributes a work to jump to. This one IS the whole
    // record, so the button must be absent rather than present and inert.
    const adapter = src.slice(src.indexOf('function quoteFav'), src.indexOf('const FAV_KINDS'))
    expect(adapter).not.toContain('openLabel')
    expect(adapter).not.toContain('workId')
    expect(src).toContain('{f.openLabel && (')
  })
})
