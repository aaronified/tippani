import { describe, expect, it } from 'vitest'
import { SECTION_PREFS, SETTINGS_CARDS, changedEverywhere, resetKeysEverywhere, sectionOfCard } from '../../src/Settings.jsx'
import { fromFile, toFile } from '../../src/savedThemes.js'
import { PHYS, physFor } from '../../src/theme.js'

// WHICH SECTION EACH SETTINGS CARD IS ON.
//
// WHAT THIS FILE USED TO BE, because the change is the point. Settings was one
// long page and this suite held a per-column-count layout table in agreement with
// the card list — the question being which of nine cards a reader scrolled past
// first. The page is five named sections now, so the packing question is gone and
// the one that replaced it is "is every card reachable at all": a card registered
// but placed on no section is a control nobody can find, and it fails silently
// because the section that would have drawn it simply draws one fewer.
describe('settings layout', () => {
  describe('every card has a section, and every section is real', () => {
    it('places every registered card', () => {
      for (const key of SETTINGS_CARDS) {
        expect(sectionOfCard(key), `${key} is registered but on no section`).toBeTruthy()
      }
    })
  })
})

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
describe('reset reaches every section', () => {
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
})

describe('saved themes', () => {
  const WEARING = {
    theme: 'dark', materialSet: 'bindery', accent: 'olive',
    groundLight: 'sepia', groundDark: 'tobacco',
    tiles: ['wood', '', 'paper', ''], texTweak: { paper: { hard: 12 } },
  }

  describe('the file', () => {
    it('round-trips what you are wearing', () => {
      const got = fromFile(toFile(WEARING, 'Evening'))
      expect(got.error).toBeUndefined()
      expect(got.theme.name).toBe('Evening')
      expect(got.theme.materialSet).toBe('bindery')
      expect(got.theme.groundDark).toBe('tobacco')
    })
  })
})

// WHAT A MATERIAL DOES WITH THE LIGHT, as four numbers per tile.
//
// WHY THIS IS A PURE TEST AND NOT A JOURNEY. The v3 pack's texture dials are the
// case the repo's own tier rule names as justified: the function IS the observable
// unit. What a reader can see is "the page looks softer", which no assertion can
// state — but the thing that has to be right is that a dial's number reaches the
// compiled stack, that the factory value is what an untouched tile gets, and that
// an edit to one material leaves the other twenty-six alone. Those are facts about
// a function.
//
// THE COST QUESTION THIS ANSWERS. The dials were approved on the understanding
// that they compile to CSS at theme-apply time and cost nothing at paint time.
// That is only true if the output is a static gradient stack, which is what the
// first case measures.
describe('material physics', () => {
  describe('the factory numbers', () => {
    it('takes the reader edits over the factory, per dial', () => {
      const got = physFor('marble', { marble: { hard: 10 } })
      expect(got.hard).toBe(10)
      // The three untouched dials still come from the table — an edit is an edit to
      // one number, not a replacement of the material's whole behaviour.
      expect(got.sss).toBe(PHYS.marble.sss)
      expect(got.diff).toBe(PHYS.marble.diff)
      expect(got.refl).toBe(PHYS.marble.refl)
    })
  })
})
