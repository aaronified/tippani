// The vertical rhythm is a constant, and this counts how far it still isn't.
//
// THE RULE. A screen declares `ROW` once and every row spaces itself from that one
// name. A step typed into a row is a bug rather than a decision: five hand-tuned
// numbers agree on the day they are written and drift on the next change, and the
// drift is invisible until somebody screenshots two screens side by side.
//
// WHAT THE APP ACTUALLY DOES TODAY. It types the step in, 177 times, across seven
// different Tailwind values — `space-y-1` through `space-y-10`. That is not a rule
// being broken occasionally; it is the absence of one, and it is exactly the drift
// `--row` was introduced to end.
//
// WHY A RATCHET AND NOT A BAN. Converting 177 sites is the screen-by-screen pass,
// not the pass that introduced the constant, and a test that failed on all 177 today
// would have to be skipped — which is a test that proves nothing while looking like
// it proves something. So the count is recorded instead. It may FALL and never RISE:
// each screen that adopts `var(--row)` spends some of it, and a new screen that types
// its own step in is stopped in the run that would have shipped it.
//
// TO SPEND IT: convert a screen's stacks to the constant, run this, and write the new
// (lower) number below. Raising it is not a fix — if a screen genuinely needs a step
// ROW cannot express, it restates `--row` on its own root, which is what makes these
// per-screen constants rather than one global.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The same seam tokens.test.js uses: vitest runs from web/frontend for `npm test`
// and from the repo root for `npx vitest --root web/frontend`.
const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')

// Hand-typed VERTICAL steps only. `gap-x`/`space-x` are horizontal and answer to
// EDGE and to a row's own layout, not to ROW.
const STEP = /\b(?:space-y-\d+|gap-y-\d+)\b/g

const CEILING = 175

function countedFiles() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith('.jsx') || f.endsWith('.js'))
    .sort()
}

function debt() {
  const perFile = []
  let total = 0
  for (const f of countedFiles()) {
    const n = (readFileSync(join(SRC, f), 'utf8').match(STEP) || []).length
    if (n) perFile.push([f, n])
    total += n
  }
  perFile.sort((a, b) => b[1] - a[1])
  return { total, perFile }
}

describe('the vertical rhythm', () => {
  it(`is still typed in by hand no more than ${CEILING} times`, () => {
    const { total, perFile } = debt()
    expect(
      total,
      `Hand-typed vertical steps rose to ${total}, over the recorded ${CEILING}.\n` +
        'A screen declares ROW once and spaces from it — `var(--row)` — rather than\n' +
        'typing space-y-N into each stack. Worst offenders:\n' +
        perFile.slice(0, 6).map(([f, n]) => `  ${n}\t${f}`).join('\n'),
    ).toBeLessThanOrEqual(CEILING)
  })

  it('has a ceiling that has not been left behind by its own progress', () => {
    const { total } = debt()
    // A ceiling far above the truth stops catching anything. When a screen pass
    // spends the debt, this is the reminder to write the lower number down.
    expect(
      CEILING - total,
      `The debt is ${total} but the ceiling still says ${CEILING}. Lower CEILING to ` +
        `${total} so the next screen that types a step in is actually caught.`,
    ).toBeLessThanOrEqual(12)
  })
})
