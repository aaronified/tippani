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

import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SHOTS = join(REPO, 'scripts', 'screenshots')

// BY ABSOLUTE URL, because the probe lives outside the frontend's Vite root and a
// relative specifier would be resolved against it. Same file the probe imports —
// a copy of the arithmetic here would be a test of the copy.
const { SLACK, canRecord, exitCode, failing, judge } = await import(pathToFileURL(join(SHOTS, 'ratchet.mjs')).href)

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

  it('and refuses to run at all without being told which one it is against', () => {
    // THE HOLE THIS CLOSES was on the one path that measures the app.
    // `run-with-backup.sh` passes `"$@"` straight through, so a backup run carried
    // `--fixture` only if a person typed the line in CLAUDE.md from memory — and
    // without it the probe compares its counts to nothing and exits 0, which is
    // precisely the silence the per-library key was introduced to end.
    //
    // A REFUSAL RATHER THAN A WARNING, because the run is fifty minutes long and
    // its last line is where a warning would go. Asked by RUNNING it: a check that
    // reads the source for the words would pass on a refusal that never fires.
    //
    // AND EXIT 2 EXACTLY, not merely non-zero. The first draft of this case
    // asserted `not.toBe(0)` and a mention of `--fixture` in the output, and it
    // PASSED with the refusal deleted: a probe with nowhere to connect exits 1 and
    // prints "no baseline for (unnamed) … run with --fixture", which is the silent
    // failure itself wearing the words of the fix. So 2 is reserved for this
    // refusal, and the case below proves nothing else claims it.
    const dead = ['--base-url', 'http://127.0.0.1:1', '--width', '390']
    const run = spawnSync(process.execPath, [join(SHOTS, 'controls.mjs'), ...dead], { encoding: 'utf8' })
    expect(run.status, 'the probe ran without being told which library it is against, so its ratchet was off').toBe(2)
    expect(`${run.stderr}${run.stdout}`, 'it refused without saying what to pass').toMatch(/--fixture/)

    // 2 MEANS THIS AND ONLY THIS. Given a shelf, the same unreachable server is a
    // different failure — so the code above cannot be an accident of the run
    // falling over for some other reason.
    const named = spawnSync(process.execPath, [join(SHOTS, 'controls.mjs'), ...dead, '--fixture', 'seed'], { encoding: 'utf8' })
    expect(named.status, 'exit 2 is not reserved for the refusal — a run that named its shelf produced it too').not.toBe(2)

    // And it still answers for itself, so the refusal has not eaten the one
    // invocation that must work without a library at all.
    const help = spawnSync(process.execPath, [join(SHOTS, 'controls.mjs'), '--help'], { encoding: 'utf8' })
    expect(help.status, '--help no longer works').toBe(0)
  })

  it('and judges both directions — a count that rose, and a ceiling left behind', () => {
    // THE ARITHMETIC, ASKED IN A MILLISECOND. It used to live inside the probe,
    // after a browser walk of thirty surfaces, so the only way to ask whether the
    // rule was right was to spend an hour producing an input for it — which is
    // how it went wrong twice without anyone noticing.
    const at = (counts, bar) => Object.fromEntries(judge(counts, bar).map((r) => [r.k, r.state]))

    expect(at({ small: 187 }, { small: 187 }), 'the measured number equalling its ceiling is not a failure')
      .toEqual({ small: 'ok' })
    expect(at({ small: 188 }, { small: 187 }), 'one more than the ceiling passed — the number may fall and never rise')
      .toEqual({ small: 'rose' })
    expect(at({ small: 187 - SLACK }, { small: 187 }), 'a fall inside the allowance is not a failure')
      .toEqual({ small: 'ok' })

    // THE HALF THAT IS NOT OBVIOUS, and the half that let 139 controls of room sit
    // unnoticed: the thing got BETTER and the ceiling did not move, so the gate
    // now has space in it and the next regression that size passes unseen. An
    // improvement that is not written down is bought back by the next commit.
    expect(at({ small: 187 - SLACK - 1 }, { small: 187 }), 'a ceiling the app has left far behind passed — that room is what the next regression spends')
      .toEqual({ small: 'slack' })
    expect(at({ small: 48 }, { small: 187 }), 'a ceiling from another library passed — this is the exact 139 that went unnoticed')
      .toEqual({ small: 'slack' })

    // AND A MISSING CEILING IS STILL NOT A REGRESSION. There is nothing to have
    // risen from, and failing here is how a ratchet gets deleted rather than
    // filled in. Loud, every run, until somebody records it — but not a failure.
    expect(at({ small: 187 }, {}), 'a width nobody has recorded is judged as if it had').toEqual({ small: 'unrecorded' })
    expect(failing(judge({ small: 187 }, {})), 'an unrecorded ceiling fails the run, so the ratchet gets deleted rather than filled in').toEqual([])
  })

  it('and a run whose ratchet was never judged does not report success', () => {
    // 0 SAYS "THIS WIDTH IS GUARDED", and an unrecorded ceiling means it is not.
    // Failing (1) would make a width nobody has recorded impossible to run, which
    // is how a ratchet gets deleted rather than filled in; 3 is the difference —
    // the app came back clean AND nothing was compared to anything.
    const rows = (counts, bar) => judge(counts, bar)
    expect(exitCode(false, rows({ small: 187 }, { small: 187 })), 'a clean, ratcheted run is not 0').toBe(0)
    expect(exitCode(false, rows({ small: 187 }, {})), 'an unratcheted run reported success').toBe(3)
    expect(exitCode(true, rows({ small: 187 }, { small: 187 })), 'a dead control did not fail the run').toBe(1)
    expect(exitCode(false, rows({ small: 188 }, { small: 187 })), 'a risen count did not fail the run').toBe(1)
    // A REAL FAILURE OUTRANKS AN UNRECORDED ONE. Otherwise a width with no ceiling
    // downgrades a dead control to "clean but unmeasured".
    expect(exitCode(true, rows({ small: 187 }, {})), 'a dead control was downgraded by a missing ceiling').toBe(1)
  })

  it('and refuses a shelf it has never heard of, before the browser starts', () => {
    // `--fixture bakcup` measured thirty surfaces against nothing and said `ok`,
    // because a typo yields no ceiling and no ceiling is not a failure — the same
    // silence one letter further on. The first version of the check sat beside the
    // baseline at the foot of the file, so the typo still cost fifty minutes.
    const dead = ['--base-url', 'http://127.0.0.1:1', '--width', '390']
    const typo = spawnSync(process.execPath, [join(SHOTS, 'controls.mjs'), ...dead, '--fixture', 'bakcup'], { encoding: 'utf8' })
    expect(typo.status, 'a shelf with no ceiling ran anyway').toBe(2)
    expect(`${typo.stderr}${typo.stdout}`, 'it refused without naming the shelves it knows').toMatch(/seed/)
    expect(typo.stdout, 'it walked the app before deciding the shelf was a typo').not.toMatch(/presses/)

    // And recording a NEW shelf is still possible, or a first run could never
    // happen and the ratchet could only ever shrink.
    //
    // AGAINST A COPY, NOT AGAINST THE REPOSITORY. This case used to write a shelf
    // called `bakcup` into the committed baseline; the no-record rule stopped
    // that, and then a mutation that disabled the rule wrote it again — a test
    // that only stays clean while the thing it tests works. `--baseline` points
    // the probe at a temp file, so the case cannot dirty the tree whatever it
    // finds, and it can assert the no-record rule directly.
    const copy = join(tmpdir(), `controls-baseline-${process.pid}.json`)
    copyFileSync(join(SHOTS, 'controls-baseline.json'), copy)
    try {
      const fresh = spawnSync(process.execPath,
        [join(SHOTS, 'controls.mjs'), ...dead, '--fixture', 'bakcup', '--update-baseline', '--baseline', copy], { encoding: 'utf8' })
      expect(fresh.status, 'a new shelf cannot be recorded, so the ratchet can only ever shrink').not.toBe(2)
      expect(readFileSync(copy, 'utf8'), 'a run that measured nothing recorded a ceiling anyway').not.toMatch(/bakcup/)
    } finally {
      rmSync(copy, { force: true })
    }
    expect(readFileSync(join(SHOTS, 'controls-baseline.json'), 'utf8'), 'the test wrote to the committed baseline')
      .not.toMatch(/bakcup/)
  })

  it('and records a ceiling only from a run that looked at the whole app', () => {
    // TWO WAYS TO MEASURE LESS THAN THERE IS, and both used to write anyway.
    expect(canRecord({ blanks: 0, walked: 15, total: 15 }), 'a complete clean run cannot record').toBe(true)
    expect(canRecord({ blanks: 1, walked: 15, total: 15 }), 'a run with a surface that did not render recorded anyway — that count is a floor of the harness').toBe(false)
    // `--only home --update-baseline` has NO blanks: it looked at one screen,
    // found nothing wrong, and wrote that over a ceiling of 187.
    expect(canRecord({ blanks: 0, walked: 1, total: 15 }), 'a run that skipped fourteen surfaces recorded the app’s ceiling').toBe(false)
    expect(canRecord({ blanks: 0, walked: 0, total: 0 }), 'a run that walked nothing at all recorded a ceiling of nothing').toBe(false)
  })

  it('and every bucket it records is one the probe still counts', () => {
    // AN ORPHANED CEILING IS A BUCKET NOBODY IS WATCHING. Rename a ratchet in the
    // probe and its old ceiling sits in this file for ever, judging nothing, while
    // the new bucket has none and is loud but unfailing.
    for (const [shelf, widths] of Object.entries(baseline)) {
      for (const [width, counts] of Object.entries(widths)) {
        expect(Object.keys(counts).sort(), `${shelf} at ${width}px records ${Object.keys(counts).sort().join(', ')}; the probe counts ${RATCHETS.slice().sort().join(', ')}`)
          .toEqual(RATCHETS.slice().sort())
      }
    }
  })

  it('and the harness reports the probe’s code instead of flattening it', () => {
    // `run-controls.sh` ran each width with `|| rc=1`, so 2 (a refusal) and 3 (an
    // unratcheted width) both arrived as 1 — the exit-3 rule could be written,
    // tested and documented while nothing that runs the probe could ever report
    // one.
    //
    // THE SCRIPT'S OWN TAIL IS RUN, with the probe stubbed. An earlier draft
    // evaluated only its `worst()` helper, and changing one call site back to
    // `|| rc=1` left that green — a test of a helper nothing had to call. And the
    // stub answers ONE WIDTH at a time: a stub returning 3 for both hides a broken
    // call site behind the working one, which is how the first version of THAT
    // repair passed too. Both files rather than a `bash -c` string, because built
    // as one it came back 2 — a quoting bug wearing a failing assertion's clothes.
    const tail = /\nrc=0\n[\s\S]*?\nexit "\$rc"\n/.exec(harness)
    expect(tail, 'run-controls.sh no longer ends in the exit block this reads').toBeTruthy()
    const stub = join(tmpdir(), `controls-stub-${process.pid}.sh`)
    const probe = join(tmpdir(), `controls-probe-${process.pid}.sh`)
    const codeFor = (width, code) => {
      writeFileSync(stub, `#!/bin/sh\ncase "$*" in *${width}*) exit ${code};; *) exit 0;; esac\n`)
      chmodSync(stub, 0o755)
      writeFileSync(probe, `RUN=("${stub}")\n${tail[0]}`)
      return spawnSync('bash', [probe], { encoding: 'utf8' }).status
    }
    try {
      for (const width of [1280, 390]) {
        expect(codeFor(width, 3), `an unratcheted ${width} came back as an ordinary failure`).toBe(3)
        expect(codeFor(width, 2), `a refusal at ${width} came back as an ordinary failure`).toBe(2)
        expect(codeFor(width, 1), `a real failure at ${width} is no longer 1`).toBe(1)
      }
      expect(codeFor(1280, 0), 'a clean run is not 0').toBe(0)
    } finally {
      rmSync(stub, { force: true })
      rmSync(probe, { force: true })
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
