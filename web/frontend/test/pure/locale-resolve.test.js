// The resolver: the chain in design §8, the open preference in §4, the coverage
// number in §7, and the pseudo-locale in §9.
//
// Every test drives the module through setLocaleFiles — the same function
// loadLocaleFiles hands the server's answer to — so what is exercised is the real
// path and not a test-only door. resetLocaleForTests puts the module back between
// tests, because module state is shared across a file and a French file dropped in
// by one test would otherwise decide the next one's chain.

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  BUILTIN_CODES,
  DEFAULT_LOCALE,
  PSEUDO,
  applyLocale,
  coverage,
  coveragePercent,
  fullKeys,
  installedLocales,
  localeActive,
  localeCatalogue,
  localeChain,
  localeDir,
  localeMissing,
  localeName,
  localePref,
  normCode,
  placeholderFor,
  pseudoTransform,
  resetLocaleForTests,
  setLocaleFiles,
  t,
  tNodes,
} from '../../src/i18n.js'

// A locale file in the shape GET /locales answers with.
const file = (keys = {}, reserved = {}) => ({ keys, reserved, empty: [], bad: [] })

// A key that certainly exists in the compiled-in English, taken from the module
// rather than written down — the migration adds hundreds of these and a hardcoded
// one would rot.
const SOME_KEY = fullKeys()[0]

beforeEach(() => {
  resetLocaleForTests()
})

describe('the built-ins are enough on their own', () => {
  test('with no server, no session and no data directory, t() still answers', () => {
    // Design §3: a missing, empty or corrupted config directory cannot leave the
    // app with no text at all. Nothing has been loaded here and nothing has been
    // chosen.
    expect(localeActive()).toBe(DEFAULT_LOCALE)
    expect(t(SOME_KEY)).toBeTruthy()
    expect(t(SOME_KEY)).not.toBe(SOME_KEY) // never the key itself on screen
  })

  test('both ship in the box and neither is missing', () => {
    expect(BUILTIN_CODES).toEqual(['en', 'bn'])
    for (const code of BUILTIN_CODES) expect(localeName(code)).toBeTruthy()
  })

  test('an empty payload, a null payload and a missing route all leave it standing', () => {
    for (const payload of [null, undefined, {}]) {
      expect(setLocaleFiles(payload)).toBe(false) // nothing changed, so nothing re-renders
      expect(t(SOME_KEY)).toBeTruthy()
    }
  })
})

describe('a data-dir file overrides a compiled-in value', () => {
  test('for English', () => {
    setLocaleFiles({ en: file({ [SOME_KEY]: 'Overridden in the data dir' }) })
    applyLocale('en')
    expect(t(SOME_KEY)).toBe('Overridden in the data dir')
  })

  test('for Bengali, on exactly the same terms', () => {
    // Design §5 is explicit that this is symmetric — the override path privileges
    // nobody — so the interesting assertion is that bn behaves like en and not
    // that bn works at all.
    setLocaleFiles({ bn: file({ [SOME_KEY]: 'Bengali, from the data dir' }) })
    applyLocale('bn')
    expect(t(SOME_KEY)).toBe('Bengali, from the data dir')
  })

  test('per key, not per file — an untouched key keeps its compiled-in value', () => {
    const [first, second] = fullKeys()
    if (!second) return // only one key ships so far; the rule still holds
    setLocaleFiles({ en: file({ [first]: 'only this one' }) })
    applyLocale('en')
    expect(t(first)).toBe('only this one')
    expect(t(second)).toBeTruthy()
    expect(t(second)).not.toBe('only this one')
  })
})

describe('the fallback chain (§8)', () => {
  test('a new language appears and is choosable with no rebuild', () => {
    setLocaleFiles({ fr: file({ [SOME_KEY]: 'Langue' }, { _name: 'Français' }) })
    expect(installedLocales()).toContain('fr')
    applyLocale('fr')
    expect(localeActive()).toBe('fr')
    expect(localeName('fr')).toBe('Français')
    expect(t(SOME_KEY)).toBe('Langue')
  })

  test('a key the language lacks resolves through its declared _fallback first', () => {
    setLocaleFiles({
      fr: file({}, { _name: 'Français', _fallback: 'oc' }),
      oc: file({ [SOME_KEY]: 'from Occitan' }, { _name: 'Occitan' }),
    })
    applyLocale('fr')
    expect(localeChain().slice(0, 2)).toEqual(['fr', 'oc'])
    expect(t(SOME_KEY)).toBe('from Occitan')
  })

  test('and through that one’s _fallback too', () => {
    setLocaleFiles({
      fr: file({}, { _fallback: 'oc' }),
      oc: file({}, { _fallback: 'ca' }),
      ca: file({ [SOME_KEY]: 'from Catalan' }),
    })
    applyLocale('fr')
    expect(localeChain().slice(0, 3)).toEqual(['fr', 'oc', 'ca'])
    expect(t(SOME_KEY)).toBe('from Catalan')
  })

  test('a _fallback naming a language nobody has is ignored, not fatal', () => {
    setLocaleFiles({ fr: file({}, { _fallback: 'zz' }) })
    applyLocale('fr')
    expect(localeChain()).not.toContain('zz')
    expect(t(SOME_KEY)).toBeTruthy()
  })

  test('A CYCLE TERMINATES', () => {
    // Two translators can make this mistake separately, and it must cost nothing.
    setLocaleFiles({
      fr: file({}, { _fallback: 'oc' }),
      oc: file({}, { _fallback: 'fr' }),
    })
    applyLocale('fr')
    const chain = localeChain()
    expect(new Set(chain).size).toBe(chain.length) // no code twice
    expect(chain.slice(0, 2)).toEqual(['fr', 'oc'])
    expect(t(SOME_KEY)).toBeTruthy() // and it still answers
  })

  test('a language that is its own _fallback terminates too', () => {
    setLocaleFiles({ fr: file({}, { _fallback: 'fr' }) })
    applyLocale('fr')
    expect(localeChain().filter((c) => c === 'fr')).toHaveLength(1)
    expect(t(SOME_KEY)).toBeTruthy()
  })

  test('the chain ends at the built-ins, symmetrically', () => {
    // §3 says neither built-in is the other's fallback of last resort, and §8 ends
    // every chain at "a compiled-in built-in". The only reading that honours both
    // is that the terminal is EVERY built-in not already reached, in order — so
    // Bengali's floor is English and English's floor is Bengali, equally.
    applyLocale('en')
    expect(localeChain()).toEqual(['en', 'bn'])
    applyLocale('bn')
    expect(localeChain()).toEqual(['bn', 'en'])
    setLocaleFiles({ fr: file({}) })
    applyLocale('fr')
    expect(localeChain()).toEqual(['fr', 'en', 'bn'])
  })
})

describe('the preference is open (§4)', () => {
  test('an unknown locale renders a built-in rather than blanking the interface', () => {
    applyLocale('pt-br') // nobody has added it
    expect(localePref()).toBe('pt-br') // what they stored
    expect(localeActive()).toBe(DEFAULT_LOCALE) // what renders
    expect(t(SOME_KEY)).toBeTruthy()
  })

  test('and the picker can say so, because stored and rendering are two questions', () => {
    applyLocale('pt-br')
    expect(localeMissing()).toBe('pt-br')
    applyLocale('en')
    expect(localeMissing()).toBe('')
  })

  test('a file arriving later makes the stored preference live, with no second choice', () => {
    applyLocale('pt-br')
    expect(localeActive()).toBe(DEFAULT_LOCALE)
    setLocaleFiles({ 'pt-br': file({ [SOME_KEY]: 'Idioma' }, { _name: 'Português' }) })
    expect(localeActive()).toBe('pt-br')
    expect(t(SOME_KEY)).toBe('Idioma')
    expect(localeMissing()).toBe('')
  })

  test('the code is a shape and not an allowlist', () => {
    for (const ok of ['en', 'bn', 'pt-br', 'zh-hans', 'qps']) expect(normCode(ok)).toBe(ok)
    expect(normCode('  EN  ')).toBe('en')
    for (const bad of ['', '..', '../etc', 'en/us', 'en_US', 'français']) expect(normCode(bad)).toBe('')
  })

  test('a language file with no _name is labelled by its bare code', () => {
    setLocaleFiles({ fr: file({}) })
    expect(localeName('fr')).toBe('fr')
  })
})

describe('_dir (§6)', () => {
  test('rtl is the only value that counts, and the default is ltr', () => {
    setLocaleFiles({
      ar: file({}, { _dir: 'rtl' }),
      fa: file({}, { _dir: 'RTL' }), // not lower-cased: the file says what it says
      fr: file({}, {}),
    })
    expect(localeDir('ar')).toBe('rtl')
    expect(localeDir('fa')).toBe('ltr')
    expect(localeDir('fr')).toBe('ltr')
    expect(localeDir('en')).toBe('ltr')
  })
})

describe('a key that resolves nowhere', () => {
  test('renders a word rather than blank or the key itself', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const got = t('library.help.topbar.swipe.description')
    expect(got).toBe('Description')
    expect(got).not.toContain('.')
    expect(got).not.toBe('')
    // The person who can fix it is not looking at the button.
    expect(warn).toHaveBeenCalledOnce()
    t('library.help.topbar.swipe.description')
    expect(warn).toHaveBeenCalledOnce() // one bug is one line, not one per render
    warn.mockRestore()
  })

  test('the humanising is the last segment, tidied', () => {
    expect(placeholderFor('actions.copy')).toBe('Copy')
    expect(placeholderFor('board.filters.clear_all')).toBe('Clear all')
    expect(placeholderFor('a.b.movesToBin')).toBe('Moves to bin')
    expect(placeholderFor('')).toBe('…')
  })
})

describe('placeholders and plurals', () => {
  test('{name} is substituted, and an unknown one is left visible', () => {
    setLocaleFiles({ fr: file({ greet: 'Bonjour {name}, {missing}' }) })
    applyLocale('fr')
    expect(t('greet', { name: 'Aro' })).toBe('Bonjour Aro, {missing}')
  })

  test('a numeric count selects a plural form, then falls back to the bare key', () => {
    setLocaleFiles({
      fr: file({
        'bin.one': '{count} quote',
        'bin.other': '{count} quotes',
        'plain': '{count} things',
      }),
    })
    applyLocale('fr')
    expect(t('bin', { count: 1 })).toBe('1 quote')
    expect(t('bin', { count: 4 })).toBe('4 quotes')
    expect(t('plain', { count: 4 })).toBe('4 things')
  })

  test('tNodes splits a sentence so a call site can put a React node in it', () => {
    setLocaleFiles({ fr: file({ line: 'from {app} to you' }) })
    applyLocale('fr')
    const node = { type: 'b' } // stands in for <b>tippani</b>
    expect(tNodes('line', { app: node })).toEqual(['from ', node, ' to you'])
    // A placeholder with nothing for it stays as its own text, exactly as t() does.
    expect(tNodes('line', {})).toEqual(['from ', '{app}', ' to you'])
  })
})

describe('coverage (§7)', () => {
  test('the arithmetic is floored, and 100 requires every key', () => {
    expect(coveragePercent(0, 0)).toBe(100) // nothing to cover is covered
    expect(coveragePercent(0, 8)).toBe(0)
    expect(coveragePercent(2, 8)).toBe(25)
    expect(coveragePercent(7, 8)).toBe(87) // 87.5 floored, never rounded up
    expect(coveragePercent(8, 8)).toBe(100)
    // THE CLAMP: 199/200 is 99.5, and a language one string short must not be
    // reported as finished. A lying percentage is worse than none.
    expect(coveragePercent(199, 200)).toBe(99)
    expect(coveragePercent(999, 1000)).toBe(99)
    expect(coveragePercent(1, 1000)).toBe(0)
  })

  test('a language reports its real share of the full key set', () => {
    const keys = fullKeys()
    const half = keys.slice(0, Math.ceil(keys.length / 2))
    setLocaleFiles({ fr: file(Object.fromEntries(half.map((k) => [k, 'x']))) })
    expect(coverage('fr')).toBe(coveragePercent(half.length, keys.length))
  })

  test('an empty value does not count as covered', () => {
    // Which is what makes dropping in the generated template honest: every key is
    // present and none of them is translated.
    const template = Object.fromEntries(fullKeys().map((k) => [k, '']))
    setLocaleFiles({ fr: { keys: template, reserved: {}, empty: fullKeys(), bad: [] } })
    expect(coverage('fr')).toBe(0)
  })

  test('a language is never enforced, only reported', () => {
    // Deliberately NOT asserting that any language is complete. §7 forbids a test
    // that fails because a language is incomplete; what it asks for is a test that
    // fails if the NUMBER is wrong, which is the two above.
    setLocaleFiles({ fr: file({}) })
    expect(coverage('fr')).toBe(0)
    expect(installedLocales()).toContain('fr') // still offered at 0%
  })
})

describe('two languages that call themselves the same thing', () => {
  // `_name` is somebody's own word for their own language, and nothing stops two
  // files using it: fr and fr-ca both "Français", a fork of a translation, or the
  // same file copied under a second code while it is being worked on. All three
  // are reasonable. Two identical rows in the picker are not — there is no way to
  // choose between them, and which one you get is whichever the list put first.
  //
  // DISAMBIGUATED, NEVER REFUSED. Dropping the second file would delete somebody's
  // translation from the app over a naming collision they could only diagnose from
  // a log they have no reason to read.
  test('are told apart by their code', () => {
    setLocaleFiles({
      fr: file({}, { _name: 'Français' }),
      'fr-ca': file({}, { _name: 'Français' }),
    })
    const rows = localeCatalogue()
    const names = rows.filter((r) => r.code.startsWith('fr')).map((r) => r.name)
    expect(names.sort()).toEqual(['Français (fr)', 'Français (fr-ca)'])
    // Both are still offered, and each still reports its own coverage.
    expect(rows.map((r) => r.code)).toContain('fr')
    expect(rows.map((r) => r.code)).toContain('fr-ca')
  })

  test('and a name nobody else claims is left exactly as its file wrote it', () => {
    setLocaleFiles({
      fr: file({}, { _name: 'Français' }),
      ta: file({}, { _name: 'தமிழ்' }),
    })
    const byCode = Object.fromEntries(localeCatalogue().map((r) => [r.code, r.name]))
    expect(byCode.fr).toBe('Français')
    expect(byCode.ta).toBe('தமிழ்')
  })

  test('compares the claim rather than the spacing and the case', () => {
    // "Français" and "français " are the same claim, and the reader who typed the
    // second one cannot see the difference either.
    setLocaleFiles({
      fr: file({}, { _name: 'Français' }),
      'fr-be': file({}, { _name: 'français ' }),
    })
    for (const row of localeCatalogue().filter((r) => r.code.startsWith('fr'))) {
      expect(row.name, `${row.code} was not disambiguated`).toContain(`(${row.code})`)
    }
  })

  test('does not dress up a file that forgot its _name', () => {
    // localeName already reports that omission by showing the bare code, and
    // "fr (fr)" reads as a different fault from the one there is.
    setLocaleFiles({ fr: file({}), 'fr-ca': file({}) })
    const byCode = Object.fromEntries(localeCatalogue().map((r) => [r.code, r.name]))
    expect(byCode.fr).toBe('fr')
    expect(byCode['fr-ca']).toBe('fr-ca')
  })

  test('is not confused by the two built-ins, which are named differently', () => {
    setLocaleFiles({})
    for (const row of localeCatalogue()) {
      expect(row.name, `${row.code} gained a code it did not need`).not.toContain('(')
    }
  })
})

describe('the pseudo-locale (§9)', () => {
  test('every keyed string comes back visibly transformed', () => {
    const plain = t(SOME_KEY)
    applyLocale(PSEUDO)
    const pseudo = t(SOME_KEY)
    expect(pseudo).not.toBe(plain)
    expect(pseudo.startsWith('⟦')).toBe(true)
    expect(pseudo.endsWith('⟧')).toBe(true)
  })

  test('it is longer than its source, so a layout that only fits English fails here', () => {
    expect(pseudoTransform('Add to quiz').length).toBeGreaterThan('Add to quiz'.length + 2)
  })

  test('placeholders survive untouched, or every interpolated string would break', () => {
    const out = pseudoTransform('Showing {count} of {total}')
    expect(out).toContain('{count}')
    expect(out).toContain('{total}')
    expect(out).not.toContain('{çöüñţ}')
  })

  test('it never falls through to a real language', () => {
    // A single untransformed sentence on screen is exactly the signal an UNWRAPPED
    // literal gives, so the pseudo-locale reaching English would be a false
    // positive in the one place that must not have them.
    applyLocale(PSEUDO)
    expect(localeChain()).toEqual([PSEUDO])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const missing = t('no.such.key.anywhere')
    expect(missing.startsWith('⟦')).toBe(true)
    warn.mockRestore()
  })

  test('its coverage is 100%, honestly, because it is generated from the key set', () => {
    expect(coverage(PSEUDO)).toBe(100)
  })

  test('it is in the picker, last, and labelled as itself', () => {
    const list = installedLocales()
    expect(list[list.length - 1]).toBe(PSEUDO)
    expect(localeName(PSEUDO).startsWith('⟦')).toBe(true)
  })
})
