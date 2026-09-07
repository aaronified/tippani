// ONE WALK OVER src/, AND A COUNT OF THE GUARDS THAT STILL HAVE THEIR OWN.
//
// WHY THIS IS A RATCHET AND NOT A RULE. `test/src-files.js` exists because a
// guard that walks the source tree passes when the walk finds nothing — every one
// of them is a list compared against `[]`. Two were caught that way by a rater
// rather than by a run, and the second was the SIBLING of the first, in the commit
// that fixed the first. That is the argument for the floor living in the walk.
//
// TWENTY-EIGHT GUARDS WALKED BY HAND when the shared walk arrived, and twenty-two
// of them have converted. Most were a plain `readdirSync(SRC).filter(...)` — a
// NON-RECURSIVE read — so each had also been silently skipping
// `src/demo/install.js` for as long as that directory has existed; all of them
// still pass with it in scope, which is the only reason this was a refactor and
// not a bug report.
//
// The six that remain read a directory that is not the source tree at all —
// `web/dist`, `src/textures`, `docs/plans`, the repo — and each says which below.
// So this is a FLOOR being held rather than a debt being paid: what it stops now
// is a NEW guard walking the source tree by hand, which is the case that matters,
// because a new guard is written by whoever has just been bitten by the thing it
// checks and is not thinking about whether its own walk can come back empty.
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

// NOT `readdirSync\s*\(`, WHICH IS WHAT THIS FIRST LOOKED FOR. Requiring the
// call parenthesis made `import { readdirSync as ls }` invisible — the name is
// there, the call is not, and the guard that is meant to catch a NEW hand-rolled
// walk was walked past by an alias. The name alone is enough, and the other ways
// to list a directory are named beside it.
const READS_A_DIRECTORY = /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|readdirp)\b/

// AND PROSE IS NOT CODE. Half the files in this suite explain in a comment what
// `readdirSync` does and why they stopped calling it — `one-stand-in.test.js`
// says so in the paragraph directly above the shared walk it now uses — so a
// match against the raw text reported the very conversions this counts.
const withoutComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

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
      && READS_A_DIRECTORY.test(withoutComments(readFileSync(join(dir, e.name), 'utf8')))) out.push(rel)
  }
  return out
}

// WHAT IS LEFT, AND WHY EACH ONE IS LEFT. Twenty-eight files read a directory by
// hand when the shared walk arrived; twenty-two converted. Every one of these
// reads a directory that is NOT the source tree, so `sourcesUnder` is the wrong
// tool for it and converting them would be a worse guard, not a better one. That
// is what makes the number a floor rather than a debt: it comes down again only
// if one of these stops needing its own read.
//
// THE LIST GREW BY ONE ON 7 SEPTEMBER, and a list whose ceiling is its own length
// has to say so out loud when that happens. `pure/harness-archive.test.js` walks
// `scripts/screenshots/` — the shell runners and the puppeteer probes — asking
// whether every harness that fills a library goes through the one shared decision
// about which library to use. A HARD-CODED LIST OF HARNESSES WOULD BE THE DEFECT
// IT IS CHECKING FOR: the failure it exists to catch is a NEW harness written
// without the branch, and a new harness is exactly what a fixed list does not
// contain. Six became seven; the rule that the count may not rise is about the
// SOURCE tree being walked twice, and this walks somewhere else.
const KNOWN = [
  'dom/surface-readability.test.jsx', // src/textures — the paper images, not source
  'pure/ai-counts.test.js',           // the whole REPO, counting Go and frontend test files
  'pure/glossary-registry.test.js',   // web/dist/assets — the BUILT stylesheet
  'pure/harness-archive.test.js',     // scripts/screenshots — the harnesses, not source
  'pure/one-walk.test.js',            // test/ — this file counts itself, see above
  'pure/pack-citations.test.js',      // docs/plans (its src half uses the shared walk)
  'pure/prefixed-pairs-survive.test.js', // web/dist — the built CSS again
]

describe('the walk over the source tree', () => {
  it('is not being re-invented by anything new', () => {
    const now = handRolled()
    const fresh = now.filter((f) => !KNOWN.includes(f))
    expect(fresh, `${fresh.join(', ')} reads a directory by hand. Use sourcesUnder() from test/src-files.js — a walk that finds nothing makes a guard green while it checks nothing, which is how two of these were found wrong by a reader rather than by a run.`)
      .toEqual([])
  })

  it('and the count of the ones that predate it may fall and never rise', () => {
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
