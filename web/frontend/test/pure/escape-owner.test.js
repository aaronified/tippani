// ONE OWNER FOR ESCAPE, held as a ratchet.
//
// There were seventeen `document.addEventListener("keydown", …)` handlers across
// the app, and every one that recognised Escape acted on it. None yielded and
// none stopped propagation, so a single press reached all of them: open a work's
// Details panel, press a row's pencil, type, press Escape — the draft goes and so
// does the panel. Nothing throws. There is simply less on the screen than there
// was, and one of the missing things is what you just wrote.
//
// The fix is arbitration, and arbitration only works if it is the ONLY thing
// listening. One new hand-rolled listener puts the old bug back for whatever pair
// of surfaces it happens to overlap with — and it will pass every other test in
// this repo, because nothing else can see two listeners fighting.
//
// So this reads the source. `useEscape` (ui.jsx) is the one permitted answer, and
// its own listener is the one permitted registration.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = new URL('../../src/', import.meta.url).pathname

const sources = () =>
  readdirSync(SRC, { recursive: true })
    .filter((f) => /\.jsx?$/.test(f))
    .map((f) => [f, readFileSync(join(SRC, f), 'utf8')])

// Comments are stripped: this file's own prose says the word "keydown" a dozen
// times, and so do the explanations beside the code it is policing.
const decommented = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')

// The one file allowed to register a keydown listener on the document at all,
// and the two it is allowed to have: the ladder's own, and the Select's arrow
// and Enter navigation — which no longer touches Escape.
const OWNER = 'ui.jsx'
const OWNER_ALLOWANCE = 2

describe('only one thing in this app listens for Escape', () => {
  it('registers no document keydown handler outside ui.jsx', () => {
    const offenders = []
    for (const [file, raw] of sources()) {
      if (file === OWNER) continue
      const hits = [...decommented(raw).matchAll(/document\.addEventListener\(\s*['"`]keydown['"`]/g)]
      if (hits.length) offenders.push(`${file} (${hits.length})`)
    }
    expect(
      offenders.sort(),
      'a hand-rolled keydown listener is back: it will fire alongside the ladder and close ' +
        'two surfaces on one press. Register with useEscape instead — see ui.jsx.',
    ).toEqual([])
  })

  it('keeps ui.jsx to the ladder itself and the listbox navigation', () => {
    const raw = decommented(readFileSync(join(SRC, OWNER), 'utf8'))
    const hits = [...raw.matchAll(/document\.addEventListener\(\s*['"`]keydown['"`]/g)]
    expect(
      hits.length,
      'ui.jsx grew another keydown listener. There are two: escKey (the ladder) and the ' +
        'Select listbox (arrows and Enter, no Escape). A third needs a reason in writing.',
    ).toBe(OWNER_ALLOWANCE)
  })

  it('leaves no Escape branch behind in a handler that still exists', () => {
    // The listener may survive for other keys — the Select's does — but the
    // moment it answers Escape it is competing again.
    const raw = decommented(readFileSync(join(SRC, OWNER), 'utf8'))
    // Anchor on the REGISTRATION and read backwards to the handler it names.
    // Anchoring on the handler instead finds whichever `const onKey` comes first
    // in the file, which is not necessarily the one being registered.
    for (const m of raw.matchAll(/document\.addEventListener\(\s*['"`]keydown['"`],\s*(\w+)/g)) {
      const name = m[1]
      if (name === 'escKey') continue // the ladder itself; Escape is its whole job
      const decl = raw.lastIndexOf(`const ${name} = `, m.index)
      expect(decl, `cannot find where ${name} is declared`).toBeGreaterThan(-1)
      expect(
        raw.slice(decl, m.index),
        `${name} still answers Escape — it will fire alongside the ladder`,
      ).not.toMatch(/Escape/)
    }
  })

  it('has every surface registered through the one hook', () => {
    // A floor rather than an exact count, so adding a surface is not a test
    // change — but a sweep that deleted them all would be caught.
    let n = 0
    for (const [, raw] of sources()) n += [...decommented(raw).matchAll(/useEscape\(/g)].length
    expect(n, 'the surfaces stopped registering with the ladder').toBeGreaterThanOrEqual(15)
  })
})
