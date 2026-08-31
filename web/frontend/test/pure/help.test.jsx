// help.jsx — the registry behind every "?", checked against the app it claims
// to describe.
//
// WHY THIS FILE EXISTS. help.jsx's own header says the point of keeping the
// copy in one place is that "adding a control and forgetting its help is a
// visible gap". It is not visible. It is a missing row in a list nobody reads
// unless they are already lost, which is the one moment it has to be complete.
// Three gaps had accumulated by 1.6.0 and all three were found by reading, not
// by using the app:
//
//   - the whole Quotes filter row, group-by and clickable speaker credit, added
//     in 1.5.x, described nowhere;
//   - the Catalogue's group-by, which the Library has documented since the
//     control existed and the Catalogue never did;
//   - "Export all", which stopped meaning "all" when the three list screens
//     started posting the filtered view, and kept the word for two releases.
//
// So the tests below are deliberately not "the entries are well-formed". They
// are: every screen you can reach has help, and where a control's own label is
// discoverable from source, the help mentions it. A doc test that only reads the
// docs passes forever — the same failure mode that let the glossary inline its
// stylesheet inside a comment.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HELP, helpFor } from '../../src/help.jsx'
import { CONTENT_TABS, DRAWER_TABS, ROUTE_TABS, UTILITY_TABS, helpScreen } from '../../src/routes.js'

const src = (name) => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8')

// Every key a nav list can put you on. helpScreen(tab) IS tab for anything that
// is not a work detail, so this is exactly the set the "?" will look up.
const navTabs = [
  ...CONTENT_TABS.map((t) => t[0]),
  ...UTILITY_TABS.map((t) => t[0]),
  ...DRAWER_TABS.filter(Boolean).map((t) => t[0]),
  ...ROUTE_TABS,
]

describe('every screen you can reach has help', () => {
  it.each([...new Set(navTabs)].sort())('%s', (tab) => {
    expect(helpFor(helpScreen(tab, null))).not.toBeNull()
  })

  // The two detail screens do not come from a tab list: they are reached by
  // opening a work, and helpScreen derives them from `detail.type`.
  it('a book and a film detail resolve too', () => {
    expect(helpFor(helpScreen('library', { type: 'book', id: 1 }))?.title).toBe('Book')
    // 'Film, show or game' since 0040 — all three are movies rows split by
    // media_type, so one help screen covers them.
    expect(helpFor(helpScreen('movies', { type: 'movie', id: 1 }))?.title).toBe('Film, show or game')
  })

  // Both are rendered with a literal screen= prop rather than through
  // helpScreen, so neither is covered by the loop above.
  it('the surfaces with a hardcoded screen prop exist', () => {
    for (const [file, key] of [['AddSurface.jsx', 'capture'], ['App.jsx', 'profile']]) {
      expect(src(file)).toContain(`screen="${key}"`)
      expect(HELP[key]).toBeTruthy()
    }
  })

  it('an unknown key is null rather than a half-built panel', () => {
    expect(helpFor('nope')).toBeNull()
  })
})

// The gap that actually happened, made mechanical. A Select with an
// ariaLabel is a named control on a screen, and a named control the help does
// not name is the definition of the failure this file is about.
//
// Scanned per screen, and the scaffold is scanned alongside the three screens
// that render through it — "Filters" lives in works.jsx, not in Library.jsx, so
// reading only the screen file would miss the row that opens the whole sheet.
const SCAFFOLD = 'works.jsx'
const SCREEN_SOURCE = {
  library: ['Library.jsx', SCAFFOLD],
  movies: ['Movies.jsx', SCAFFOLD],
  quotes: ['Quotes.jsx', SCAFFOLD],
}

// Only labels that are a *concept* the user has to be taught. "Filter by tag"
// is self-describing and folds into the Filters entry, the way the Library has
// always folded its nine controls into one; "Group by" is not, because what the
// dimensions are differs on every screen.
const TAUGHT = ['Group by', 'Filters']

describe('a labelled control is a documented control', () => {
  for (const [screen, files] of Object.entries(SCREEN_SOURCE)) {
    const code = files.map(src).join('\n')
    for (const label of TAUGHT) {
      const rendered = code.includes(`ariaLabel="${label}"`)
      it(`${screen}: ${label}${rendered ? '' : ' (not rendered)'}`, () => {
        if (!rendered) return
        const terms = HELP[screen].entries.map((e) => e.term)
        expect(terms).toContain(label)
      })
    }
  }
})

// "Export all" was true when the button exported the collection. All three
// screens now post `shown` — the filtered view — and the confirm dialog says so
// in the body text while the button above it said "all". The word is gone from
// both the control and the copy, and this keeps it gone.
describe('export describes what it exports', () => {
  it('the scaffold does not promise "all"', () => {
    expect(src(SCAFFOLD)).not.toContain('ariaLabel="Export all"')
  })

  it.each(['library', 'movies', 'quotes'])('%s help does not either', (screen) => {
    const entry = HELP[screen].entries.find((e) => e.term.startsWith('Export'))
    expect(entry).toBeTruthy()
    expect(entry.term).toBe('Export')
    expect(entry.what).toMatch(/in view/)
  })

  // The per-work export is a different control with a different scope, and it
  // genuinely does export everything on that one work.
  it.each(['book-detail'])('%s keeps its own .md entry', (screen) => {
    expect(HELP[screen].entries.some((e) => e.term === 'Export .md')).toBe(true)
  })
})

describe('the entries themselves', () => {
  const screens = Object.keys(HELP)

  it.each(screens)('%s entries are complete', (screen) => {
    const h = HELP[screen]
    expect(h.title.trim()).not.toBe('')
    expect(h.entries.length).toBeGreaterThan(0)
    for (const e of h.entries) {
      expect(e.term.trim()).not.toBe('')
      expect(e.what.trim().length).toBeGreaterThan(20)
    }
  })

  // Duplicates are checked AFTER the shell list is merged, because that is the
  // list that renders. A screen adding its own "Search" entry would read as two
  // rows with the same heading and different words.
  it.each(screens)('%s has no repeated term, shell included', (screen) => {
    for (const touch of [false, true]) {
      const terms = helpFor(screen, touch).entries.map((e) => e.term)
      expect(new Set(terms).size).toBe(terms.length)
    }
  })
})

describe('the shell list matches the shell you have', () => {
  it('a phone is told about the drawer and a desktop is not', () => {
    const phone = helpFor('home', true).entries.map((e) => e.term)
    const desk = helpFor('home', false).entries.map((e) => e.term)
    expect(phone).toContain('Menu (☰)')
    expect(phone).toContain('Long press')
    expect(desk).not.toContain('Menu (☰)')
    expect(desk).toContain('Tab strip')
    expect(phone).not.toContain('Tab strip')
  })

  it('both get the controls both actually have', () => {
    for (const touch of [false, true]) {
      const terms = helpFor('home', touch).entries.map((e) => e.term)
      expect(terms).toContain('Add (＋)')
      expect(terms).toContain('Help (?)')
    }
  })

  it('the screen’s own entries come first', () => {
    const own = HELP.home.entries.map((e) => e.term)
    const all = helpFor('home', false).entries.map((e) => e.term)
    expect(all.slice(0, own.length)).toEqual(own)
  })
})
