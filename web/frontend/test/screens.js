// Every screen App can route to, in one table.
//
// THE TABLE WAS BORN IN screens-mount.test.jsx and moved here the moment a second
// file needed it. Two files asking "what are all the screens?" is exactly the
// question that must have one answer: a screen added to one list and forgotten in
// the other is a screen with half a gate over it, and the half that is missing is
// invisible.
//
// It is a shared helper rather than an export from the test that used to own it,
// for the reason locale-file.js is one: a test file that other test files import
// runs its own cases twice over.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// TIPPANI_SRC is web/frontend/src, exported by vitest.config.js — a test cannot
// work out where the source is on its own.
const SRC = process.env.TIPPANI_SRC

// A user with the shape App hands down: the preferences bag is read with `?.` in
// most places and not all, and an admin-only screen that never renders its admin
// half is half a test.
export const USER = {
  username: 'tester',
  display_name: 'Tester',
  is_admin: true,
  preferences: { creditSeparators: ',;&' },
}

const noop = () => {}

// The props App.jsx actually passes, per screen. Handlers are no-ops — the callers
// of this table are about what renders, not about what the buttons do.
//
// The importer is a thunk per entry rather than `import(`../src/${file}`)`: a
// template-literal specifier makes Rollup warn that it cannot see what might be
// imported, and a warning nobody can fix is a warning everybody learns to skip.
//
// login and onboarding live inside App.jsx rather than in files of their own, and
// they are here because they are screens — the pre-auth pair, and the two whose
// failure nobody can route around.
export const SCREENS = {
  home: [() => import('../src/Home.jsx'), 'default', { user: USER, stats: null, onOpenBook: noop, onOpenMovie: noop, onGoLibrary: noop, onGoMovies: noop, onGoQuotes: noop, onPending: noop, pendingImport: null, onReviewImport: noop }],
  library: [() => import('../src/Library.jsx'), 'default', { openId: null, onOpen: noop, onClose: noop, onOpenMovie: noop, creditSeparators: ',;&', onAdd: noop, dataNonce: 0 }],
  movies: [() => import('../src/Movies.jsx'), 'default', { openId: null, onOpen: noop, onClose: noop, creditSeparators: ',;&', onAdd: noop, dataNonce: 0 }],
  metadata: [() => import('../src/MetadataPage.jsx'), 'default', { user: USER, onOpenBook: noop, onOpenMovie: noop, onSearch: noop }],
  search: [() => import('../src/SearchPage.jsx'), 'default', { onOpenBook: noop, onOpenMovie: noop, creditSeparators: ',;&' }],
  quotes: [() => import('../src/Quotes.jsx'), 'default', { creditSeparators: ',;&' }],
  anthologies: [() => import('../src/anthologies.jsx'), 'default', { openId: null, onOpen: noop, onClose: noop, onOpenBook: noop, onOpenMovie: noop }],
  tags: [() => import('../src/TagsPage.jsx'), 'default', {}],
  stats: [() => import('../src/StatsPage.jsx'), 'default', { onSearch: noop }],
  staging: [() => import('../src/StagingPage.jsx'), 'default', { onPending: noop, onOpenBook: noop, onOpenMovie: noop, onApproved: noop }],
  settings: [() => import('../src/Settings.jsx'), 'default', { user: USER, onPreferences: noop, update: null, onUpdateInfo: noop, onStartTour: noop, onOpenBin: noop, onOpenCleanup: noop }],
  bin: [() => import('../src/BinPage.jsx'), 'default', { onClose: noop }],
  cleanup: [() => import('../src/CleanupPage.jsx'), 'default', { onClose: noop, onOpenBook: noop, onOpenMovie: noop, onOpenQuotes: noop }],
  login: [() => import('../src/App.jsx'), 'Login', { onLogin: noop }],
  onboarding: [() => import('../src/App.jsx'), 'Onboarding', { onDone: noop, backup: null }],
}

// App tags each screen's wrapper with its route key, which makes the app itself
// the authority on what the list is. A table beside a source file is the shape
// that rots — the same reasoning as the FTS sweep's completeness test.
export function screenLabelsInApp() {
  const s = readFileSync(join(SRC, 'App.jsx'), 'utf8')
  return [...s.matchAll(/data-screen-label="([a-z-]+)"/g)].map((m) => m[1]).sort()
}
