// EVERY TOKEN, IN EVERY LANGUAGE. The standing rule, as a test.
//
// The rule, in the owner's words: whatever gets built from now on carries tokens,
// and the tokens carry English AND Bengali. Both, in the same commit as the
// feature. This file is what makes that a build failure rather than an intention,
// and it was written because nothing enforced it — a key added to en.txt and
// forgotten in bn.txt cost nothing at all. `npm test` stayed green, `locale-shadow`
// stayed green, the pseudo-locale gate stayed green (it reads the English), and the
// only symptom was an English sentence in the middle of a Bengali screen, which is
// exactly what the reader who chose Bengali is least able to report as a bug.
//
// WHAT WAS ALREADY COVERED, so this file adds a dimension rather than a second
// opinion:
//
//   locale-complete.test.js  code ↔ en.txt, both directions. One language.
//   locale-resolve.test.js   the arithmetic of coverage(), on synthetic files.
//   help-budget / infodot    how LONG a string is, in whichever files carry it.
//   screens-i18n.test.jsx    that a screen has no untokenised English left in it.
//
// None of them looks across the languages. This one does: it takes the token set
// the codebase asks for and measures EVERY language against it — the two compiled
// into the binary, and the ones an operator drops into data/Locales.
//
// THE TWO KINDS OF LANGUAGE ARE HELD TO DIFFERENT STANDARDS, on purpose, and the
// difference is not a compromise:
//
//   A COMPILED-IN LANGUAGE IS PART OF THE PRODUCT. en.txt and bn.txt ship inside
//   the binary; nobody chose to install them and nobody can fix them but us. Both
//   must carry every token, and that is asserted here.
//
//   A CONFIG LANGUAGE IS SOMEBODY ELSE'S WORK IN PROGRESS. Design §7 forbids a
//   test that fails because a language is incomplete — the picker shows a
//   percentage instead — and a half-finished fr.txt on an operator's disk is the
//   normal, supported state of that feature. So nothing here demands anything of
//   it. What is asserted is that the NUMBER it gets is honest, which §7 cares
//   about far more: coverage divides by fullKeys(), so one dead string in a
//   shipped file silently caps every translator in the world below 100%.
//
// WHY REQUIRING BOTH BUILT-INS IS SAFE RATHER THAN BRITTLE. The denominator is the
// UNION of the compiled-in files (i18n.js, FULL_KEY_SET) — deliberately symmetric,
// so neither language is the source and neither is measured against the other. A
// key in one and not the other therefore shows up as a hole in whichever file
// lacks it, whichever way round the omission happened. The gate below is that
// arithmetic, read out loud at the moment of the edit instead of two releases
// later in a picker nobody looked at.
//
// PLURALS ARE PER LANGUAGE, and this is the one place a language may legitimately
// hold fewer strings. `t('unit.book', {count: n})` resolves through
// Intl.PluralRules for the ACTIVE language: English and Bengali select `one` and
// `other`, Japanese selects only `other`, Polish four. So a form is required of a
// language only if that language's own rules can ever select it — asked of Intl,
// the same way the resolver asks it, rather than written down here.

import { beforeEach, describe, expect, it } from 'vitest'
import { BUILTINS } from '../locale-file.js'
import { PLURALS, SRC_KEYS, familyOf, used } from '../token-scan.js'
import {
  BUILTIN_CODES,
  coverage,
  coveragePercent,
  ensureBuiltins,
  fullKeys,
  resetLocaleForTests,
  setLocaleFiles,
} from '../../src/i18n.js'

// AWAITED FIRST, AND THE WHOLE FILE DEPENDS ON IT. Only English is compiled into
// the bundle now; Bengali is a chunk that loads on demand (see i18n.js). So
// fullKeys() before this line is the union over ONE language, and the union is the
// entire point here — the case this file exists to catch is a key that is in
// bn.txt and nowhere else, which an en-only token set cannot see. The suite stayed
// green when that protection was removed, because today the two files happen to
// agree; that is exactly the shape of silence this file was written about.
await ensureBuiltins()

// THE TOKEN SET. fullKeys() is what the app divides by, so it is what a coverage
// test has to measure against — using anything else would test a number the app
// never shows. That it is also exactly what the codebase asks for is the first
// thing asserted below, in both directions; without those two, every percentage in
// this file would be a percentage of the wrong set.
const TOKENS = fullKeys()

// The forms a language can actually select, asked of Intl rather than listed.
// A code Intl has never heard of falls through to the resolver's own two-form
// guess (see pluralCategory in i18n.js), so the test demands what the app would
// look for.
function categoriesFor(code) {
  try {
    return new Set(new Intl.PluralRules(code).resolvedOptions().pluralCategories)
  } catch {
    return new Set(['one', 'other'])
  }
}

// requiredOf is the token set as one language owes it: every token, minus the
// plural forms that language's grammar never reaches.
function requiredOf(code) {
  const cats = categoriesFor(code)
  return TOKENS.filter((key) => {
    const family = familyOf(key)
    return family ? cats.has(key.slice(family.length + 1)) : true
  })
}

// The placeholders in a value: `{n}`, `{title}`, `{count}`. Order does not matter
// — Bengali puts the number where Bengali puts the number — but the SET does.
const holesIn = (value) => [...new Set(value.match(/\{[a-zA-Z0-9_]+\}/g) || [])].sort()

describe('the token set is the codebase’s, not the file’s', () => {
  // Everything below divides by TOKENS, and a TOKENS that has drifted from what
  // the code renders makes every percentage in this file a lie about a different
  // set. Both directions, because they fail differently: a token the files lack is
  // a stub on screen, and a key nothing renders is a permanent tax on every
  // translation.
  it('holds every key the code hands to t() literally', () => {
    const absent = []
    for (const [key, where] of SRC_KEYS.asked) {
      if (TOKENS.includes(key)) continue
      if (PLURALS.some((c) => TOKENS.includes(`${key}.${c}`))) continue
      absent.push(`${key}  (${where})`)
    }
    expect(absent.sort(), 'asked for by the code and in no shipped language').toEqual([])
  })

  it('and nothing the code never asks for', () => {
    // The same sweep locale-complete runs against en.txt, run here against the
    // UNION — which is the set that actually gets divided by, and which en.txt
    // alone cannot account for: a key in bn.txt and nowhere else passes that test
    // and still inflates this one.
    const orphans = TOKENS.filter((k) => !used(k))
    expect(orphans.sort(), 'dead copy in a shipped language: it caps every translator below 100%').toEqual([])
  })

  it('and no plural form its own language would never select', () => {
    // A `.few` in a file whose language has no `few` is dead copy of the one shape
    // the gate below cannot see, because that gate excuses a language the forms it
    // does not need. It would sit in the union forever, uncounted and undeletable.
    const stray = []
    for (const [code, file] of BUILTINS) {
      const cats = categoriesFor(code)
      for (const key of Object.keys(file.keys)) {
        const family = familyOf(key)
        if (family && !cats.has(key.slice(family.length + 1))) stray.push(`${code}: ${key}`)
      }
    }
    expect(stray.sort()).toEqual([])
  })

  it('is big enough that the scan plainly ran', () => {
    // A floor, not a count. An extraction that matched nothing would report every
    // language at a serene 100% of zero keys.
    expect(TOKENS.length).toBeGreaterThan(3000)
  })
})

describe('every language in the box carries every token', () => {
  // THE GATE. Driven off BUILTINS rather than a written-down pair, so a third
  // compiled-in language is held to this the moment it is added — which is the
  // point at which "we ship complete languages" is worth having as a fact.
  it('ships both, which is what makes the list worth iterating', () => {
    expect(BUILTINS.map(([code]) => code)).toEqual(BUILTIN_CODES)
  })

  for (const [code, file] of BUILTINS) {
    it(`internal/i18n/${code}.txt is complete`, () => {
      const missing = requiredOf(code).filter((key) => !file.keys[key])
      expect(
        missing.sort(),
        `${missing.length} token(s) have no ${code}. Add them to internal/i18n/${code}.txt — ` +
          'a shipped language is not allowed to be a work in progress',
      ).toEqual([])
    })

    it(`internal/i18n/${code}.txt has no line the parser could not read`, () => {
      // A mangled line costs exactly its own string (§5) and is invisible to the
      // count above, because the key it was meant to define never existed.
      expect(file.bad, `unparseable line numbers in ${code}.txt`).toEqual([])
      expect(file.empty, `keys with nothing after the = in ${code}.txt`).toEqual([])
    })
  }

  it('and says the same thing with the same holes in it', () => {
    // Coverage counts strings, not usable ones. `{n} quotes` translated without
    // its {n} is present, counted, and renders a sentence with the number missing
    // — and the number is usually the reason the sentence exists. Compared across
    // the built-ins rather than against English: the failure is that two files
    // disagree, and neither one of them is the original.
    const mismatched = []
    for (const key of TOKENS) {
      let expected = null
      let from = ''
      for (const [code, file] of BUILTINS) {
        const value = file.keys[key]
        if (!value) continue // absent is the gate above's business, not this one's
        const holes = holesIn(value)
        if (expected === null) {
          expected = holes
          from = code
          continue
        }
        if (holes.join(',') !== expected.join(',')) {
          mismatched.push(`${key}: ${from} has ${expected.join(' ') || 'none'}, ${code} has ${holes.join(' ') || 'none'}`)
        }
      }
    }
    expect(mismatched.sort(), 'a placeholder lost in translation renders a sentence with a hole in it').toEqual([])
  })
})

describe('a language from data/Locales is scored against that same set', () => {
  // Config languages, through the real door: setLocaleFiles is what
  // loadLocaleFiles hands GET /locales to, so what runs here is the path an
  // operator's fr.txt takes. Nothing below asserts that any such language is
  // complete — §7 — only that the number beside it in the picker means what it
  // says.
  const file = (keys) => ({ keys, reserved: {}, empty: [], bad: [] })

  beforeEach(() => {
    resetLocaleForTests()
  })

  it('reports 100 only for a file that carries all of them', () => {
    setLocaleFiles({ fr: file(Object.fromEntries(TOKENS.map((k) => [k, 'x']))) })
    expect(coverage('fr')).toBe(100)
  })

  it('and 99, not 100, for one token short', () => {
    const all = Object.fromEntries(TOKENS.map((k) => [k, 'x']))
    delete all[TOKENS[0]]
    setLocaleFiles({ fr: file(all) })
    // Floored, never rounded: 3221 of 3222 is not a finished language.
    expect(coverage('fr')).toBe(coveragePercent(TOKENS.length - 1, TOKENS.length))
    expect(coverage('fr')).toBeLessThan(100)
  })

  it('and counts nothing for keys the app does not render', () => {
    // The other half of §7's honesty. A file can carry a thousand strings of its
    // own invention — an older release's keys, a fork's, a typo — and its
    // percentage must not move, or the number measures the file against itself.
    const invented = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [`nobody.asked.for.this.${i}`, 'x']),
    )
    setLocaleFiles({ fr: file(invented) })
    expect(coverage('fr')).toBe(0)

    setLocaleFiles({
      fr: file({ ...Object.fromEntries(TOKENS.map((k) => [k, 'x'])), ...invented }),
    })
    expect(coverage('fr')).toBe(100)
  })
})
