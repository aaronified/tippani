// A PROPERTY THE STYLESHEET DECLARES REACHES THE STYLESHEET THAT SHIPS.
//
// WHAT HAPPENED, and it is the only reason this file exists. `.tp-scrim` declared
//
//     backdrop-filter: blur(10px) saturate(.78);
//     -webkit-backdrop-filter: blur(10px) saturate(.78);
//
// and the build shipped ONLY the `-webkit-` one. Every guard in this repo that
// reads the stylesheet reads `src/index.css`, so all of them were satisfied; the
// screen was not. Measured in a real browser on a real library,
// `getComputedStyle(scrim).backdropFilter` came back `none` and the page behind
// an open sheet was sharp — which is exactly what the owner had reported as
// "also introduce focus blur, on desktop and mobile both", and what I had
// answered by moving a declaration that was never arriving.
//
// THE MECHANISM IS THE MINIFIER'S AND NOT WORTH ENCODING. Writing the standard
// property first and the `-webkit-` twin second let the collapse keep the twin;
// the other order keeps both. Which pairs it does this to, and under which
// targets, is its business and can change with a version bump — so this asks the
// OUTPUT whether both survived, not the input whether they are in a blessed
// order.
//
// WHY IT IS NOT ENOUGH TO READ THE SOURCE, said once more because every other
// CSS guard here does exactly that: `src/index.css` is the author's intent and
// `web/dist/assets/*.css` is what a reader's browser gets. A test that only ever
// reads the first cannot see a whole class of defect, and this class is silent —
// nothing errors, nothing warns, the rule simply is not there.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that `web/dist/` is a
// COMMITTED build artefact rebuilt by `make frontend`; and that a pair means one
// standard property and its `-webkit-` twin declared for the same rule.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const DIST = join(SRC, '..', '..', 'dist', 'assets')

const source = readFileSync(join(SRC, 'index.css'), 'utf8')
const built = existsSync(DIST)
  ? readdirSync(DIST).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(DIST, f), 'utf8')).join('\n')
  : ''

// Every `-webkit-x` the source declares, where it also declares plain `x`.
const twinned = [...new Set([...source.matchAll(/^\s*-webkit-([a-z-]+)\s*:/gm)].map((m) => m[1]))]
  .filter((p) => new RegExp(`^\\s*${p}\\s*:`, 'm').test(source))

// `(?<![-a-z])` so `mask-image` does not match inside `-webkit-mask-image`.
const count = (text, prop) => (text.match(new RegExp(`(?<![-a-z])${prop}\\s*:`, 'g')) || []).length

describe('the built stylesheet', () => {
  it('is there to be read at all', () => {
    expect(built.length,
      'web/dist/assets holds no CSS — run `make frontend`; the committed build is what a reader gets')
      .toBeGreaterThan(1000)
  })

  it('carries pairs to check, so this file has not quietly emptied itself', () => {
    expect(twinned.length, 'no property is declared both plain and -webkit- prefixed any more').toBeGreaterThan(0)
  })

  it.each(twinned)('keeps the standard `%s` beside its -webkit- twin', (prop) => {
    const std = count(built, prop)
    const pre = count(built, `-webkit-${prop}`)
    expect(std,
      `the build ships ${pre} \`-webkit-${prop}\` and ${std} \`${prop}\` — the standard property was ` +
      'dropped on the way out, so every browser that wants the unprefixed name gets nothing')
      .toBeGreaterThanOrEqual(pre)
  })
})
