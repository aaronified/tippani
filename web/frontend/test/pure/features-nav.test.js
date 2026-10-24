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

import { describe, expect, it } from 'vitest'
import {
  CONTENT_TABS,
  DRAWER_TABS,
  parsePath,
  SECTIONS,
  statePath,
  UTILITY_TABS,
  visibleSections,
  visibleTabs,
} from '../../src/routes.js'

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

