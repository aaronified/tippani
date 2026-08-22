// The code and the file say the same thing, in both directions.
//
// Design §1 puts every user-facing string in a locale file and leaves the source
// holding keys. That splits one fact across two places, and the two failure modes
// are silent in opposite ways:
//
//   A KEY THE CODE ASKS FOR AND THE FILE DOES NOT HAVE renders a humanised last
//   segment (i18n.js's placeholderFor) and a console.warn nobody is watching. The
//   button says "Label" and the app looks finished.
//
//   A KEY THE FILE HAS AND NOTHING ASKS FOR is dead copy. Worse than merely
//   useless: FULL_KEY_SET is the union of the built-ins, so a string nothing
//   renders still counts against every language's coverage — and design §7 says a
//   percentage that lies is worse than none. Thirty-seven such keys were deleted
//   when this test was written, all of them shared vocabulary published ahead of
//   the screens that will use it.
//
// So this is the test the mechanism cannot write for itself. i18n.js knows what it
// was asked for at runtime; only a scan of the tree knows what the tree asks for.
//
// THE SCAN ITSELF IS test/token-scan.js — what counts as a key, how a key held in
// a table or built from a stem is reached, and why a plural family is one entry.
// It moved out of this file when token-coverage.test.js started needing the same
// answer; the reasoning is in its header.
//
// THIS FILE IS ONE AXIS OF TWO. It measures the code against the English, which is
// where a key is born. token-coverage.test.js takes the token set this produces
// and measures every LANGUAGE against it, including the ones an operator drops
// into data/Locales. Neither implies the other: en.txt can be complete and correct
// while bn.txt is missing half of it, which is exactly the hole that test fills.

import { describe, expect, it } from 'vitest'
import { EN, enKeys } from '../locale-file.js'
import { PLURALS, SRC_KEYS, used } from '../token-scan.js'

describe('the scan reaches the tree at all', () => {
  // Every assertion below is only as good as the extraction, and an extraction
  // that matches nothing passes both directions in silence. Floors, not exact
  // numbers: the migration adds call sites weekly.
  it('finds the call sites', () => {
    expect(SRC_KEYS.asked.size).toBeGreaterThan(1000)
    expect(SRC_KEYS.literals.size).toBeGreaterThan(1000)
  })

  it('finds the templates, which are how a third of the help panel is reached', () => {
    // `${base}.term` in help.jsx and `${stem}.min` in secret.js. Without these the
    // orphan half of this test would condemn 465 real keys.
    expect(SRC_KEYS.tails.map((x) => x.t)).toContain('.term')
    expect(SRC_KEYS.tails.map((x) => x.t)).toContain('.min')
    expect(SRC_KEYS.globs.length).toBeGreaterThan(0)
  })

  it('reads a file at all, and the file has the shape it should', () => {
    expect(enKeys().length).toBeGreaterThan(2000)
    expect(EN.bad, 'mangled lines in en.txt').toEqual([])
    expect(EN.empty, 'keys with nothing after the = ').toEqual([])
  })
})

describe('every key the code asks for is in en.txt', () => {
  it('resolves, or renders a humanised stub nobody wrote', () => {
    const missing = []
    for (const [key, where] of SRC_KEYS.asked) {
      if (EN.keys[key]) continue
      // t(key, {count}) asks for a family, and the family answers.
      if (PLURALS.some((c) => EN.keys[`${key}.${c}`])) continue
      missing.push(`${key}  (${where})`)
    }
    expect(missing.sort(), 'add these to internal/i18n/en.txt').toEqual([])
  })

  it('and so does every leaf secret.js appends to a stem', () => {
    // secretProblem() builds `${stem}.min` / `.max` / `.charset`, so a stem short
    // of one renders "Charset" in a validation field. The two stems are named here
    // rather than derived, because "every stem × every tail" is not a rule: the
    // stems in bulkOps.jsx take `.one` and would never take `.charset`. help.jsx's
    // 167 stems are checked the same way by help-budget.test.js, against the
    // registry that declares which fields each row actually has.
    const missing = []
    for (const stem of ['error.validate.password', 'error.validate.passphrase']) {
      for (const role of ['min', 'max', 'charset']) {
        if (!EN.keys[`${stem}.${role}`]) missing.push(`${stem}.${role}`)
      }
    }
    expect(missing).toEqual([])
  })
})

describe('every key in en.txt is asked for by the code', () => {
  it('is reachable from somewhere in src/', () => {
    const orphans = enKeys().filter((k) => !used(k))
    expect(
      orphans.sort(),
      'dead copy: nothing renders these, and they still count against every language’s coverage',
    ).toEqual([])
  })

  it('including the three the mechanism resolves itself', () => {
    // locale.pseudo.name is read by i18n.js rather than by a screen, and the
    // picker's own two rows by locale.jsx. They are the keys most likely to be
    // condemned by a scan that skips the resolver's own module, so they are named.
    for (const key of ['locale.pseudo.name', 'locale.picker.coverage', 'locale.picker.aria']) {
      expect(used(key), `${key} is not reached`).toBe(true)
    }
  })
})
