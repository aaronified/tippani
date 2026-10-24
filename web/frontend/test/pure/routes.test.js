// routes.js — the URL contract.
//
// Every link, bookmark and hard refresh in the app goes through these two
// functions, and the pair is deliberately NOT symmetric: /movies/42 parses but
// /catalogue/42 is what gets emitted, because the tab was renamed and old links
// still have to work. That asymmetry is exactly the kind of thing a later
// tidy-up removes as "dead code", so it is asserted in both directions.

import { describe, expect, it } from 'vitest'
import {
  CONTENT_TABS,
  DRAWER_TABS,
  parsePath,
  statePath,
  UTILITY_TABS,
} from '../../src/routes.js'

describe('parsePath', () => {
  it('lands an unknown path on Home rather than a blank screen', () => {
    expect(parsePath('/nonsense')).toEqual({ tab: 'home', detail: null })
    expect(parsePath('/deep/unknown/path')).toEqual({ tab: 'home', detail: null })
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
    ['anthologies', null],
    ['library', { type: 'book', id: 42 }],
    ['movies', { type: 'movie', id: 7 }],
    ['anthologies', { type: 'anthology', id: 5 }],
    ['metadata', { type: 'reverify', id: 12 }],
  ]

  // One test over every state rather than one one-line it per state: the body
  // was identical per row and only the state varied. Each row is still named
  // the way its it() was, and comparing the whole collected list at once names
  // EVERY state that failed to survive instead of stopping at the first.
  const name = ([tab, detail]) => `survives ${tab}${detail ? ` #${detail.id}` : ''}`

  it('reads back everything statePath emits', () => {
    const got = states.map((state) => [name(state), parsePath(statePath(...state))])
    const want = states.map(([tab, detail]) => [name([tab, detail]), { tab, detail }])
    expect(got).toEqual(want)
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
  // THE DRAWER IS THE PHONE'S ONLY NAV NOW, which is what makes this the
  // strictest row in the contract rather than a restatement of the two above it.
  // The four-tab bottom bar was retired when that bar became a dock of verbs, so
  // a destination missing from DRAWER_TABS is not merely inconvenient on a phone
  // — it is unreachable there while remaining a row on the desk.
  it('offers every rail destination in the drawer, because a phone has no other', () => {
    const rail = [...keys(CONTENT_TABS), ...keys(UTILITY_TABS)]
    for (const key of rail) expect(keys(DRAWER_TABS), key).toContain(key)
  })

  it('gives every nav tab a URL that survives a hard refresh', () => {
    // A tab you can reach but cannot bookmark is half a screen. home/library/
    // movies have bespoke slugs. Search is no longer a drawer row — it is a dock
    // key — so ROUTE_TABS is what keeps it bookmarkable, asserted just below.
    const all = new Set([...keys(CONTENT_TABS), ...keys(UTILITY_TABS), ...keys(DRAWER_TABS)])
    for (const tab of all) {
      expect(parsePath(statePath(tab, null)).tab).toBe(tab)
    }
  })
})
