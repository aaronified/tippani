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

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  addSection,
  CONTENT_TABS,
  DRAWER_TABS,
  helpScreen,
  parsePath,
  searchScope,
  SECTIONS,
  statePath,
  UTILITY_TABS,
  visibleSections,
  visibleTabs,
} from '../../src/routes.js'

const keys = (list) => list.filter(Boolean).map(([key]) => key)
const off = (tab) => ({ ...visibleSections({}), [tab]: false })

describe('visibleSections', () => {
  it('shows every content section to a reader who has set nothing', () => {
    // Three callers depend on this, and one of them is published: a fresh account,
    // any build older than the feature, and the demo fixture. It is the whole
    // reason the three stored flags are spelled hide* rather than show* — and the
    // reason the fourth is spelled the other way round, since its default is the
    // other answer. Either way, ABSENT MEANS THE DEFAULT.
    for (const prefs of [undefined, null, {}, { accent: 'ochre' }]) {
      expect(visibleSections(prefs), JSON.stringify(prefs)).toEqual({
        library: true,
        movies: true,
        quotes: true,
        anthologies: false,
      })
    }
  })

  // THE SWITCH THAT READS THE OTHER WAY ROUND. Anthologies is off until somebody
  // asks for it: most libraries will never hold one, and a fourth permanent tab
  // for a screen nobody has opened is what the Features card exists to prevent.
  //
  // A hide* key cannot express that — absent means `!undefined`, which is true —
  // so this is the assertion that pins the polarity. Without the `off` flag and
  // the branch it drives, the tab is on for everybody the moment the row exists,
  // and nothing else in the suite would say so.
  it('keeps anthologies off until it is asked for, and on when it is', () => {
    expect(visibleSections({}).anthologies).toBe(false)
    expect(visibleSections({ showAnthologies: false }).anthologies).toBe(false)
    expect(visibleSections({ showAnthologies: true })).toEqual({
      library: true,
      movies: true,
      quotes: true,
      anthologies: true,
    })
    // And the wire value is a boolean, not a truthy string: a `hideAnthologies`
    // key is a key this build knows nothing about and must not answer to.
    expect(visibleSections({ hideAnthologies: true }).anthologies).toBe(false)
  })

  it('hides the one that was turned off, and only that one', () => {
    expect(visibleSections({ hideCatalogue: true })).toEqual({
      library: true,
      movies: false,
      quotes: true,
      anthologies: false,
    })
    expect(visibleSections({ hideLibrary: true, hideQuotes: true })).toEqual({
      library: false,
      movies: true,
      quotes: false,
      anthologies: false,
    })
    // Turning anthologies on disturbs nothing else, which is the same claim in the
    // other direction.
    expect(visibleSections({ hideCatalogue: true, showAnthologies: true })).toEqual({
      library: true,
      movies: false,
      quotes: true,
      anthologies: true,
    })
  })

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

  it('names a section every nav list can actually hold', () => {
    // The registry and the tab tables are two hand-maintained lists again. A
    // section whose `tab` matched no row would be a switch that visibly does
    // nothing, and nothing else would fail.
    for (const sec of SECTIONS) {
      expect(keys(CONTENT_TABS), sec.tab).toContain(sec.tab)
      expect(keys(DRAWER_TABS), sec.tab).toContain(sec.tab)
    }
  })

  it('gives every section a stored key, a label and a line of prose', () => {
    // The card renders all three per row. A missing `what` is an empty paragraph
    // under a switch, which reads as a layout bug rather than as missing copy.
    for (const sec of SECTIONS) {
      // THE KEY'S SPELLING IS ITS POLARITY, and the two must agree or the stored
      // flag means the opposite of what the switch writes. `hide*` for a section
      // that is on by default, `show*` for one that is off — either way `false` is
      // the default, which is the invariant the prefs struct is protecting.
      expect(sec.pref, sec.tab).toMatch(sec.off ? /^show[A-Z]/ : /^hide[A-Z]/)
      expect(sec.label.trim(), sec.tab).not.toBe('')
      expect(sec.label.trim().split(/\s+/).length, sec.tab).toBeLessThanOrEqual(5)
      expect(sec.what.trim().length, sec.tab).toBeGreaterThan(10)
    }
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

  it('keeps the rail and the drawer offering the same places, filtered as well as whole', () => {
    // The strictest assertion in the nav contract, restated under a filter, and
    // re-pointed when the phone's four-tab bar became a verb dock. The drawer is
    // now the ONLY list of destinations a phone has, so what it offers and what
    // the rail offers must stay one decision — a section switched off has to
    // vanish from both or the phone keeps a door the desk has closed.
    for (const sec of SECTIONS) {
      const sections = off(sec.tab)
      const rail = [...keys(visibleTabs(CONTENT_TABS, sections)), ...keys(visibleTabs(UTILITY_TABS, sections))]
      expect(keys(visibleTabs(DRAWER_TABS, sections)).sort()).toEqual(rail.sort())
    }
  })

  it('leaves every row it keeps exactly as it was', () => {
    // Rows are 3-tuples in the strip and the bar and 2-tuples in the drawer, and
    // the nav contract asserts both arities. A filter that rebuilt rows rather than
    // passing them through could quietly change one, and the symptom would be a
    // nav tab with no hover label — invisible until somebody hovers it.
    const sections = off('movies')
    for (const list of [CONTENT_TABS, UTILITY_TABS, DRAWER_TABS]) {
      for (const row of visibleTabs(list, sections)) {
        if (row === null) continue
        expect(list).toContain(row)
      }
    }
  })

  it('passes through everything the answer says nothing about', () => {
    // Home and the four tools are not hideable, and the way that is expressed is
    // that the sections object has no key for them at all — not a `true`. A
    // filter keyed on truthiness would drop every one of them. Search left this
    // list when it became a dock key rather than a drawer row; it is still not
    // hideable, and ROUTE_TABS is where that is now asserted.
    const kept = keys(visibleTabs(DRAWER_TABS, off('quotes')))
    for (const tab of ['home', 'tags', 'metadata', 'stats', 'settings']) {
      expect(kept, tab).toContain(tab)
    }
  })

  it('keeps the drawer divider between two groups and nowhere else', () => {
    // `null` is positional: it separates the primary screens from the utility
    // group. Filtering rows either side of it must not leave it leading, trailing
    // or doubled — and three other tests read this list through
    // DRAWER_TABS.filter(Boolean), so a divider bug is invisible to every one of
    // them and shows up only as a rule floating at the top of somebody's menu.
    //
    // The FIRST case is now already a filtered drawer: anthologies is off by
    // default, so the row sitting immediately above the rule is dropped for every
    // reader who has not asked for it — which is exactly the placement that could
    // leave a rule floating.
    const cases = [
      visibleSections({}),
      visibleSections({ showAnthologies: true }),
      off('library'),
      off('movies'),
      off('quotes'),
      visibleSections({ hideLibrary: true, hideQuotes: true }),
      visibleSections({ hideCatalogue: true, hideQuotes: true }),
      visibleSections({ hideLibrary: true, hideQuotes: true, showAnthologies: true }),
    ]
    for (const sections of cases) {
      const rows = visibleTabs(DRAWER_TABS, sections)
      expect(rows[0], 'the menu opens on a rule').not.toBeNull()
      expect(rows.at(-1), 'the menu ends on a rule').not.toBeNull()
      expect(rows.filter((r) => r === null).length, 'more than one rule').toBeLessThanOrEqual(1)
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

  it('keeps the three shell controls answering for a section you are standing in', () => {
    // Reached by URL, a hidden section is a screen like any other: its + still
    // offers its own kind, its Search still pre-scopes to it, its ? still opens its
    // own help. A reader who typed the address has not asked for a crippled page.
    expect(addSection('movies', null)).toBe('film')
    expect(addSection('library', null)).toBe('book')
    expect(searchScope('quotes', null)).toBe('quotes')
    expect(helpScreen('library', null)).toBe('library')
  })
})

// ---- the sweep ----
//
// Everything above tests the filter. This tests that the filter is USED, which is
// a different claim and the one the four-list trap is actually about: a correct
// visibleTabs applied to three of the four lists is precisely the 1.5.0 bug, and
// every assertion above would still pass.
//
// Read out of the source, in the same way keys.test.js scrapes DRAWER_SHORTCUTS
// and home-favourites.test.js scrapes the tile gate. A running test cannot reach
// this: App mounts behind an auth fetch, the shell is not exported, and the symptom
// is a tab that is still there rather than an exception.

describe('the shell filters every list it draws', () => {
  const app = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8')
  // Everything after the import block, so the import itself is not counted as a use.
  //
  // AND WITHOUT COMMENTS. A COMMENT IS NOT A DRAW — typescale.test.js decomments for
  // the same reason. A note explaining that the rail reads CONTENT_TABS and
  // UTILITY_TABS failed this test while the code under it was correctly filtered,
  // which is a test reporting on prose rather than on behaviour.
  const body = app
    .slice(app.indexOf('const DRAWER_SHORTCUTS'))
    .split('\n')
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l))
    .join('\n')

  it.each(['CONTENT_TABS', 'UTILITY_TABS', 'DRAWER_TABS'])('passes %s through visibleTabs', (list) => {
    // The captured text reaches one character back past the name, so a bare
    // `CONTENT_TABS` and a wrapped `visibleTabs(CONTENT_TABS` are distinguishable.
    // Escaped twice on purpose: this is a regex built in a template literal, where
    // a single backslash is a STRING escape and `\b` is a backspace character.
    const uses = [...body.matchAll(new RegExp(`[\\w(]*\\b${list}\\b`, 'g'))].map((m) => m[0])
    expect(uses.length, `${list} is never drawn`).toBeGreaterThan(0)
    for (const use of uses) {
      expect(use, `${list} is drawn unfiltered`).toContain('visibleTabs(')
    }
  })

  it('hands the shortcut sheet the rows to leave out', () => {
    // The legend is generated from the key table so it cannot fall behind it, which
    // is why it needs telling: without the prop it advertises a destination whose
    // tab is not on screen.
    //
    // THE PROXIMITY WINDOW IS GONE. This read `/ShortcutSheet[\s\S]{0,240}?omit=\{/`
    // — 240 characters of hope — which breaks on adding a prop and passes on an
    // `omit` belonging to a different element further down. What the rule needs is
    // that THIS element carries it, so the element is cut out and looked at.
    // `dom/hidden-section.test.jsx` owns the consequence: what a hidden section
    // takes off the drawer and off the sheet.
    const at = body.indexOf('<ShortcutSheet')
    expect(at, 'the shortcut sheet is not rendered here at all').toBeGreaterThan(-1)
    const tag = body.slice(at, body.indexOf('/>', at) + 2)
    expect(tag, 'the shortcut sheet is not told which rows to leave out').toMatch(/\bomit=\{/)
  })

  it('gates the three doors Home draws, and neither of the two links', () => {
    // onGoLibrary / onGoMovies / onGoQuotes are doors and carry the condition.
    // onOpenBook / onOpenMovie are content links and must not: a favourite still
    // opens the book it came from however the nav is configured.
    for (const door of ['onGoLibrary', 'onGoMovies', 'onGoQuotes']) {
      expect(body, `${door} is not gated`).toMatch(new RegExp(`${door}=\\{sections\\.\\w+ \\?`))
    }
    expect(body).toContain('onOpenBook={openBook}')
    expect(body).toContain('onOpenMovie={openMovie}')
  })
})
