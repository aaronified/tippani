// A CACHE THAT NOBODY REMEMBERED TO EMPTY.
//
// The behaviour — sign out, and the next reader is served from the server rather
// than from what you left behind — is asserted in `test/dom/session-caches.test.jsx`
// against the caches that exist. This file is about the one that does not exist
// yet.
//
// THE FAILURE IS AN OMISSION, and it has happened twice. `daily.js` grew a forget
// because signing out and back in as somebody else inside a five-second window
// served the first reader's deck, pending count and streak. Then `SearchPage.jsx`
// cached `GET /search/vocabulary` "for the session" — nine queries each scoped by
// `user_id`, every author, performer, tag and shelf name in one library — with no
// forget anywhere, and nothing noticed for months. Neither was a hard problem to
// see; both were a line somebody did not think to write.
//
// So the rule is stated as a rule rather than as two fixes: A MODULE THAT
// REMEMBERS A SERVER RESPONSE ACROSS SCREENS ENROLS THAT MEMORY. Adding a third
// cache and not enrolling it fails here, at the moment it is written, rather than
// on somebody's shared browser.
//
// WHY THE INVARIANT IS WORTH A SWEEP OF ITS OWN. CLAUDE.md: "Per-user isolation:
// every query scoped by `user_id`; another user's row is `404`, never `403`", which
// DEVELOPMENT.md calls a security property. Signing out of this app does not reload
// the document — it swaps the shell for the login screen in place — so a
// module-scope binding is exactly as long-lived as the browser tab, not as the
// session.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const read = (f) => readFileSync(join(SRC, f), 'utf8')
// Comments name the caches and explain the defect; left in, they would be reported
// as instances of it.
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const files = () => sourcesUnder((n) => n.endsWith('.jsx') || n.endsWith('.js'), 40)

// WHAT MAKES SOMETHING A CACHE OF A READER'S DATA. Not its name, and not its
// type — that it is WRITTEN FROM A RESPONSE, at module scope.
//
// The first version of this file looked for `let|var` whose NAME matched a
// six-word list, and a rater beat it twice over in the shapes most likely to be
// written next: `let vocabulary = null` refilled from a GET (outside the list) and
// `const personCache = new Map()` (a `const`, but a Map is filled by mutation and
// is exactly as long-lived). Both passed. A sweep whose reach is a vocabulary list
// reaches the words somebody already thought of.
//
// The second version asked instead whether a module-scope binding is assigned
// again anywhere below, which caught those two and thirty other things: every
// subscriber `Set`, the scroll memory, the toast sink, six pieces of locale state.
// A rule that demands a subscriber list be emptied on sign-out is worse than no
// rule — it would be switched off, or answered with a twenty-seven-entry
// allow-list, which is the vocabulary list again wearing a different hat.
//
// So the discriminator is the WRITE: a module-scope binding assigned — or a
// module-scope collection filled — from a value that came back from the server. A
// subscriber Set is filled from a component; a cache is filled from a response,
// and that is the difference that matters, because it is exactly the values that
// belong to one reader.
const AT_MODULE_SCOPE = /^(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=/
// A response, however this tree spells it: inside a `.then(`, after an
// `await json(`, or from a `.data` off a result.
const FROM_A_RESPONSE = /\.then\s*\(|await\s+json\s*\(|json\s*\(\s*['"]GET['"]/
const LOOKBACK = 12

// LOCALE TABLES ARE NOT A READER'S DATA, and this is the one exemption, argued
// rather than listed. `i18n.js` holds the app's own translation files — the same
// bytes for every account, fetched from `/locales` and keyed by language, with
// nothing in them scoped by `user_id`. Emptying them on sign-out would re-fetch
// every string to no purpose, and the module already clears them when the
// LANGUAGE changes, which is the thing they actually depend on. If a future
// version of that module starts holding anything a reader owns, this line is what
// has to be argued away.
const NOT_A_READER_S = new Set(['i18n.js'])

function held() {
  const out = []
  for (const f of files()) {
    if (NOT_A_READER_S.has(f)) continue
    const body = code(read(f))
    // Only a module that talks to the server can be caching a response.
    if (!/json\(\s*['"]GET['"]/.test(body)) continue
    const lines = body.split('\n')
    const declared = lines.map((l) => l.match(AT_MODULE_SCOPE)).filter(Boolean).map((m) => m[1])
    const remembers = []
    for (const name of new Set(declared)) {
      // Assigned, or filled: `x = …` for a binding, `x.set(…)` / `x.add(…)` for a
      // collection that is never reassigned at all.
      const writes = new RegExp(`(?:^|[^.\\w$])${name}\\s*(?:=[^=]|\\.(?:set|add)\\s*\\()`)
      const fedByServer = lines.some((line, i) => {
        if (!writes.test(line)) return false
        if (AT_MODULE_SCOPE.test(line)) return false // the declaration itself
        const near = lines.slice(Math.max(0, i - LOOKBACK), i + 1).join('\n')
        return FROM_A_RESPONSE.test(near) || /\.data\b/.test(line)
      })
      if (fedByServer) remembers.push(name)
    }
    if (remembers.length) {
      out.push({ file: f, names: remembers, enrolled: /registerSessionCache\s*\(/.test(body) })
    }
  }
  return out
}

describe('a module that remembers a server response', () => {
  it('enrols that memory, so signing out empties it', () => {
    const loose = held().filter((h) => !h.enrolled)
      .map((h) => `${h.file}: ${h.names.join(', ')}`)
    expect(loose,
      'these hold a server response at module scope and never register it — signing out does not reload the page, so the next account on this browser is served what the last one left behind')
      .toEqual([])
  })

  it('and there are some, or this sweep is measuring nothing', () => {
    // The claim above is satisfied by an app with no caches at all. Two exist
    // today; if this ever reads zero, the sweep has stopped finding what it
    // sweeps for rather than the app having stopped doing it.
    expect(held().length,
      'no module-scope cache of a GET was found anywhere, so the sweep above cannot fail')
      .toBeGreaterThanOrEqual(2)
  })

  // AND THE ONE PLACE THAT EMPTIES THEM IS REACHED FROM SIGNING OUT. Enrolling is
  // half of it; a registry nothing calls is a list.
  it('is emptied by signing out, which is the only path that does not reload', () => {
    const app = code(read('App.jsx'))
    const logout = app.match(/onLogout=\{[^}]*\}/)
    expect(logout, 'App no longer wires a sign-out, so this rule has nothing to attach to').toBeTruthy()
    expect(logout[0],
      'signing out does not empty the enrolled caches — and it is the one way out of an account that leaves the document standing, since switching account sets the address and reloads')
      .toMatch(/forgetSessionCaches\s*\(/)
  })
})
