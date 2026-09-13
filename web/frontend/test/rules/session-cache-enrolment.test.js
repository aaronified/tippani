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
//
// WHAT THIS STILL DOES NOT SEE, and the list is here because every previous
// revision of this file ended with a sentence claiming there was nothing:
//
//   * a module that reads through a helper imported from somewhere else, so no
//     read spelling appears in it at all;
//   * a write placed further from its read than `LOOKBACK`;
//   * a bracket-assigned property — `caches['vocab'] = r.data` on an object this
//     sweep judged as a whole.
//
// It is a text sweep, not a scope analysis, and a fifth widening would be beaten
// by a sixth shape. What earns its place is the failure it DOES catch: both real
// instances in this app's history were a module-scope `let` assigned inside the
// `.then` that fetched it, and that is the spelling somebody reaches for next.
const AT_MODULE_SCOPE = /^(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=/
// Every in-place method on Array, Map and Set. A closed set the language defines,
// not a guess at what somebody will call a variable.
const MUTATORS = [
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
  'set', 'add', 'delete', 'clear',
].join('|')
// A response, however it is reached: inside a `.then(`, after an `await` on either
// helper, from a `.data` off a result, or from `await r.json()`.
//
// `fetch` AND `.json()` ARE HERE BECAUSE THE GATE ALONE WAS NOT ENOUGH. Admitting
// a module that reads with a bare `fetch()` past the gate does nothing if the WRITE
// is still only recognised next to the `json` helper — a rater walked
// `snapshot = await r.json()` past exactly that half-fix. Two doors have to be
// widened, not one.
const FROM_A_RESPONSE = /\.then\s*\(|await\s+(?:json|fetch|upload|uploadWithProgress)\s*\(|json\s*\(\s*['"]GET['"]|\.json\s*\(\s*\)|XMLHttpRequest|responseText|structuredClone/
// HOW FAR BACK A READ COUNTS AS FEEDING A WRITE. This is a proximity heuristic and
// nothing better: 12 lines was beaten by a `structuredClone` thirteen lines below its
// request and by a plain assignment fourteen below. 40 covers any function body
// anybody writes in this tree, and a write deliberately placed further from its
// read than that still escapes — which is stated rather than papered over, because
// four revisions of this file each claimed a completeness the next one disproved.
//
// The right instrument is a scope analysis, not a line window. What makes the
// window worth keeping is the shape of the real failures: both caches this rule
// exists for assigned their value inside the very `.then` that fetched it.
const LOOKBACK = 40
// EVERY WAY THIS TREE READS FROM ITS SERVER. The gate and `FROM_A_RESPONSE` have to
// agree about this: admitting a module past one while the other still only knows
// the `json` helper fixes nothing, which is exactly what happened when `fetch` was
// added to the gate alone.
const READS_FROM_SERVER = /json\s*\(\s*['"]GET['"]|\bfetch\s*\(|XMLHttpRequest|\bupload(?:WithProgress)?\s*\(/

// `i18n.js` IS THE ONE EXEMPTION, and the reason is not the one this line first
// gave.
//
// It said "the same bytes for every account… nothing in them scoped by `user_id`",
// which is true of the tables and FALSE of the module: `i18n.js`'s `pref` and
// `active` hold the reader's own stored language, written by
// `applyLocale(user.preferences?.locale || '')` at `App.jsx:186` from the account
// payload. A rater found that by reading the module the exemption invited it to
// trust, which is what an exemption arguing the wrong thing gets you.
//
// WHY IT IS ACTUALLY SAFE: that same line re-runs on every change of `user`, so
// signing in as somebody else overwrites the previous reader's language with the
// new one. It is a forget, spelled as a re-apply — and it is stronger than a
// forget, because the value is replaced rather than emptied and no screen ever
// sees a blank one. The TABLES are exempt for the original reason (they are the
// app's own translation files, and clearing them would re-fetch every string to no
// purpose); the PREFERENCE is exempt because `App.jsx:186` already owns it.
//
// If `applyLocale` ever stops being called on login, this exemption is void — that
// is the line to check, not the absence of `user_id` in a table.
const NOT_A_READER_S = new Set(['i18n.js'])

function held() {
  const out = []
  for (const f of files()) {
    if (NOT_A_READER_S.has(f)) continue
    const body = code(read(f))
    // ONLY A MODULE THAT READS FROM THE SERVER — and this gate has been widened
    // twice for the same reason. `json('GET'` was the whole of it once, so a module
    // reading with a bare `fetch()` was skipped; then `fetch` was added and a module
    // reading with `XMLHttpRequest` was skipped. Two widenings, two escapes, both
    // found by mutation rather than by thinking harder about the list.
    if (!READS_FROM_SERVER.test(body)) continue
    const lines = body.split('\n')
    const declared = lines.map((l) => l.match(AT_MODULE_SCOPE)).filter(Boolean).map((m) => m[1])
    const remembers = []
    for (const name of new Set(declared)) {
      // ASSIGNED, OR MUTATED. `set|add` was the whole list for one revision, which
      // is the enumerate-and-miss shape that let `new Map()` past the version
      // before it — a rater then walked an array filled by
      // `vocab.push(...r.data.items)` past this one.
      //
      // THIS ENUMERATION IS A DIFFERENT KIND OF LIST, and the distinction is the
      // point. `MUTATORS` is the platform's complete set of in-place methods on
      // Array, Map and Set: it is closed, it is not going to grow, and nothing
      // anybody writes can add to it. The list that kept failing was a list of
      // NAMES somebody might choose for a variable, which is open by nature.
      // `Object.assign(x, …)` is here too because it mutates its target without
      // naming a method on it at all.
      //
      // Any method would have been simpler and is wrong: `BOOK_GAPS.map(...)` and
      // `.reduce(...)` are reads, and a `const` array of literal strings was
      // reported as an unenrolled cache the moment the pattern stopped caring
      // which method it was.
      const writes = new RegExp(
        `(?:^|[^.\\w$])${name}\\s*(?:=[^=]|\\.(?:${MUTATORS})\\s*\\()` +
        `|Object\\.assign\\s*\\(\\s*${name}\\b`)
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
