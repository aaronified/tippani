// WHAT THE SPA ASKS FOR HAS TO BE SOMETHING THE SERVER ANSWERS.
//
// Removing a character from a work is refused while that character is named on
// the work's own lines — a 409 with a count — because a removal that leaves the
// lines alone undoes itself: the next read of the work puts the character back on
// its cast (`cast_from_quotes.go`). So the reader is asked what to do with the
// lines, and the answer rides on the DELETE as `?quotes=`.
//
// THE DEFECT THIS PINS. There were two copies of that dialog, one per branch of
// the character screen, and they had drifted: the work-level one sent
// `?quotes=move`, which the handler rejects with 400. On that branch the press
// that KEEPS a character's lines simply did not work — and the DOM test covering
// it asserted `move`, so it was green. The test had been written from the handler
// that had just been typed instead of from what the endpoint accepts, which is a
// test that cannot fail for the reason it exists.
//
// SO THE ALLOWED SET IS READ OUT OF THE GO SOURCE, not written down here. A word
// added to the handler widens this sweep on its own; a word the handler drops
// narrows it. Nothing in this file can be satisfied by agreeing with the frontend,
// which is the only way a cross-language contract stays honest — and a test writer
// needs to know nothing about either side beyond "these two must agree".

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
// src -> web/frontend -> web -> the repo. `vitest.config.js` sets TIPPANI_SRC to
// an absolute path; a run that overrides it with a relative one resolves against
// the same three levels, so the arithmetic holds either way.
const REPO = resolve(SRC, '..', '..', '..')
const HANDLER = join(REPO, 'internal', 'httpapi', 'character_works.go')

// The handler's own switch over the disposition — every word it names between
// reading the parameter and refusing everything else.
//
// EVERY QUOTED WORD IN THAT WINDOW, NOT ONLY THE ONE AFTER EACH `case`. The
// handler writes `case "", "clear":` — two labels on one line, the empty one
// meaning "no preference given" — so anchoring on `case ` finds `replace` and
// misses `clear`, which is the word the reader's other way out sends. A
// single-word set would then have made this sweep call the app's own `clear` a
// refusal. Words with spaces in them are the refusal MESSAGES and cannot match.
function accepted() {
  const go = readFileSync(HANDLER, 'utf8')
  const at = go.indexOf('Query().Get("quotes")')
  expect(at, `${HANDLER} no longer reads a "quotes" parameter — this sweep is measuring nothing`)
    .toBeGreaterThan(-1)
  // FROM THE SWITCH, NOT FROM THE READ. Starting at `Query().Get("quotes")`
  // swept up the PARAMETER NAMES — "quotes" and "to" — and reported them as
  // dispositions no screen sends, which is a sweep failing on its own frame.
  const rest = go.slice(go.indexOf('switch', at))
  const end = rest.indexOf('default:')
  expect(end, 'the handler no longer refuses an unknown disposition, so there is no set to read')
    .toBeGreaterThan(-1)
  const window = rest.slice(0, end)
  return new Set([...window.matchAll(/"([a-z]+)"/g)].map((m) => m[1]))
}

// Every `?quotes=<word>` the SPA sends, whether typed as a literal or built into
// a template string.
//
// COMMENTS ARE STRIPPED FIRST, and that is not tidiness: the note explaining why
// `move` was wrong contains the word `?quotes=move`, so the first run of this
// sweep reported its own documentation as a live defect. A sweep a comment can
// trip is a sweep whose findings have to be read twice.
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

function sent() {
  const out = []
  for (const f of sourcesUnder((n) => n.endsWith('.jsx') || n.endsWith('.js'), 40)) {
    const text = code(readFileSync(join(SRC, f), 'utf8'))
    for (const m of text.matchAll(/[?&]quotes=([a-z]+)/g)) out.push({ file: f, word: m[1] })
  }
  return out
}

describe('the disposition a character removal carries', () => {
  it('is spelled the way the endpoint that reads it accepts', () => {
    const ok = accepted()
    expect(ok.size, 'the handler offers no dispositions at all, so this sweep would pass anything')
      .toBeGreaterThan(1)
    const asked = sent()
    expect(asked.length, 'nothing in the SPA sends a disposition, so the sweep is over an app that does not do this')
      .toBeGreaterThan(1)
    const refused = asked.filter((a) => !ok.has(a.word))
      .map((a) => `${a.file}: ?quotes=${a.word}`)
    expect([...new Set(refused)],
      `these send a disposition the server answers 400 to; it takes ${[...ok].sort().join(' or ')}`)
      .toEqual([])
  })

  // AND EVERY WORD THE ENDPOINT TAKES IS REACHABLE FROM THE SCREEN. The other
  // direction, and not symmetry for its own sake: `clear` and `replace` are the
  // reader's two ways out of the 409, and one of them missing from the app is a
  // dialog that asks a question with an answer it cannot send.
  it('covers both ways out of the refusal', () => {
    const ok = accepted()
    const words = new Set(sent().map((a) => a.word))
    const missing = [...ok].filter((w) => !words.has(w))
    expect(missing,
      'the endpoint accepts these and no screen ever sends them, so a reader offered that way out cannot take it')
      .toEqual([])
  })
})
