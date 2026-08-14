// Every screen mounts.
//
// THIS FILE EXISTS BECAUSE 1.13.0 SHIPPED A QUOTES SCREEN THAT THREW ON SIGHT.
// The board memo was written below the three memos that name it in their
// dependency arrays, and a dependency array is not a closure — it is built the
// moment the line runs, so `board` was read inside its own temporal dead zone and
// the whole page died with "can't access lexical declaration 'Se' before
// initialisation". Not a data bug and not an edge: every render, every library,
// empty or full.
//
// The suite had ten tests touching that file and none of them caught it, for a
// reason worth naming: every one of them imported a FUNCTION out of the module —
// groupUtterances, utteranceState, utteranceMeta, utteranceYear. Pulling the
// logic out of a component to test it is right, and it is exactly what left the
// component itself unexecuted. A page can be wholly broken while every extracted
// piece of it is green.
//
// So this is a smoke test, and it is deliberately shallow: it asserts that each
// screen can be put on a page. It makes no claim about what the screen shows —
// the screens that need that have their own files.
//
// The api is mocked to FAIL rather than to return empty collections. Two reasons.
// A failed load needs no invented payload shape, so this file does not silently
// become the place where eleven response formats are guessed at and then rot. And
// it exercises the state every screen must survive and nobody tests by hand: the
// server said no. A first-render throw like the one above happens before any
// fetch settles, so the mock's answer is irrelevant to catching it.

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Every request refused, and refused the way api.js reports a refusal so the
// screens take their real error branch rather than an impossible one.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, error: 'refused by the mock' })),
}))

const SRC = process.env.TIPPANI_SRC

// A user with the shape App hands down: the preferences bag is read with `?.` in
// most places and not all, and an admin-only screen that never renders its admin
// half is half a test.
const USER = {
  username: 'tester',
  display_name: 'Tester',
  is_admin: true,
  preferences: { creditSeparators: ',;&' },
}

const noop = () => {}

// The props App.jsx actually passes, per screen. Handlers are no-ops — this test
// is about mounting, not about what the buttons do.
//
// The importer is a thunk per entry rather than `import(`../../src/${file}`)`: a
// template-literal specifier makes Rollup warn that it cannot see what might be
// imported, and a warning nobody can fix is a warning everybody learns to skip.
//
// login and onboarding live inside App.jsx rather than in files of their own, and
// they are here because they are screens — the pre-auth pair, and the two whose
// failure nobody can route around.
const SCREENS = {
  home: [() => import('../../src/Home.jsx'), 'default', { user: USER, stats: null, onOpenBook: noop, onOpenMovie: noop, onGoLibrary: noop, onGoMovies: noop, onGoQuotes: noop, onPending: noop, pendingImport: null, onReviewImport: noop }],
  library: [() => import('../../src/Library.jsx'), 'default', { openId: null, onOpen: noop, onClose: noop, onOpenMovie: noop, creditSeparators: ',;&', onAdd: noop, dataNonce: 0 }],
  movies: [() => import('../../src/Movies.jsx'), 'default', { openId: null, onOpen: noop, onClose: noop, creditSeparators: ',;&', onAdd: noop, dataNonce: 0 }],
  metadata: [() => import('../../src/MetadataPage.jsx'), 'default', { user: USER, onOpenBook: noop, onOpenMovie: noop, onSearch: noop }],
  search: [() => import('../../src/SearchPage.jsx'), 'default', { onOpenBook: noop, onOpenMovie: noop, creditSeparators: ',;&' }],
  quotes: [() => import('../../src/Quotes.jsx'), 'default', { creditSeparators: ',;&' }],
  tags: [() => import('../../src/TagsPage.jsx'), 'default', {}],
  stats: [() => import('../../src/StatsPage.jsx'), 'default', { onSearch: noop }],
  staging: [() => import('../../src/StagingPage.jsx'), 'default', { onPending: noop, onOpenBook: noop, onOpenMovie: noop, onApproved: noop }],
  settings: [() => import('../../src/Settings.jsx'), 'default', { user: USER, onPreferences: noop, update: null, onUpdateInfo: noop, onStartTour: noop, onOpenBin: noop }],
  bin: [() => import('../../src/BinPage.jsx'), 'default', { onClose: noop }],
  login: [() => import('../../src/App.jsx'), 'Login', { onLogin: noop }],
  onboarding: [() => import('../../src/App.jsx'), 'Onboarding', { onDone: noop, backup: null }],
}

// App tags each screen's wrapper with its route key, which makes the app itself
// the authority on what the list is. A table beside a source file is the shape
// that rots — the same reasoning as the FTS sweep's completeness test.
function screenLabelsInApp() {
  const s = readFileSync(join(SRC, 'App.jsx'), 'utf8')
  return [...s.matchAll(/data-screen-label="([a-z-]+)"/g)].map((m) => m[1]).sort()
}

describe('every screen App can route to', () => {
  it('is in this file, and nothing here is a screen App dropped', () => {
    const inApp = screenLabelsInApp()
    expect(inApp.length).toBeGreaterThan(8) // the regex still finds them
    expect(inApp).toEqual(Object.keys(SCREENS).sort())
  })

  // One case per screen rather than a loop with one assertion, so a failure names
  // the screen in its own line instead of collapsing thirteen into one red test.
  for (const [key, [load, name, props]] of Object.entries(SCREENS)) {
    it(`${key} mounts`, async () => {
      const Screen = (await load())[name]
      expect(Screen, `${key} has no ${name} export`).toBeTypeOf('function')
      // React logs a component stack to console.error before rethrowing, which
      // is noise for an expected-to-pass test and misleading in a suite log.
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(() => render(<Screen {...props} />)).not.toThrow()
      } finally {
        quiet.mockRestore()
      }
    })
  }
})
