// THE TOUCH-FLOOR CEILING HAS TO BE FINDABLE, OR THE GATE IS OFF AND SAYS "ok".
//
// WHAT WENT WRONG. `controls-baseline.json` was keyed by WIDTH alone, and the
// number under `390` — 326 sub-44px controls — was measured against the owner's
// own library. `make controls` does not use that library: `run-controls.sh` seeds
// a fixture of public-domain titles and a cast of three, which draws far fewer
// controls. So the run measured 187 against a ceiling of 326 and printed `ok`
// with 139 controls of slack in it. A hundred new controls under the touch floor
// could have landed and the gate would still have passed.
//
// AND THE FAILURE IS SILENT BY DESIGN, which is what makes it worth a test.
// `controls.mjs` deliberately does not fail on a MISSING ceiling — "a missing
// ceiling is not a regression", and failing there is how a ratchet gets deleted
// rather than filled in. That is right, and it means a fixture name that does not
// match the baseline turns the ratchet off while the run still exits 0. Nothing
// in the output distinguishes "measured and under" from "never compared" except
// one word on one line nobody reads at the end of fifty minutes.
//
// SO THIS ASSERTS THE ONE THING NEITHER THE PROBE NOR THE RUN CAN: that the shelf
// the harness names, at the widths the harness runs, has a ceiling recorded for
// it. A rename, a typo, or a revert to the old width-keyed shape fails here in a
// second instead of passing quietly for fifty minutes.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `run-controls.sh` is the only harness `make
// controls` runs, and it passes `--fixture` and two `--width` flags. A run against
// a restored backup is a different shelf and carries its own numbers.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SHOTS = join(REPO, 'scripts', 'screenshots')

const baseline = JSON.parse(readFileSync(join(SHOTS, 'controls-baseline.json'), 'utf8'))
const harness = readFileSync(join(SHOTS, 'run-controls.sh'), 'utf8')

// The ratchet buckets `controls.mjs` records. Named here rather than derived, so
// dropping one from the probe fails this instead of shrinking what is checked.
const RATCHETS = ['small', 'labelled']

describe('the controls ratchet', () => {
  it('is keyed by the library first, not by the width', () => {
    // A TOP-LEVEL WIDTH IS THE OLD SHAPE. Every lookup would come back undefined
    // under it, which reads as "no baseline yet" — the gate off, with no failure.
    const numeric = Object.keys(baseline).filter((k) => /^\d+$/.test(k))
    expect(numeric, `${numeric.join(', ')} is a width at the top level, so every ceiling lookup misses and the ratchet stops judging`)
      .toEqual([])
    expect(Object.keys(baseline).length, 'no shelf has a recorded ceiling at all').toBeGreaterThan(0)
  })

  it('and every ceiling it records is a number a run can be over', () => {
    for (const [shelf, widths] of Object.entries(baseline)) {
      for (const [width, counts] of Object.entries(widths)) {
        expect(width, `${shelf} records a ceiling under "${width}", which is not a width`).toMatch(/^\d+$/)
        for (const k of RATCHETS) {
          expect(Number.isInteger(counts[k]), `${shelf} at ${width}px has no ${k} ceiling, so that bucket is not judged`).toBe(true)
          expect(counts[k], `${shelf} at ${width}px records a negative ${k} ceiling`).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('and the harness names a shelf that has one', () => {
    // `make controls` runs exactly this script, so its flags are the run.
    const named = [...harness.matchAll(/--fixture\s+([\w-]+)/g)].map((m) => m[1])
    expect(named.length, 'run-controls.sh names no fixture, so its run is compared to nothing').toBeGreaterThan(0)
    for (const shelf of new Set(named)) {
      expect(Object.keys(baseline), `run-controls.sh runs against "${shelf}", which has no ceiling recorded — the ratchet passes whatever it measures`)
        .toContain(shelf)
    }
  })

  it('and has a ceiling at every width the harness actually runs', () => {
    // THE HALF A RENAME LEAVES BEHIND. Adding a width to the script is cheap and
    // recording its ceiling is a fifty-minute run, so the two drift — and the new
    // width is the one nobody is watching.
    const shelf = /--fixture\s+([\w-]+)/.exec(harness)[1]
    const widths = [...harness.matchAll(/--width\s+(\d+)/g)].map((m) => m[1])
    expect(widths.length, 'run-controls.sh runs no width this test can see').toBeGreaterThan(1)
    for (const w of new Set(widths)) {
      expect(Object.keys(baseline[shelf]), `run-controls.sh runs ${shelf} at ${w}px and nothing is recorded there, so that width is measured against nothing`)
        .toContain(w)
    }
  })
})
