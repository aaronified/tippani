import { describe, expect, it } from 'vitest'
import { CONTENT_TABS, DRAWER_TABS, SECTIONS, UTILITY_TABS, parsePath, sectionOrder, statePath, visibleSections, visibleTabs } from '../../src/routes.js'

// routes.js — the URL contract.
//
// Every link, bookmark and hard refresh in the app goes through these two
// functions, and the pair is deliberately NOT symmetric: /movies/42 parses but
// /catalogue/42 is what gets emitted, because the tab was renamed and old links
// still have to work. That asymmetry is exactly the kind of thing a later
// tidy-up removes as "dead code", so it is asserted in both directions.
describe('routes', () => {
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
})

// Settings → Features: the sections a reader can turn off.
//
// The promise is that hiding is COSMETIC — the doors go and the routing does not
// move — and only half of that is visible on screen. A reader can see the tab
// disappear; nobody can see that /library still resolves until the day it does
// not, and by then the bookmark they took a year ago is a blank page.
//
// routes.js already carries four hand-maintained lists of the same tab keys, and
// its own header says that shape "only stays correct if something checks it": 1.5.0
// added Quotes to the strip and the phone bar, missed the drawer, and the ☰ menu —
// the one surface whose job is to list everything — did not mention a tab that
// existed, routed and held data. A rule about WHICH rows are hidden is that shape
// again with a preference in front of it. So it is asserted as an invariant over
// all four lists at once rather than as four cases, and the failure names the list
// that kept the row.
describe('features nav', () => {
  const keys = (list) => list.filter(Boolean).map(([key]) => key)
  const off = (tab) => ({ ...visibleSections({}), [tab]: false })

  describe('visibleSections', () => {
    it('refuses to hide the last one', () => {
      // The server refuses this set with a 400 and corrects it again on read, so the
      // only way to arrive here is a blob that came through neither — a restored
      // archive, a hand-edited row, a newer build. The client must not be the layer
      // that trusts it: an app with no content sections has no list to stand in and
      // no + that offers anything, which is a broken screen rather than a preference.
      expect(visibleSections({ hideLibrary: true, hideCatalogue: true, hideQuotes: true })).toEqual({
        library: true,
        movies: false,
        quotes: false,
        anthologies: false,
      })
      // AND ANTHOLOGIES DOES NOT COUNT AS THE LAST ONE. It holds quotes that live in
      // the other three, so an app showing only anthologies still has no + that
      // offers anything and no list to stand in. The server's validator is three-way
      // for the same reason, and the two have to agree exactly: a client that allowed
      // this would move the switch, save, take a 400 nobody sees, and revert on the
      // next reload.
      expect(visibleSections({ hideLibrary: true, hideCatalogue: true, hideQuotes: true, showAnthologies: true })).toEqual({
        library: true,
        movies: false,
        quotes: false,
        anthologies: true,
      })
    })
  })

  describe('visibleTabs', () => {
    it('takes a hidden section out of ALL FOUR lists', () => {
      for (const sec of SECTIONS) {
        const sections = off(sec.tab)
        const lists = [
          ['CONTENT_TABS', CONTENT_TABS],
          ['UTILITY_TABS', UTILITY_TABS],
          ['DRAWER_TABS', DRAWER_TABS],
        ]
        for (const [name, list] of lists) {
          expect(keys(visibleTabs(list, sections)), `${sec.tab} is still in ${name}`).not.toContain(sec.tab)
        }
      }
    })
  })

  describe('hiding a section does not move the routing', () => {
    it('still parses and emits every hidden section own URL', () => {
      // THE PROMISE, and the half nobody can see. parsePath and statePath are
      // deliberately not feature-aware and must not become so: the moment they are,
      // a bookmark taken before the switch stops opening and the setting has stopped
      // being cosmetic.
      for (const sec of SECTIONS) {
        expect(parsePath(statePath(sec.tab, null)).tab, sec.tab).toBe(sec.tab)
      }
      expect(parsePath('/library')).toEqual({ tab: 'library', detail: null })
      expect(parsePath('/catalogue/7')).toEqual({ tab: 'movies', detail: { type: 'movie', id: 7 } })
      expect(parsePath('/quotes/all')).toEqual({ tab: 'quotes', detail: { type: 'board', id: 'all' } })
      // The fallbacks that land an unusable id on THAT side's list rather than on
      // Home. They are how somebody who mistypes a URL into a hidden section still
      // gets the section they asked for.
      expect(parsePath('/books/abc')).toEqual({ tab: 'library', detail: null })
      expect(parsePath('/quotes/nonsense')).toEqual({ tab: 'quotes', detail: null })
    })
  })
})

// THE ORDER THE SECTIONS COME IN, and the one rule nothing was testing.
//
// WHY THIS FILE EXISTS. A rater mutated `sectionOrder` to
// `return named.length ? named : declared` — dropping the append-the-unknown half
// of it — and the whole pure and dom suite passed, 313 files and 3,738 tests. The
// journey tier cannot reach it either: the Sections card always writes a COMPLETE
// order, so the only way to produce a partial one is to have stored it before a
// section existed, which is a state no test was constructing.
//
// WHAT THE MUTATION WOULD HAVE COST. A reader who reordered their sections in one
// release, and then upgraded to a release that added a fifth, would find that
// fifth section missing from the rail, the drawer, the dock and the ＋ menu — with
// nothing on screen saying why, and no way to get it back except reordering again.
//
// AND IT IS THE REASON THE SERVER DOES NOT VALIDATE THIS FIELD.
// `auth_handlers.go` declines to check the stored order against the tabs it knows,
// on the stated grounds that the client keeps what it recognises and appends the
// rest. That comment is only true while this function is.
describe('section order', () => {
  const DECLARED = SECTIONS.map((s) => s.tab)

  describe('a stored order that does not know every section', () => {
    // THE CASE THE MUTATION SURVIVED. A stored order naming three of four.
    it('appends the section it has never heard of rather than dropping it', () => {
      const stored = DECLARED.slice(0, -1).join(',')
      const got = sectionOrder({ sectionOrder: stored })
      expect(got).toHaveLength(DECLARED.length)
      expect(got).toContain(DECLARED[DECLARED.length - 1])
    })
  })
})
