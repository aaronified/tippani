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
  DEFAULT_LOCALE,
  applyLocale,
  fullKeys,
  installedLocales,
  localeActive,
  localeChain,
  localeName,
  localePref,
  resetLocaleForTests,
  setLocaleFiles,
  t,
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

describe('a data-dir file overrides a compiled-in value', () => {
  test('for English', () => {
    setLocaleFiles({ en: file({ [SOME_KEY]: 'Overridden in the data dir' }) })
    applyLocale('en')
    expect(t(SOME_KEY)).toBe('Overridden in the data dir')
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
})

describe('the preference is open (§4)', () => {
  test('an unknown locale renders a built-in rather than blanking the interface', () => {
    applyLocale('pt-br') // nobody has added it
    expect(localePref()).toBe('pt-br') // what they stored
    expect(localeActive()).toBe(DEFAULT_LOCALE) // what renders
    expect(t(SOME_KEY)).toBeTruthy()
  })
})

