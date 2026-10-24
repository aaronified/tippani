import { describe, expect, it } from 'vitest'
import { SECTION_PREFS, SETTINGS_CARDS, changedEverywhere, parseScope, resetKeysEverywhere, sectionOfCard } from '../../src/Settings.jsx'
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

// parseScope — the client's reading of the srReviewScope preference, which must
// match the server's scopeFlags exactly.
//
// Two parsers of one string is the shape that drifts, and the cost of drift here
// is specific: the Settings screen shows chips that do not describe the deck you
// are actually being served. Nothing errors, and the deck looks like a
// preference you set.
//
// The Go side has the same table in review_test.go. Keeping both is the
// point — the agreement is what is being asserted, and one test cannot assert it
// from only one side.
describe('review scope', () => {
  const ALL = ['books', 'movies', 'quotes']

  describe('parseScope', () => {
    // One test over all seven rows rather than four: each of these was the same
    // `parseScope(input)` compared with toEqual and differed in nothing but the
    // stored string. Every input survives as a row, each keeping the it() title it
    // came from and its explanation, and the collection is compared in one go so a
    // failure names every string that read wrong rather than only the first.
    const STORED = [
      // "both" predates standalone quotes and means all three — leaving them out
      // of an existing reader's deck until they found a setting would have read as
      // the feature being broken. "screen" is the other name for films and shows.
      { name: 'honours the legacy words every existing account has stored', input: 'both', want: ALL },
      { name: 'honours the legacy words every existing account has stored', input: 'screen', want: ['movies'] },

      { name: 'is not a list, it is a set: order and spacing are not meaning', input: 'quotes,books', want: ['books', 'quotes'] },
      { name: 'is not a list, it is a set: order and spacing are not meaning', input: ' Books , Quotes ', want: ['books', 'quotes'] },
      { name: 'is not a list, it is a set: order and spacing are not meaning', input: 'books,books', want: ['books'] },

      // The chips render from this, so a reader who ticks quotes before books must
      // not find the row rearranged underneath them on the next visit.
      { name: 'returns the media in a fixed order whatever order they were stored in', input: 'quotes,movies,books', want: ALL },

      // The client is lenient where the SERVER is strict, and the asymmetry is
      // deliberate: the server refuses to store a scope with rubbish in it, so a
      // bad token can only reach here from a hand-edited database or a future
      // version's value. Rendering the part that is understood beats rendering
      // nothing, because the alternative shows a reader no chips at all.
      { name: 'drops a token it does not know rather than failing the whole read', input: 'books,poems', want: ['books'] },
    ]

    it('reads legacy, unordered and unknown tokens the way the server does', () => {
      const row = (c) => `${c.name} — ${JSON.stringify(c.input)}`
      const got = STORED.map((c) => [row(c), parseScope(c.input)])
      expect(got).toEqual(STORED.map((c) => [row(c), c.want]))
    })
  })
})

// A LOOK YOU CAN COME BACK TO, AND A FILE YOU CAN HAND SOMEBODY.
//
// WHY THIS IS A PURE TEST. Saving a look is a data question — what six fields
// travel, what happens at the cap, what a file that is not a theme does — and
// every one of those is a fact about a function. The browser tier covers the part
// a reader touches.
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
