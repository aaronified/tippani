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

// A MODULE-SCOPE BINDING, which is the whole hazard: `let` or `var` at column zero
// lives as long as the tab. A cache inside a hook or a component dies with it and
// is nobody's problem.
const AT_MODULE_SCOPE = /^(?:let|var)\s+([A-Za-z_$][\w$]*)\s*=/
// What people call one. Not exhaustive and not meant to be — it is the shape of
// the two that went wrong, so the next one written in the same idiom is caught.
const REMEMBERS = /cache|inflight|pending|primed|memo|store/i

function held() {
  const out = []
  for (const f of files()) {
    const body = code(read(f))
    // Only a module that talks to the server can be caching a response.
    if (!/json\(\s*['"]GET['"]/.test(body)) continue
    const names = body.split('\n')
      .map((l) => l.match(AT_MODULE_SCOPE))
      .filter(Boolean)
      .map((m) => m[1])
      .filter((n) => REMEMBERS.test(n))
    if (names.length) out.push({ file: f, names, enrolled: /registerSessionCache\s*\(/.test(body) })
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
