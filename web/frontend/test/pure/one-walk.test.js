// ONE WALK OVER src/, AND A COUNT OF THE GUARDS THAT STILL HAVE THEIR OWN.
//
// WHY THIS IS A RATCHET AND NOT A RULE. `test/src-files.js` exists because a
// guard that walks the source tree passes when the walk finds nothing — every one
// of them is a list compared against `[]`. Two were caught that way by a rater
// rather than by a run, and the second was the SIBLING of the first, in the commit
// that fixed the first. That is the argument for the floor living in the walk.
//
// But twenty-eight guards were written before there was a shared walk. Ten of
// them converted in the same commit as this file — every one a plain
// `readdirSync(SRC).filter(...)`, which is a NON-RECURSIVE read, so each of them
// silently skipped `src/demo/install.js`; all ten still pass with it in scope. The
// rest read something other than the source tree, or read it in a shape that has
// to be looked at one at a time, and converting those blind would mix a violation
// with the refactor that surfaced it. So the number comes down in batches, and
// this holds the line meanwhile: it may fall and never rise, exactly like
// `spacing-debt.test.js` and `typescale-baseline.json`.
//
// WHAT IT ACTUALLY STOPS, today: a NEW guard walking the tree by hand. That is
// the case that matters, because a new guard is written by whoever has just been
// bitten by the thing it checks and is not thinking about whether its walk can
// return nothing.
//
// WHAT A TEST WRITER NEEDS TO KNOW: use `sourcesUnder()` from `test/src-files.js`.
// If you are reading a directory that is NOT the source tree — `web/dist`,
// `src/textures` — say so in the list below with the reason, because this counts
// by hand-rolled `readdirSync` and cannot tell those apart.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { sourcesUnder } from '../src-files.js'

const TESTS = join(process.env.TIPPANI_SRC, '..', 'test')

// Every file under test/ that reads a directory itself. Named, not counted, so
// the failure says WHICH one is new.
//
// THIS FILE COUNTS ITSELF, and stays on the list below. Exempting the counter is
// how a count starts lying: it reads a directory by hand for the same reason the
// others do, and the honest number includes it.
function handRolled(dir = TESTS, base = '', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) handRolled(join(dir, e.name), rel, out)
    else if (/\.(js|jsx)$/.test(e.name) && rel !== 'src-files.js'
      && /\breaddirSync\s*\(/.test(readFileSync(join(dir, e.name), 'utf8'))) out.push(rel)
  }
  return out
}

// The ones that were here when the shared walk arrived. The number may fall and
// never rise; a name coming off this list is a guard converted.
const KNOWN = [
  'dom/confirm-finality.test.jsx',
  'dom/field-icon-button.test.jsx',
  'dom/glyph-drawn-size.test.jsx',
  'dom/nested-dismiss.test.jsx',
  'dom/person-router.test.jsx',
  'dom/speaker-destinations.test.jsx',
  'dom/surface-readability.test.jsx',
  'pure/ai-counts.test.js',
  'pure/escape-owner.test.js',
  'pure/glossary-registry.test.js',
  'pure/locale-shadow.test.js',
  'pure/no-hardcoded-bengali.test.js',
  'pure/one-walk.test.js',
  'pure/pack-citations.test.js',
  'pure/popup-offsets.test.js',
  'pure/prefixed-pairs-survive.test.js',
  'pure/typescale.test.js',
  'token-scan.js',
]

describe('the walk over the source tree', () => {
  it('is not being re-invented by anything new', () => {
    const now = handRolled()
    const fresh = now.filter((f) => !KNOWN.includes(f))
    expect(fresh, `${fresh.join(', ')} reads a directory by hand. Use sourcesUnder() from test/src-files.js — a walk that finds nothing makes a guard green while it checks nothing, which is how two of these were found wrong by a reader rather than by a run.`)
      .toEqual([])
  })

  it('and the ones that predate it are coming down, not going up', () => {
    const now = handRolled()
    expect(now.length, `${now.length} files read a directory by hand, up from ${KNOWN.length} — the number may fall and never rise`)
      .toBeLessThanOrEqual(KNOWN.length)
  })

  it('and the shared one really reads the tree', () => {
    // The counterweight: this file's whole argument is that a walk can be empty
    // and silent, so the walk it points people at is asked to prove it is not.
    expect(sourcesUnder(), 'the shared walk is not reaching the app').toContain('App.jsx')
  })
})
