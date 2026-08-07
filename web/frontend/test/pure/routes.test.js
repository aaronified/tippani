// routes.js — the URL contract.
//
// Every link, bookmark and hard refresh in the app goes through these two
// functions, and the pair is deliberately NOT symmetric: /movies/42 parses but
// /catalogue/42 is what gets emitted, because the tab was renamed and old links
// still have to work. That asymmetry is exactly the kind of thing a later
// tidy-up removes as "dead code", so it is asserted in both directions.

import { describe, expect, it } from 'vitest'
import { addSection, helpScreen, parsePath, ROUTE_TABS, searchScope, statePath } from '../../src/routes.js'

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

  it('routes every plain tab by name', () => {
    for (const tab of ROUTE_TABS) {
      expect(parsePath(`/${tab}`)).toEqual({ tab, detail: null })
    }
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
    expect(parsePath('/books')).toEqual({ tab: 'home', detail: null }) // no id
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
  })

  it('pre-scopes search to the side you are on', () => {
    expect(searchScope('library', null)).toBe('books')
    expect(searchScope('movies', null)).toBe('movies')
    expect(searchScope('home', null)).toBe('all')
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
