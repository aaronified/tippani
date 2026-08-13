// routes.js — the URL contract.
//
// Every link, bookmark and hard refresh in the app goes through these two
// functions, and the pair is deliberately NOT symmetric: /movies/42 parses but
// /catalogue/42 is what gets emitted, because the tab was renamed and old links
// still have to work. That asymmetry is exactly the kind of thing a later
// tidy-up removes as "dead code", so it is asserted in both directions.

import { describe, expect, it } from 'vitest'
import {
  addSection,
  BOTTOM_TABS,
  CONTENT_TABS,
  DRAWER_TABS,
  helpScreen,
  parsePath,
  ROUTE_TABS,
  searchScope,
  statePath,
  UTILITY_TABS,
} from '../../src/routes.js'

describe('parsePath', () => {
  it('reads the root as Home', () => {
    expect(parsePath('/')).toEqual({ tab: 'home', detail: null })
    expect(parsePath('')).toEqual({ tab: 'home', detail: null })
  })

  it('reads the list pages', () => {
    expect(parsePath('/library')).toEqual({ tab: 'library', detail: null })
    expect(parsePath('/catalogue')).toEqual({ tab: 'movies', detail: null })
  })

  it('reads a work detail into a typed id', () => {
    expect(parsePath('/books/42')).toEqual({ tab: 'library', detail: { type: 'book', id: 42 } })
    expect(parsePath('/catalogue/7')).toEqual({ tab: 'movies', detail: { type: 'movie', id: 7 } })
  })

  it('coerces the id to a number, not a string', () => {
    expect(parsePath('/books/42').detail.id).toBe(42)
  })

  // Asserted as a literal, not by looping over ROUTE_TABS imported from the
  // source. The loop version was tautological: deleting an entry from the table
  // just made it run one fewer iteration, so '/staging' could stop routing and
  // nothing would fail. This is the only test protecting that table, so it has
  // to state the expected contents rather than read them.
  it('has exactly these plain tabs', () => {
    expect(ROUTE_TABS).toEqual(['search', 'quotes', 'tags', 'metadata', 'stats', 'settings', 'staging', 'bin'])
  })

  it('routes every plain tab by name', () => {
    expect(parsePath('/search')).toEqual({ tab: 'search', detail: null })
    expect(parsePath('/quotes')).toEqual({ tab: 'quotes', detail: null })
    expect(parsePath('/tags')).toEqual({ tab: 'tags', detail: null })
    expect(parsePath('/metadata')).toEqual({ tab: 'metadata', detail: null })
    expect(parsePath('/stats')).toEqual({ tab: 'stats', detail: null })
    expect(parsePath('/settings')).toEqual({ tab: 'settings', detail: null })
    expect(parsePath('/staging')).toEqual({ tab: 'staging', detail: null })
    expect(parsePath('/bin')).toEqual({ tab: 'bin', detail: null })
  })

  // /quotes is a LIST, not a work prefix: there is no /quotes/:id to open,
  // because a standalone quote has no detail page of its own. An id segment is
  // simply ignored rather than routed to a screen that does not exist.
  it('routes /quotes to its list whatever follows it', () => {
    expect(parsePath('/quotes')).toEqual({ tab: 'quotes', detail: null })
    expect(parsePath('/quotes/')).toEqual({ tab: 'quotes', detail: null })
    expect(parsePath('/quotes/7')).toEqual({ tab: 'quotes', detail: null })
  })

  it('emits /quotes for the quotes tab', () => {
    expect(statePath('quotes', null)).toBe('/quotes')
  })

  it('maps /pending onto the staging tab', () => {
    expect(parsePath('/pending')).toEqual({ tab: 'staging', detail: null })
  })

  it('keeps /import as its own signal for the Add surface', () => {
    // Not a tab any more — the Shell turns this into Home with the Add surface
    // open on its import section, so parsePath has to hand it through distinctly
    // rather than collapsing it to home here.
    expect(parsePath('/import')).toEqual({ tab: 'import', detail: null })
  })

  it('lands an unknown path on Home rather than a blank screen', () => {
    expect(parsePath('/nonsense')).toEqual({ tab: 'home', detail: null })
    expect(parsePath('/deep/unknown/path')).toEqual({ tab: 'home', detail: null })
  })

  // /books is the detail prefix, not a list path — the book list is /library.
  // It used to fall through to Home; sending it to the list it obviously meant
  // is the same fix as the mistyped-id case below.
  it('sends the bare detail prefix to that side of the library', () => {
    expect(parsePath('/books')).toEqual({ tab: 'library', detail: null })
  })

  // A non-numeric id used to satisfy the truthiness guard and produce
  // { id: NaN }, which fetches /books/NaN and renders an error screen — the
  // very outcome the unknown-path fallback exists to prevent. It now falls back
  // to the list for that side of the library, which is a better answer than
  // Home: the path still says which half you meant.
  it('lands a mistyped work id on that side of the library', () => {
    for (const bad of ['abc', '0', '-1', '1.5', '%20']) {
      expect(parsePath(`/books/${bad}`), bad).toEqual({ tab: 'library', detail: null })
      expect(parsePath(`/catalogue/${bad}`), bad).toEqual({ tab: 'movies', detail: null })
      expect(parsePath(`/movies/${bad}`), bad).toEqual({ tab: 'movies', detail: null })
    }
  })

  it('never produces a NaN id', () => {
    for (const p of ['/books/abc', '/catalogue/abc', '/movies/x', '/books/1.5']) {
      expect(Number.isNaN(parsePath(p).detail?.id)).toBe(false)
    }
  })

  it('ignores trailing slashes', () => {
    expect(parsePath('/library/')).toEqual({ tab: 'library', detail: null })
    expect(parsePath('/books/42/')).toEqual({ tab: 'library', detail: { type: 'book', id: 42 } })
    expect(parsePath('///')).toEqual({ tab: 'home', detail: null })
  })

  // The catalogue tab used to be called "movies". Both spellings still parse.
  it('accepts the legacy /movies spelling', () => {
    expect(parsePath('/movies')).toEqual({ tab: 'movies', detail: null })
    expect(parsePath('/movies/7')).toEqual({ tab: 'movies', detail: { type: 'movie', id: 7 } })
  })
})

describe('statePath', () => {
  it('emits the canonical path for each tab', () => {
    expect(statePath('home', null)).toBe('/')
    expect(statePath('library', null)).toBe('/library')
    expect(statePath('movies', null)).toBe('/catalogue')
    expect(statePath('staging', null)).toBe('/pending')
    expect(statePath('search', null)).toBe('/search')
  })

  it('emits a work detail path', () => {
    expect(statePath('library', { type: 'book', id: 42 })).toBe('/books/42')
    expect(statePath('movies', { type: 'movie', id: 7 })).toBe('/catalogue/7')
  })

  it('lets the detail win over the tab', () => {
    // The Shell can hold a stale tab while a detail is open; the detail is the
    // more specific fact and decides the URL.
    expect(statePath('home', { type: 'book', id: 1 })).toBe('/books/1')
  })

  // The rename is one-way on purpose: /movies is understood, never produced.
  it('never emits the legacy /movies spelling', () => {
    expect(statePath('movies', null)).not.toContain('/movies')
    expect(statePath('movies', { type: 'movie', id: 7 })).not.toContain('/movies')
  })
})

describe('the round trip', () => {
  // What statePath emits, parsePath must read back identically — otherwise a
  // pushState immediately followed by a popstate lands somewhere else.
  const states = [
    ['home', null],
    ['library', null],
    ['movies', null],
    ['staging', null],
    ['search', null],
    ['tags', null],
    ['metadata', null],
    ['stats', null],
    ['settings', null],
    ['bin', null],
    ['library', { type: 'book', id: 42 }],
    ['movies', { type: 'movie', id: 7 }],
  ]

  for (const [tab, detail] of states) {
    it(`survives ${tab}${detail ? ` #${detail.id}` : ''}`, () => {
      expect(parsePath(statePath(tab, detail))).toEqual({ tab, detail })
    })
  }

  // The legacy alias is the one input that deliberately does not round-trip
  // back to itself — it normalises to the canonical spelling instead.
  it('normalises a legacy link rather than preserving it', () => {
    const parsed = parsePath('/movies/7')
    expect(statePath(parsed.tab, parsed.detail)).toBe('/catalogue/7')
  })
})

describe('the shell controls', () => {
  it('opens help for the screen you are actually looking at', () => {
    expect(helpScreen('library', null)).toBe('library')
    expect(helpScreen('library', { type: 'book', id: 1 })).toBe('book-detail')
    expect(helpScreen('movies', { type: 'movie', id: 1 })).toBe('movie-detail')
  })

  // On a work's own page, "add" means a quote against it — not another book.
  it('offers a quote when a work is open, and the list kind otherwise', () => {
    expect(addSection('library', { type: 'book', id: 1 })).toBe('quote')
    expect(addSection('movies', { type: 'movie', id: 1 })).toBe('quote')
    expect(addSection('library', null)).toBe('book')
    expect(addSection('movies', null)).toBe('film')
    expect(addSection('home', null)).toBe('book')
    // The Quotes list holds quotes belonging to nothing, so its ＋ offers one
    // of those rather than a book.
    expect(addSection('quotes', null)).toBe('standalone')
  })

  it('pre-scopes search to the side you are on', () => {
    expect(searchScope('library', null)).toBe('books')
    expect(searchScope('movies', null)).toBe('movies')
    expect(searchScope('home', null)).toBe('all')
    expect(searchScope('quotes', null)).toBe('quotes')
    expect(searchScope('home', { type: 'book', id: 1 })).toBe('books')
    expect(searchScope('home', { type: 'movie', id: 1 })).toBe('movies')
  })

  // All three read the same (tab, detail) and must not disagree about which
  // side of the library you are on.
  it('agree with each other on a work detail', () => {
    const detail = { type: 'movie', id: 3 }
    expect(helpScreen('movies', detail)).toBe('movie-detail')
    expect(addSection('movies', detail)).toBe('quote')
    expect(searchScope('movies', detail)).toBe('movies')
  })
})

// ---- the nav contract ----
//
// Four hand-maintained lists name the same tabs, and until 1.6.0 nothing
// checked that they agreed. 1.5.0 added Quotes to the desktop strip and the
// phone's bottom bar and missed the drawer, so on a phone the tab existed,
// routed, held data and sat in the bottom bar while the ☰ menu — the one
// surface whose job is to list everything — did not mention it.
//
// Nothing about that fails loudly. It is not a crash, it is not a warning, and
// it is invisible on a desktop, which is where the screen was built. These
// assertions are the only thing standing between a fifth list and the same bug.

const keys = (list) => list.filter(Boolean).map(([key]) => key)

describe('the nav contract', () => {
  it('offers every content tab in the drawer', () => {
    for (const key of keys(CONTENT_TABS)) {
      expect(keys(DRAWER_TABS)).toContain(key)
    }
  })

  it('offers every content tab in the phone bottom bar', () => {
    expect(keys(BOTTOM_TABS)).toEqual(keys(CONTENT_TABS))
  })

  it('offers every utility tab in the drawer', () => {
    for (const key of keys(UTILITY_TABS)) {
      expect(keys(DRAWER_TABS)).toContain(key)
    }
  })

  it('names no tab twice within a list', () => {
    for (const list of [CONTENT_TABS, UTILITY_TABS, DRAWER_TABS, BOTTOM_TABS]) {
      const k = keys(list)
      expect(new Set(k).size).toBe(k.length)
    }
  })

  it('keeps content and utility disjoint', () => {
    // The desktop strip renders them as two Toggles either side of a divider,
    // and a key in both would light up as active in both.
    const util = new Set(keys(UTILITY_TABS))
    for (const key of keys(CONTENT_TABS)) expect(util.has(key)).toBe(false)
  })

  // The asymmetry the bin depends on, asserted in the direction that could
  // silently stop being true: `bin` is a route with no nav entry anywhere, so a
  // later tidy-up that "completes" the tab lists by adding every route to them
  // would put a permanent invitation to browse your deletions in the strip.
  it('keeps the bin out of every nav list while keeping its URL', () => {
    const all = new Set([...keys(CONTENT_TABS), ...keys(UTILITY_TABS), ...keys(DRAWER_TABS), ...keys(BOTTOM_TABS)])
    expect(ROUTE_TABS).toContain('bin')
    expect(all.has('bin')).toBe(false)
    expect(parsePath(statePath('bin', null))).toEqual({ tab: 'bin', detail: null })
  })

  it('gives every nav tab a URL that survives a hard refresh', () => {
    // A tab you can reach but cannot bookmark is half a screen. Search is in
    // the drawer and is a real route; home/library/movies have bespoke slugs.
    const all = new Set([...keys(CONTENT_TABS), ...keys(UTILITY_TABS), ...keys(DRAWER_TABS), ...keys(BOTTOM_TABS)])
    for (const tab of all) {
      expect(parsePath(statePath(tab, null)).tab).toBe(tab)
    }
  })

  it('gives every strip and bar row a hover label, and no drawer row one', () => {
    // The strip and the bar collapse to icon-only, so a row without a third
    // element becomes an unnamed glyph. Drawer rows always show their words.
    for (const row of [...CONTENT_TABS, ...UTILITY_TABS, ...BOTTOM_TABS]) {
      expect(typeof row[2]).toBe('string')
      expect(row[2].trim()).not.toBe('')
      expect(row[2].split(/\s+/).length).toBeLessThanOrEqual(5) // the five-word rule
    }
    for (const row of DRAWER_TABS.filter(Boolean)) expect(row).toHaveLength(2)
  })
})
