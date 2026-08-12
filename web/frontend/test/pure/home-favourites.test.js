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

describe('a standalone quote has no work behind it, but it has somewhere to go', () => {
  it('carries no workId, because there is no parent record', () => {
    // The half of the old rule that still holds. Every other kind contributes a
    // work to open; this one IS the whole record, so there is nothing to fetch.
    const adapter = src.slice(src.indexOf('function quoteFav'), src.indexOf('const FAV_KINDS'))
    expect(adapter).not.toContain('workId')
  })

  it('does get an open label, pointing at its own screen', () => {
    // Reversed in 1.7.10. "Nothing to open" was true of a parent record and false
    // of a destination: a standalone quote lives on the Quotes screen, and that is
    // somewhere worth going from a tile on Home. The other two kinds keep opening
    // their work.
    const adapter = src.slice(src.indexOf('function quoteFav'), src.indexOf('const FAV_KINDS'))
    expect(adapter).toContain('openLabel')
    expect(src).toContain('{f.openLabel && (')
  })

  it('names a nav glyph for each kind, so the tile draws the tab strip’s own picture', () => {
    // The open control is a glyph now, and the glyph is whichever one the nav uses
    // for that screen — two drawings of the Library is exactly the drift the icon
    // set exists to prevent.
    const table = src.slice(src.indexOf('const FAV_KINDS'), src.indexOf('export default function Home'))
    expect(table).toContain("openIcon: 'library'")
    expect(table).toContain("openIcon: 'movies'")
    expect(table).toContain("openIcon: 'quotes'")
  })
})
