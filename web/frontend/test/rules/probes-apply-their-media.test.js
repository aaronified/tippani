// EVERY BROWSER PROBE ASKS CHROME FOR THE MEDIA IT CAPTURES IN, AND INSTALLS THE
// NO-MOTION STYLESHEET IT MEANT TO.
//
// THE DEFECT, fixed by hand three times and missed each time. A probe in
// scripts/screenshots that launches Chrome and never calls emulateEngineMedia runs
// in Chrome's default light scheme with motion on, whatever theme it asked for:
// launchOptions sets the theme for Firefox only. 20ef10a4 fixed three probes,
// 9b2d67b2 four more, and 07b6abdc a fifth that both had missed. The same sweeps
// found four probes passing `noMotionScript` to evaluateOnNewDocument uncalled,
// which installs nothing, because the factory returns the script rather than
// running it (5bf5558e). Neither shows in a picture as a failure: the capture is
// simply in the wrong scheme, or moving.
//
// THE RULE: a probe that opens a page (`findBrowser(` and `newPage(`) calls
// `emulateEngineMedia(`, unless it is named below with its reason; and no probe
// passes `noMotionScript` without calling it. The stylesheet itself is not
// required, because some probes measure motion and need it on.
//
// WHAT IT KNOWS, declared: the source text of scripts/screenshots/*.mjs and three
// names in it (findBrowser, emulateEngineMedia, noMotionScript). A probe run in a
// browser would answer only for itself, and only on a machine with the app built.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(process.env.TIPPANI_SRC, '..', '..', '..', 'scripts', 'screenshots')

// Named, with the reason, so an exemption is a decision someone can read.
const EXEMPT = {
  'capture.mjs': 'the library that defines findBrowser and emulateEngineMedia; its own capture path emulates',
  'seed-cast.mjs': 'seeds a cast through the API and captures nothing, so no scheme can reach a picture',
  'glass-cost.mjs': 'must keep motion ON: lensAllowed refuses the lens under reduced motion, so it emulates the scheme alone',
}

const probes = readdirSync(DIR).filter((f) => f.endsWith('.mjs'))
const source = (f) => readFileSync(join(DIR, f), 'utf8')

describe('browser probes', () => {
  it('each one that opens a page applies the engine media, or is exempt by name', () => {
    const opening = probes.filter((f) => /findBrowser\(/.test(source(f)) && /newPage\(/.test(source(f)))
    expect(opening.length, 'the scan found no probe that opens a page; the pattern has gone stale').toBeGreaterThan(10)
    const missing = opening.filter((f) => !EXEMPT[f] && !/emulateEngineMedia\(/.test(source(f)))
    expect(missing, 'these probes launch Chrome and never ask it for their scheme and reduced motion').toEqual([])
  })

  it('names only probes that exist in its exemptions', () => {
    for (const f of Object.keys(EXEMPT)) expect(probes, `EXEMPT names ${f}, which is not in scripts/screenshots`).toContain(f)
  })

  it('never passes noMotionScript uncalled, which installs nothing', () => {
    const uncalled = probes.filter((f) => /noMotionScript\s*[),]/.test(source(f).replace(/import[^;\n]*noMotionScript[^;\n]*/g, '')))
    expect(uncalled, 'these pass the factory instead of noMotionScript(NO_MOTION_CSS)').toEqual([])
  })
})
