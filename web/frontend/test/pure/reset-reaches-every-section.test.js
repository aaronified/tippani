// WHAT A WHOLE-SCREEN RESET COUNTS AND WHAT IT CLEARS — the two pure functions
// behind the ⋯ menu's Reset settings row, checked without mounting anything.
//
// WHY THESE ARE THE OBSERVABLE UNIT, which is the exception this directory's
// header asks for. Both answers are arithmetic over the section map: how many
// preferences a reader has set across every section, and which keys a reset names.
// The screen's job is to draw the first and post the second, and a journey drives
// exactly that — `resetting-every-section.journey.mjs` presses the row and checks
// the ground comes back. What a journey cannot do is ask the questions BELOW that
// press: whether a section was left out of the sweep, whether a key is named twice,
// whether the count double-counts. Those are questions about a set, and the set is
// the function.
//
// THE MUTATIONS, and each was run: make `changedEverywhere` read one section
// instead of summing (the theme case goes from 1 to 0 for a lang-only change);
// drop the `new Set` from `resetKeysEverywhere` (the duplicate case goes red);
// hand `changedEverywhere` a `{}` where a key holds its own default (the
// stock-account case reads above zero).

import { describe, expect, it } from 'vitest'

import PREF_DEFAULTS from '../../src/prefDefaults.json'
import { SECTION_PREFS, changedEverywhere, resetKeysEverywhere } from '../../src/Settings.jsx'

describe('what a reset names', () => {
  it('names every key some section claims', () => {
    const keys = resetKeysEverywhere()
    for (const [section, own] of Object.entries(SECTION_PREFS)) {
      for (const k of own) {
        expect(keys, `${k} is in ${section} but no reset would clear it`).toContain(k)
      }
    }
  })
})

describe('what a reset offers to undo', () => {
  it('counts a change in any section, not just the first', () => {
    // Summed across sections rather than read off one, which is the whole
    // difference between this and `changedIn`. Every section gets its own case:
    // a sweep that skipped one would leave a reader's changes uncounted there and
    // the row unoffered, on a screen where their setting plainly differs.
    for (const [section, own] of Object.entries(SECTION_PREFS)) {
      const k = own.find((key) => key in PREF_DEFAULTS)
      if (!k) continue
      const moved = typeof PREF_DEFAULTS[k] === 'boolean'
        ? !PREF_DEFAULTS[k]
        : typeof PREF_DEFAULTS[k] === 'number'
          ? PREF_DEFAULTS[k] + 1
          : `${PREF_DEFAULTS[k]}-moved`
      expect(
        changedEverywhere({ ...PREF_DEFAULTS, [k]: moved }),
        `a change to ${k} in ${section} was not counted`,
      ).toBe(1)
    }
  })
})
